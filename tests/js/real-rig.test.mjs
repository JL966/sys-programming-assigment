import test from 'node:test';
import assert from 'node:assert/strict';
import { AcceptanceEngine } from '../../web/js/engine.js';
import { ProtocolClient } from '../../web/js/protocol-client.js';
import { NODE } from '../../web/js/protocol.js';
import { RealRig } from '../../web/js/real-rig.js';
import { VirtualBoard, VirtualSerialTransport } from '../../web/js/virtual-board.js';

function makeClient(role, options = {}) {
  const board = new VirtualBoard({ role, boardId: 200 + role, ...options });
  return { board, client: new ProtocolClient(new VirtualSerialTransport(board), role, { timeoutMs: 30 }) };
}

test('real protocol rig completes quick core using framed records', async () => {
  const ctrl = makeClient(NODE.CTRL), dut = makeClient(NODE.DUT), ref = makeClient(NODE.REF);
  const rig = new RealRig({ clients: { CTRL: ctrl.client, DUT: dut.client, REF: ref.client }, source: 'VIRTUAL_PROTOCOL', pollMs: 0, allowDestructive: true });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'VIRTUAL_PROTOCOL' });
  const run = await engine.startRun({ planId: 1, testIds: ['T01', 'T02', 'T03', 'T04', 'T05'] });
  assert.equal(run.attempts.length, 5);
  assert.ok(run.attempts.every(item => item.source === 'VIRTUAL_PROTOCOL' && item.verdict === 'PASS'));
  assert.equal(ctrl.board.releasedRecords, 5);
  assert.deepEqual(Object.keys(run.nodes), ['CTRL', 'DUT', 'REF']);
  await rig.close();
});

test('fault record becomes FAIL and is never converted to hardware evidence', async () => {
  const ctrl = makeClient(NODE.CTRL, { faults: { 3: { verdict: 3, reason: 1 } } });
  const dut = makeClient(NODE.DUT), ref = makeClient(NODE.REF);
  const rig = new RealRig({ clients: { CTRL: ctrl.client, DUT: dut.client, REF: ref.client }, source: 'VIRTUAL_PROTOCOL', pollMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'VIRTUAL_PROTOCOL' });
  const run = await engine.startRun({ planId: 1, testIds: ['T03'] });
  assert.equal(run.attempts[0].verdict, 'FAIL');
  assert.equal(run.attempts[0].source, 'VIRTUAL_PROTOCOL');
  await rig.close();
});

test('preflight rejects a client bound to the wrong role', async () => {
  const wrong = makeClient(NODE.DUT);
  const rig = new RealRig({ clients: { CTRL: wrong.client }, pollMs: 0 });
  await assert.rejects(rig.preflight(), /role mismatch/i);
  await rig.close();
});

test('destructive tests stay blocked until an explicit per-run authorization', async () => {
  const ctrl = makeClient(NODE.CTRL), dut = makeClient(NODE.DUT);
  const rig = new RealRig({ clients: { CTRL: ctrl.client, DUT: dut.client }, source: 'VIRTUAL_PROTOCOL', pollMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'VIRTUAL_PROTOCOL' });
  const run = await engine.startRun({ planId: 1, testIds: ['T05'] });
  assert.equal(run.attempts[0].verdict, 'BLOCKED');
  assert.equal(ctrl.board.recordId, 0);
  await rig.close();
});

test('unsupported hardware profile is blocked before a plan is sent', async () => {
  const ctrl = makeClient(NODE.CTRL), dut = makeClient(NODE.DUT, { profile: 3 });
  const rig = new RealRig({ clients: { CTRL: ctrl.client, DUT: dut.client }, source: 'VIRTUAL_PROTOCOL', pollMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'VIRTUAL_PROTOCOL' });
  const run = await engine.startRun({ planId: 4, testIds: ['T09'] });
  assert.equal(run.attempts[0].verdict, 'BLOCKED');
  assert.equal(run.attempts[0].reason, 'PROFILE_UNSUPPORTED');
  assert.equal(ctrl.board.attempt, 0);
  await rig.close();
});

test('manual test records an explicit unable-to-confirm decision', async () => {
  const ctrl = makeClient(NODE.CTRL), dut = makeClient(NODE.DUT);
  const rig = new RealRig({ clients: { CTRL: ctrl.client, DUT: dut.client }, source: 'VIRTUAL_PROTOCOL', pollMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'VIRTUAL_PROTOCOL' });
  const run = await engine.startRun({ planId: 5, testIds: ['T11'] });
  assert.equal(run.attempts[0].verdict, 'INCONCLUSIVE');
  assert.equal(run.attempts[0].reason, 'STIMULUS_UNCONFIRMED');
  await rig.close();
});

test('record release happens only after persistence and is withheld on persistence failure', async () => {
  const ctrl = makeClient(NODE.CTRL), dut = makeClient(NODE.DUT);
  const rig = new RealRig({ clients: { CTRL: ctrl.client, DUT: dut.client }, source: 'VIRTUAL_PROTOCOL', pollMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'VIRTUAL_PROTOCOL', persistRun: async () => {
    assert.ok(ctrl.board.record); throw new Error('storage offline');
  }});
  await assert.rejects(engine.startRun({ planId: 1, testIds: ['T01'] }), /storage offline/);
  assert.ok(ctrl.board.record);
  assert.equal(ctrl.board.releasedRecords, 0);
  await rig.close();
});
