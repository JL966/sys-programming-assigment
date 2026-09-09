import { crc16, decodeFrame, encodeFrame, MESSAGE, NODE, PROTOCOL_VERSION } from './protocol.js';
import { encodeRecord, encodeResultBody } from './record-codec.js';

const put16 = (out, at, value) => { out[at] = value & 0xff; out[at + 1] = value >>> 8; };
const get16 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8);

export class VirtualBoard {
  constructor({ role, boardId = role, firmware = [1, 1], profile = null, capabilities = 0xff, faults = {} }) {
    const defaultProfile = role === NODE.DUT ? 3 : role === NODE.REF ? 2 : 1;
    this.role = role; this.boardId = boardId; this.firmware = firmware;
    this.profile = profile ?? defaultProfile; this.capabilities = capabilities;
    this.faults = faults; this.session = 0; this.phase = 0; this.attempt = 0;
    this.currentTest = 0; this.recordId = 0; this.record = null; this.releasedRecords = 0;
    this.expectedConfigCrc = 0xffff; this.configBytes = [];
  }

  handle(wire) {
    const request = decodeFrame(wire, { destination: this.role });
    const payload = new Uint8Array(8); let length = 1; let status = 0;
    if (request.type === MESSAGE.HELLO) {
      payload.set([0, this.role, PROTOCOL_VERSION,
        request.step === 1 ? this.capabilities & 0xff : this.firmware[0],
        request.step === 1 ? (this.capabilities >>> 8) & 0xff : this.firmware[1], this.profile]);
      put16(payload, 6, this.boardId); length = 8;
    } else if (request.type === MESSAGE.BEGIN_SESSION) {
      if (!request.session || request.payload.length !== 8) status = 3;
      else if (this.phase !== 0 && this.phase !== 2) status = 1;
      else { this.session = request.session; this.phase = 1; this.expectedConfigCrc = get16(request.payload, 5); this.configBytes = []; }
    } else if (request.session !== this.session) status = 6;
    else if (request.type === MESSAGE.CONFIG_WRITE) {
      if (this.phase !== 1 || request.payload.length !== 8) status = 4;
      else if (!request.payload[0] || request.payload[0] > 0x0c ||
        (this.configBytes.length && request.payload[0] <= this.configBytes[this.configBytes.length - 8])) status = 3;
      else this.configBytes.push(...request.payload);
    }
    else if (request.type === MESSAGE.CONFIG_COMMIT) {
      if (this.phase !== 1 || request.payload.length !== 2) status = 4;
      else if (get16(request.payload, 0) !== this.expectedConfigCrc || crc16(this.configBytes) !== this.expectedConfigCrc) status = 3;
      else this.phase = 2;
    } else if (request.type === MESSAGE.RUN_PLAN) {
      if (this.role !== NODE.CTRL) status = 5;
      else if (this.phase !== 2 || request.payload.length < 3) status = 4;
      else {
        this.phase = 6; this.currentTest = request.testId; this.attempt++;
        if (this.currentTest < 11 || this.currentTest > 13) this.#saveResult(this.faults[this.currentTest] || {});
      }
    } else if (request.type === MESSAGE.GET_STATUS) {
      payload.set([0, this.phase]); put16(payload, 2, this.attempt); payload[4] = this.currentTest;
      payload[5] = 0; put16(payload, 6, this.record ? this.recordId : 0); length = 8;
    } else if (request.type === MESSAGE.READ_RECORD) {
      const id = get16(request.payload, 0), chunk = request.payload[2], offset = chunk * 4;
      if (!this.record || id !== this.recordId || offset >= this.record.length) status = 11;
      else {
        payload[0] = 0; put16(payload, 1, id); payload[3] = chunk;
        payload.set(this.record.slice(offset, offset + 4), 4); length = 8;
      }
    } else if (request.type === MESSAGE.RELEASE_RESULT) {
      if (!this.record || get16(request.payload, 0) !== this.recordId) status = 11;
      else { this.record = null; this.releasedRecords++; this.phase = 2; }
    } else if (request.type === MESSAGE.HUMAN_CONFIRM) {
      if (this.currentTest < 11 || this.currentTest > 13 || get16(request.payload, 0) !== this.attempt) status = 4;
      else if (request.payload[2] === 1) this.#saveResult({ verdict: 2, reason: 0, automation: 3 });
      else if (request.payload[2] === 2) this.#saveResult({ verdict: 3, reason: 5, automation: 3 });
      else if (request.payload[2] === 3) this.#saveResult({ verdict: 5, reason: 14, automation: 3 });
      else status = 3;
    } else if (request.type === MESSAGE.CANCEL_TEST) {
      this.phase = 5;
    } else if (request.type === MESSAGE.CLOSE_SESSION) {
      this.phase = 0; this.session = 0; this.record = null;
    } else status = 5;
    payload[0] = status;
    return encodeFrame({ type: request.type | 0x80, src: this.role, dst: request.src,
      session: request.session, seq: request.seq, testId: request.testId, step: request.step,
      flags: status ? 3 : 1, payload: payload.slice(0, length) });
  }

  #saveResult(result) {
    const body = encodeResultBody({ attempt: this.attempt, testId: this.currentTest,
      verdict: result.verdict ?? 2, reason: result.reason ?? 0, automation: result.automation ?? 1,
      cleanup: 1, durationMs: 20, valid: result.verdict === 3 ? 0 : 1, errors: result.verdict === 3 ? 1 : 0 });
    this.record = encodeRecord({ kind: 1, body }); this.recordId++;
  }
}

export class VirtualSerialTransport {
  constructor(board) { this.board = board; this.onBytes = () => {}; this.onDisconnect = () => {}; this.connected = true; }
  async send(wire) { const response = this.board.handle(wire); queueMicrotask(() => this.onBytes(response)); }
  async close() { this.connected = false; }
}
