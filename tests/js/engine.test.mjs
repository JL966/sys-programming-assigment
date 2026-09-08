import test from 'node:test';
import assert from 'node:assert/strict';
import { AcceptanceEngine } from '../../web/js/engine.js';
import { SimulatedRig } from '../../web/js/simulator.js';
import { TEST_CATALOG } from '../../web/js/catalog.js';

test('quick core plan produces five distinct automatic evidence attempts', async () => {
  const rig = new SimulatedRig({ latencyMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION' });
  const run = await engine.startRun({ planId: 1, testIds: ['T01','T02','T03','T04','T05'] });
  assert.equal(run.attempts.length, 5);
  assert.deepEqual(run.attempts.map(item => item.testId), ['T01','T02','T03','T04','T05']);
  assert.ok(run.attempts.every(item => item.verdict === 'PASS'));
  assert.ok(run.attempts.every(item => item.source === 'SIMULATION'));
  assert.ok(new Set(run.attempts.map(item => item.evidence.kind)).size >= 4);
});

test('IR failure and successful retest remain as separate attempts', async () => {
  const rig = new SimulatedRig({ latencyMs: 0 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION' });
  rig.setFault('irBlocked', true);
  const run = await engine.startRun({ planId: 1, testIds: ['T03'] });
  assert.equal(run.attempts[0].verdict, 'FAIL');
  assert.equal(run.attempts[0].diagnosis.domain, '红外链路');
  rig.setFault('irBlocked', false);
  await engine.retest('T03');
  assert.deepEqual(run.attempts.map(item => item.verdict), ['FAIL', 'PASS']);
  assert.notEqual(run.attempts[0].attempt, run.attempts[1].attempt);
});

test('missing DUT blocks RS485 before a test attempt can fail', async () => {
  const rig = new SimulatedRig({ latencyMs: 0, online: { CTRL: true, DUT: false, REF: true } });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION' });
  const run = await engine.startRun({ planId: 1, testIds: ['T02'] });
  assert.equal(run.attempts[0].verdict, 'BLOCKED');
  assert.equal(run.attempts[0].reason, 'NODE_UNREACHABLE');
});

test('a second start while a run is active is rejected', async () => {
  const rig = new SimulatedRig({ latencyMs: 20 });
  const engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION' });
  const first = engine.startRun({ planId: 1, testIds: ['T01','T02'] });
  await assert.rejects(
    engine.startRun({ planId: 1, testIds: ['T03'] }),
    /already active/i
  );
  await first;
});

test('catalog labels assisted and manual tests honestly', () => {
  assert.equal(TEST_CATALOG.T07.automation, 'ASSISTED_AUTO');
  assert.equal(TEST_CATALOG.T11.automation, 'MANUAL');
  assert.equal(TEST_CATALOG.T05.destructive, true);
});
