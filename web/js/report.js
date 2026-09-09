const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function summarizeRun(run) {
  const latest = new Map();
  for (const attempt of run.attempts || []) latest.set(attempt.testId, attempt);
  const attempts = [...latest.values()];
  return {
    totalAttempts: (run.attempts || []).length,
    latestTests: attempts.length,
    passed: attempts.filter(item => item.verdict === 'PASS').length,
    failed: attempts.filter(item => item.verdict === 'FAIL').length,
    blocked: attempts.filter(item => item.verdict === 'BLOCKED' || item.verdict === 'INCONCLUSIVE').length,
    manual: attempts.filter(item => item.automation === 'MANUAL').length
  };
}

export function assessRun(run) {
  const latest = new Map();
  for (const attempt of run.attempts || []) latest.set(attempt.testId, attempt);
  const selectedTests = Array.isArray(run.testIds) && run.testIds.length
    ? [...run.testIds] : [...latest.keys()];
  const missing = selectedTests.filter(testId => !latest.has(testId));
  const unresolved = selectedTests.filter(testId => {
    const attempt = latest.get(testId);
    if (!attempt || attempt.automation === 'MANUAL') return false;
    if (attempt.verdict !== 'PASS') return true;
    return attempt.evidence && ('valid' in attempt.evidence) && !Boolean(attempt.evidence.valid);
  });
  const manual = selectedTests.filter(testId => latest.get(testId)?.automation === 'MANUAL');
  const qualified = run.status === 'COMPLETED' && selectedTests.some(testId => latest.get(testId)?.automation !== 'MANUAL') &&
    missing.length === 0 && unresolved.length === 0;
  return Object.freeze({ qualified, selectedTests, missing, unresolved, manual });
}

export function exportRunJson(run) { return JSON.stringify(run, null, 2); }

export function exportRunHtml(run) {
  const summary = summarizeRun(run);
  const assessment = assessRun(run);
  const simulation = run.mode === 'SIMULATION'
    ? '<div class="simulation">模拟数据：仅用于软件演示，不是下板验收结果</div>'
    : run.mode === 'VIRTUAL_PROTOCOL'
      ? '<div class="simulation">虚拟协议数据：仅用于字节级集成验证，不是下板验收结果</div>' : '';
  const rows = (run.attempts || []).map(attempt => `<tr>
    <td>${escapeHtml(attempt.attempt)}</td><td>${escapeHtml(attempt.testId)}</td>
    <td>${escapeHtml(attempt.title)}</td><td>${escapeHtml(attempt.automation)}</td>
    <td class="${escapeHtml(attempt.verdict)}">${escapeHtml(attempt.verdict)}</td>
    <td>${escapeHtml(attempt.reason)}</td><td><pre>${escapeHtml(JSON.stringify(attempt.evidence, null, 2))}</pre></td>
  </tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>学习板验收报告</title>
  <style>body{font:14px/1.6 system-ui;margin:32px;color:#163047}h1{margin-bottom:4px}.simulation{padding:12px;background:#fff3cd;border:1px solid #e6bd45;font-weight:700}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border:1px solid #ccd8e2;padding:8px;vertical-align:top}th{background:#eaf2f8}.PASS{color:#08784b}.FAIL{color:#b02a37}pre{white-space:pre-wrap;margin:0}</style></head><body>
  <h1>学习板自动验收与故障定位报告</h1>${simulation}
  <p>运行：${escapeHtml(run.uuid)}｜状态：${escapeHtml(run.status)}｜开始：${escapeHtml(run.startedAt)}｜结束：${escapeHtml(run.endedAt)}</p>
  <p>自动合格摘要：${assessment.qualified ? '可生成（人工项目另列）' : '未生成；仍有缺失、失败或待判证据'}</p>
  <p>尝试 ${summary.totalAttempts}；当前测试 ${summary.latestTests}；通过 ${summary.passed}；失败 ${summary.failed}；阻塞/待判 ${summary.blocked}；人工 ${summary.manual}</p>
  <h2>配置快照</h2><pre>${escapeHtml(JSON.stringify(run.config, null, 2))}</pre>
  <h2>节点</h2><pre>${escapeHtml(JSON.stringify(run.nodes, null, 2))}</pre>
  <h2>尝试历史</h2><table><thead><tr><th>#</th><th>项目</th><th>标题</th><th>自动化</th><th>结论</th><th>原因</th><th>证据</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

export function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
