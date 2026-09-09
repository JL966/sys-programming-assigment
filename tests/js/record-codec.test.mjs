import test from 'node:test';
import assert from 'node:assert/strict';
import { crc16 } from '../../web/js/protocol.js';
import { decodeRecord, encodeRecord, encodeResultBody, decodeResultBody } from '../../web/js/record-codec.js';

test('record envelope round-trips and validates body CRC', () => {
  const body = encodeResultBody({ attempt: 42, testId: 5, verdict: 1, reason: 0,
    automation: 1, cleanup: 1, durationMs: 1234, valid: 7, errors: 0 });
  const wire = encodeRecord({ kind: 1, body });
  assert.equal(wire.length, body.length + 6);
  assert.equal(wire[4] | (wire[5] << 8), crc16(body));
  assert.deepEqual(decodeResultBody(decodeRecord(wire).body), {
    attempt: 42, testId: 5, verdict: 1, reason: 0, automation: 1,
    cleanup: 1, durationMs: 1234, valid: 7, errors: 0
  });
  wire[wire.length - 1] ^= 1;
  assert.throws(() => decodeRecord(wire), /CRC/);
});

test('record decoder rejects truncated and trailing data', () => {
  const wire = encodeRecord({ kind: 2, body: Uint8Array.from([1, 2, 3]) });
  assert.throws(() => decodeRecord(wire.slice(0, -1)), /length/);
  assert.throws(() => decodeRecord(Uint8Array.from([...wire, 0])), /length/);
});
