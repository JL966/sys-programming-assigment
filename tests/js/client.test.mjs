import test from 'node:test';
import assert from 'node:assert/strict';
import { ProtocolClient } from '../../web/js/protocol-client.js';
import { decodeFrame, encodeFrame, MESSAGE } from '../../web/js/protocol.js';

function pair(reply) {
  const sent = [];
  const transport = { onBytes() {}, async send(wire) {
    const req = decodeFrame(wire); sent.push(req);
    await reply(req, rsp => transport.onBytes(encodeFrame({ ...req, src: req.dst, dst: req.src,
      type: req.type | 128, flags: 1, payload: [0], ...rsp })));
  }, async close() {} };
  return { client: new ProtocolClient(transport, 1, { timeoutMs: 15 }), sent };
}
test('client ignores stale sequence and matches response fields', async () => {
  const { client } = pair((req, send) => { send({ seq: req.seq + 1 }); send({}); });
  assert.equal((await client.request(MESSAGE.HELLO)).src, 1);
  await client.close();
});
test('read retries preserve original sequence', async () => {
  let calls = 0;
  const { client, sent } = pair((req, send) => { if (++calls === 2) send({}); });
  await client.request(MESSAGE.HELLO, { retries: 1 });
  assert.equal(sent.length, 2); assert.equal(sent[0].seq, sent[1].seq);
});
test('action timeout does not cause a fresh action', async () => {
  const { client, sent } = pair(() => {});
  await assert.rejects(client.request(MESSAGE.RUN_PLAN), /timeout/);
  assert.equal(sent.length, 1);
});
test('close immediately rejects pending transactions', async () => {
  const { client } = pair(() => {});
  const result = assert.rejects(client.request(MESSAGE.HELLO), /closed/);
  await client.close(); await result;
});
