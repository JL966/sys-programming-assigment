export const FRAME_SIZE = 24;
export const PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD = 8;

export const NODE = Object.freeze({ PC: 0, CTRL: 1, DUT: 2, REF: 3, BROADCAST: 0xFF });
export const MESSAGE = Object.freeze({
  HELLO: 0x01, GET_STATUS: 0x02, BEGIN_SESSION: 0x03, CLOSE_SESSION: 0x04,
  CONFIG_WRITE: 0x05, CONFIG_COMMIT: 0x06, RUN_PLAN: 0x07,
  PAUSE_PLAN: 0x08, RESUME_PLAN: 0x09, PREPARE_TEST: 0x10,
  EXECUTE_STEP: 0x11, READ_RECORD: 0x12, CANCEL_TEST: 0x13,
  HUMAN_CONFIRM: 0x14, RELEASE_RESULT: 0x15, RENEW_LEASE: 0x16,
  LINK_CHALLENGE: 0x20, TX_LEASE: 0x21, SNAPSHOT_ACK: 0x30
});

export function crc16(bytes) {
  let crc = 0xFFFF;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
    }
  }
  return crc & 0xFFFF;
}

function putU16(out, offset, value) {
  out[offset] = value & 0xFF;
  out[offset + 1] = (value >>> 8) & 0xFF;
}

function getU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function encodeFrame({
  version = PROTOCOL_VERSION, type, src, dst, session = 0, seq,
  testId = 0, step = 0, payload = new Uint8Array(), flags = 0
}) {
  if (!(payload instanceof Uint8Array)) payload = Uint8Array.from(payload);
  if (payload.length > MAX_PAYLOAD) throw new RangeError('payload exceeds eight bytes');
  if (version !== PROTOCOL_VERSION) throw new RangeError('unsupported protocol version');
  if ((flags & ~0x03) !== 0) throw new RangeError('reserved flag bits must be zero');
  for (const [name, value, max] of [
    ['type', type, 0xFF], ['src', src, 0xFF], ['dst', dst, 0xFF],
    ['session', session, 0xFFFF], ['seq', seq, 0xFFFF],
    ['testId', testId, 15], ['step', step, 0xFF]
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > max) throw new RangeError(`${name} out of range`);
  }
  const out = new Uint8Array(FRAME_SIZE);
  out.set([0xA5, 0x5A, version, type, src, dst]);
  putU16(out, 6, session);
  putU16(out, 8, seq);
  out[10] = testId;
  out[11] = step;
  out[12] = payload.length;
  out[13] = flags;
  out.set(payload, 14);
  putU16(out, 22, crc16(out.subarray(2, 22)));
  return out;
}

export function decodeFrame(bytes, { destination, session = 0 } = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== FRAME_SIZE) throw new Error('frame length must be 24');
  if (bytes[0] !== 0xA5 || bytes[1] !== 0x5A) throw new Error('invalid SOF');
  if (getU16(bytes, 22) !== crc16(bytes.subarray(2, 22))) throw new Error('CRC mismatch');
  if (bytes[2] !== PROTOCOL_VERSION) throw new Error('unsupported version');
  if (bytes[12] > MAX_PAYLOAD) throw new Error('payload length invalid');
  if ((bytes[13] & ~0x03) !== 0) throw new Error('reserved flags set');
  if (destination !== undefined && bytes[5] !== destination && bytes[5] !== NODE.BROADCAST)
    throw new Error('wrong destination');
  const frameSession = getU16(bytes, 6);
  if (session !== 0 && frameSession !== session) throw new Error('wrong session');
  return Object.freeze({
    version: bytes[2], type: bytes[3], src: bytes[4], dst: bytes[5],
    session: frameSession, seq: getU16(bytes, 8), testId: bytes[10],
    step: bytes[11], payload: bytes.slice(14, 14 + bytes[12]), flags: bytes[13],
    wire: bytes.slice()
  });
}

export class FrameStreamDecoder {
  #buffer = [];
  #options;

  constructor(options = {}) { this.#options = options; }

  push(chunk) {
    this.#buffer.push(...chunk);
    const frames = [];
    while (this.#buffer.length >= 2) {
      const sof = this.#buffer.findIndex((value, index) => value === 0xA5 && this.#buffer[index + 1] === 0x5A);
      if (sof < 0) {
        this.#buffer = this.#buffer.at(-1) === 0xA5 ? [0xA5] : [];
        break;
      }
      if (sof > 0) this.#buffer.splice(0, sof);
      if (this.#buffer.length < FRAME_SIZE) break;
      const candidate = Uint8Array.from(this.#buffer.slice(0, FRAME_SIZE));
      try {
        frames.push(decodeFrame(candidate, this.#options));
        this.#buffer.splice(0, FRAME_SIZE);
      } catch {
        this.#buffer.shift();
      }
    }
    return frames;
  }

  reset() { this.#buffer = []; }
}
