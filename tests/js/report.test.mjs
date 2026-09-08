import test from 'node:test';
import assert from 'node:assert/strict';
import { exportRunHtml, exportRunJson, summarizeRun } from '../../web/js/report.js';

const run = {
  uuid: 'run-<script>', mode: 'SIMULATION', startedAt: '2026-09-08T00:00:00.000Z',
  endedAt: '2026-09-08T00:00:05.000Z', status: 'COMPLETED',
  nodes: { DUT: { boardId: 102, firmware: '1.0' } },
  config: { thresholds: { irWindowMs: 3000 } },
  attempts: [
    { attempt: 1, testId: 'T03', title: '<img src=x onerror=alert(1)>', automation: 'AUTO', verdict: 'FAIL', reason: 'RESPONSE_TIMEOUT', source: 'SIMULATION', evidence: { raw: '<script>alert(1)</script>' } },
    { attempt: 2, parentAttempt: 1, testId: 'T03', title: '红外复测', automation: 'AUTO', verdict: 'PASS', reason: 'NONE', source: 'SIMULATION', evidence: { valid: 2 } }
  ]
};

test('summary counts latest outcome without deleting history', () => {
  const summary = summarizeRun(run);
  assert.deepEqual(summary, { totalAttempts: 2, latestTests: 1, passed: 1, failed: 0, blocked: 0, manual: 0 });
});

test('JSON export is complete and parseable', () => {
  const parsed = JSON.parse(exportRunJson(run));
  assert.equal(parsed.attempts.length, 2);
  assert.equal(parsed.config.thresholds.irWindowMs, 3000);
});

test('HTML export escapes all operator and evidence text', () => {
  const html = exportRunHtml(run);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /模拟数据/);
});
