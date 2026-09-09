import { crc16 } from './protocol.js';

const u16 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8);
const u32 = (bytes, at) => (bytes[at] | (bytes[at + 1] << 8) |
  (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
const put16 = (bytes, at, value) => { bytes[at] = value & 0xff; bytes[at + 1] = value >>> 8; };
const put32 = (bytes, at, value) => {
  bytes[at] = value & 0xff; bytes[at + 1] = value >>> 8;
  bytes[at + 2] = value >>> 16; bytes[at + 3] = value >>> 24;
};

export function encodeRecord({ schema = 1, kind, body }) {
  const payload = Uint8Array.from(body);
  if (!Number.isInteger(kind) || kind < 1 || kind > 255) throw new RangeError('record kind out of range');
  if (payload.length > 0xffff) throw new RangeError('record body too large');
  const out = new Uint8Array(6 + payload.length);
  out[0] = schema; out[1] = kind; put16(out, 2, payload.length); put16(out, 4, crc16(payload));
  out.set(payload, 6);
  return out;
}

export function decodeRecord(bytes) {
  const wire = Uint8Array.from(bytes);
  if (wire.length < 6) throw new Error('record length invalid');
  const length = u16(wire, 2);
  if (wire.length !== length + 6) throw new Error('record length mismatch');
  const body = wire.slice(6);
  if (crc16(body) !== u16(wire, 4)) throw new Error('record body CRC mismatch');
  return Object.freeze({ schema: wire[0], kind: wire[1], bodyLength: length, bodyCrc: u16(wire, 4), body });
}

export function encodeResultBody({ attempt, testId, verdict, reason, automation, cleanup, durationMs, valid, errors }) {
  const out = new Uint8Array(15);
  put16(out, 0, attempt); out[2] = testId; out[3] = verdict; out[4] = reason;
  out[5] = automation; out[6] = cleanup; put32(out, 7, durationMs);
  put16(out, 11, valid); put16(out, 13, errors);
  return out;
}

export function decodeResultBody(bytes) {
  if (bytes.length !== 15) throw new Error('result record length invalid');
  return Object.freeze({ attempt: u16(bytes, 0), testId: bytes[2], verdict: bytes[3],
    reason: bytes[4], automation: bytes[5], cleanup: bytes[6], durationMs: u32(bytes, 7),
    valid: u16(bytes, 11), errors: u16(bytes, 13) });
}
