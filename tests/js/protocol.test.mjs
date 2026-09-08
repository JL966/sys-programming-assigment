import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_SIZE, MESSAGE, NODE, PROTOCOL_VERSION, FrameStreamDecoder,
  crc16, decodeFrame, encodeFrame
} from '../../web/js/protocol.js';

const HELLO_GOLDEN = Uint8Array.from([
  0xA5,0x5A,0x01,0x01,0x00,0x01,0x00,0x00,
  0x01,0x00,0x00,0x00,0x01,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x24,0xA2
]);

test('CRC catches a changed payload byte', () => {
  assert.equal(crc16(new TextEncoder().encode('123456789')), 0x4B37);
});

test('HELLO encoder matches the hand-checked cross-language vector', () => {
  const frame = encodeFrame({
    version: PROTOCOL_VERSION, type: MESSAGE.HELLO,
    src: NODE.PC, dst: NODE.CTRL, session: 0, seq: 1,
    testId: 0, step: 0, payload: Uint8Array.of(0)
  });
  assert.deepEqual(frame, HELLO_GOLDEN);
  assert.equal(frame.length, FRAME_SIZE);
});

test('decoder rejects corrupt CRC, unsupported version and wrong destination', () => {
  const corrupt = HELLO_GOLDEN.slice();
  corrupt[22] ^= 1;
  assert.throws(() => decodeFrame(corrupt, { destination: NODE.CTRL }), /CRC/);

  const version = HELLO_GOLDEN.slice();
  version[2] = 2;
  version[22] = 0x60;
  version[23] = 0x91;
  assert.throws(() => decodeFrame(version, { destination: NODE.CTRL }), /version/i);
  assert.throws(() => decodeFrame(HELLO_GOLDEN, { destination: NODE.DUT }), /destination/i);
});

test('stream decoder recovers from garbage and split frames and emits glued frames', () => {
  const decoder = new FrameStreamDecoder({ destination: NODE.CTRL });
  const first = decoder.push(Uint8Array.from([0x11, 0xA5, ...HELLO_GOLDEN.slice(0, 9)]));
  assert.deepEqual(first, []);
  const second = decoder.push(Uint8Array.from([...HELLO_GOLDEN.slice(9), ...HELLO_GOLDEN]));
  assert.equal(second.length, 2);
  assert.equal(second[0].seq, 1);
  assert.equal(second[1].type, MESSAGE.HELLO);
});

test('payload longer than eight bytes is rejected', () => {
  assert.throws(() => encodeFrame({
    type: MESSAGE.HELLO, src: NODE.PC, dst: NODE.CTRL,
    session: 0, seq: 1, testId: 0, step: 0,
    payload: new Uint8Array(9)
  }), /payload/i);
});
