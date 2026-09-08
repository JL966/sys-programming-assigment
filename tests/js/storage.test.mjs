import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceStore, FragmentAssembler, MemoryBackend } from '../../web/js/storage.js';

test('pending EEPROM restoration survives a new store instance', async () => {
  const backend = new MemoryBackend();
  const first = new EvidenceStore(backend);
  await first.saveRun({ uuid: 'run-1', pendingRestore: true, attempts: [] });
  const second = new EvidenceStore(backend);
  assert.deepEqual((await second.listPendingRestores()).map(item => item.uuid), ['run-1']);
});

test('identical record fragments deduplicate but conflicting repeats are rejected', () => {
  const assembler = new FragmentAssembler({ bodyLength: 6, bodyCrc: 0x1234 });
  assert.equal(assembler.add(0, Uint8Array.of(1,2,3,4)), true);
  assert.equal(assembler.add(0, Uint8Array.of(1,2,3,4)), false);
  assert.throws(() => assembler.add(0, Uint8Array.of(9,2,3,4)), /conflict/i);
});

test('storage failure closes the destructive-operation authorization gate', async () => {
  const backend = { put: async () => { throw new Error('disk full'); }, values: async () => [] };
  const store = new EvidenceStore(backend);
  await assert.rejects(store.persistBeforeDestructive({ uuid: 'run-2', pendingRestore: true }), /disk full/);
  assert.equal(store.destructiveAuthorized, false);
});

test('failed and passed retest attempts persist without overwrite', async () => {
  const backend = new MemoryBackend();
  const store = new EvidenceStore(backend);
  await store.saveRun({ uuid: 'run-3', attempts: [
    { attempt: 1, testId: 'T03', verdict: 'FAIL' },
    { attempt: 2, parentAttempt: 1, testId: 'T03', verdict: 'PASS' }
  ] });
  const saved = await store.getRun('run-3');
  assert.deepEqual(saved.attempts.map(item => item.verdict), ['FAIL','PASS']);
});
