import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseAttempt } from '../../web/js/diagnostics.js';

test('an IR timeout with all nodes online is localized to the IR link domain', () => {
  const result = diagnoseAttempt({
    testId: 'T03', verdict: 'FAIL', reason: 'RESPONSE_TIMEOUT',
    evidence: { channel: 'IR', ctrlOnline: true, dutOnline: true, refOnline: true }
  });
  assert.equal(result.level, 'D1');
  assert.equal(result.domain, '红外链路');
  assert.match(result.limitation, /不能.*器件/);
});

test('an unreachable node is a blocked precondition instead of a component failure', () => {
  const result = diagnoseAttempt({
    testId: 'T02', verdict: 'BLOCKED', reason: 'NODE_UNREACHABLE',
    evidence: { ctrlOnline: true, dutOnline: false, refOnline: true }
  });
  assert.equal(result.level, 'D0');
  assert.equal(result.domain, '节点在线前提');
});

test('an unsupported hardware profile is explained as a capability gap', () => {
  const result = diagnoseAttempt({
    testId: 'T09', verdict: 'BLOCKED', reason: 'PROFILE_UNSUPPORTED',
    evidence: { required: 'DUT_ULTRA', actual: 3 }
  });
  assert.equal(result.level, 'D0');
  assert.equal(result.domain, '硬件档案');
});

test('manual output rejection is kept separate from automatic diagnosis', () => {
  const result = diagnoseAttempt({
    testId: 'T11', verdict: 'FAIL', reason: 'USER_REJECTED',
    automation: 'MANUAL', evidence: { decisionBy: 'operator' }
  });
  assert.equal(result.level, 'D0');
  assert.equal(result.domain, '人工观察');
});
