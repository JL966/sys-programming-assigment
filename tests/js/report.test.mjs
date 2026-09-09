import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRun, exportRunHtml, exportRunJson, summarizeRun } from '../../web/js/report.js';

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

test('assessment only qualifies complete automatic evidence', () => {
  const complete = { ...run, testIds: ['T03'], attempts: [run.attempts[1]] };
  assert.equal(assessRun(complete).qualified, true);
  const blocked = { ...complete, attempts: [{ ...run.attempts[1], verdict: 'INCONCLUSIVE', evidence: { valid: 0 } }] };
  assert.equal(assessRun(blocked).qualified, false);
  assert.deepEqual(assessRun(blocked).unresolved, ['T03']);
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

test('virtual protocol reports are visibly marked as non-hardware evidence', () => {
  const html = exportRunHtml({ ...run, mode: 'VIRTUAL_PROTOCOL' });
  assert.match(html, /虚拟协议数据/);
});

test('HTML report states when an automatic qualified summary is unavailable', () => {
  const html = exportRunHtml({ ...run, testIds: ['T03'] });
  assert.match(html, /自动合格摘要/);
});
