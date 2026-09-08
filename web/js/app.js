import { AcceptanceEngine } from './engine.js';
import { PLANS } from './catalog.js';
import { SimulatedRig } from './simulator.js';
import { EvidenceStore, IndexedDbBackend, MemoryBackend } from './storage.js';
import { downloadText, exportRunHtml, exportRunJson, summarizeRun } from './report.js';

const $ = selector => document.querySelector(selector);
const ui = {
  mode: $('#mode-select'), banner: $('#mode-banner'), plan: $('#plan-select'), start: $('#start-button'), cancel: $('#cancel-button'),
  nodes: $('#node-grid'), nodeCount: $('#node-count'), attempts: $('#attempt-list'), evidence: $('#evidence-panel'), summary: $('#summary'),
  json: $('#export-json'), html: $('#export-html'), log: $('#status-log'),
  faults: { irBlocked: $('#fault-ir'), rs485Disconnected: $('#fault-485'), rtcStopped: $('#fault-rtc'), eepromMismatch: $('#fault-eeprom') }
};

const rig = new SimulatedRig();
let engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION' });
let store = new EvidenceStore(new IndexedDbBackend());
let currentRun = null;

function setLog(text) { ui.log.textContent = text; }
function safe(value) { return String(value ?? '—'); }

function renderNodes(nodes) {
  const entries = Object.values(nodes || {});
  ui.nodeCount.textContent = `${entries.filter(node => node.online).length}/${entries.length} 在线`;
  ui.nodes.innerHTML = entries.map(node => `<div class="node ${node.online ? '' : 'offline'}"><strong>${safe(node.role)}</strong><small>${node.online ? 'ONLINE' : 'OFFLINE'}</small><small>板号 ${safe(node.boardId)} · FW ${safe(node.firmware)}</small><small>${safe(node.profile)}</small></div>`).join('');
}

function renderAttempts(run) {
  const summary = summarizeRun(run);
  ui.summary.textContent = `当前通过 ${summary.passed} · 失败 ${summary.failed} · 阻塞/待判 ${summary.blocked}`;
  ui.attempts.innerHTML = run.attempts.map(attempt => `<div class="attempt" data-attempt="${attempt.attempt}"><strong>#${attempt.attempt}</strong><div><strong>${attempt.testId} ${safe(attempt.title)}</strong><small>${safe(attempt.diagnosis?.domain)}</small></div><span>${attempt.automation}</span><span class="verdict ${attempt.verdict}">${attempt.verdict}</span><button data-retest="${attempt.testId}">复测</button></div>`).join('');
}

function showEvidence(attempt) { ui.evidence.textContent = JSON.stringify(attempt, null, 2); }

async function persist() {
  try { await store.saveRun(currentRun); }
  catch (error) {
    store = new EvidenceStore(new MemoryBackend());
    await store.saveRun(currentRun);
    setLog(`IndexedDB 不可用，已降级为本页内存保存：${error.message}`);
  }
}

async function start() {
  if (ui.mode.value !== 'SIMULATION') {
    setLog('真实模式只接受实际串口证据；请连接已烧录对应角色固件的学习板。');
    return;
  }
  for (const [name, checkbox] of Object.entries(ui.faults)) rig.setFault(name, checkbox.checked);
  const plan = PLANS[Number(ui.plan.value)];
  ui.start.disabled = true; ui.cancel.disabled = false; setLog(`正在执行：${plan.title}`);
  try {
    currentRun = await engine.startRun({ planId: plan.id, testIds: plan.tests });
    renderNodes(currentRun.nodes); renderAttempts(currentRun); await persist();
    ui.json.disabled = ui.html.disabled = false;
    setLog(`运行完成，保留 ${currentRun.attempts.length} 条 attempt。`);
  } catch (error) { setLog(`运行失败：${error.message}`); }
  finally { ui.start.disabled = false; ui.cancel.disabled = true; }
}

ui.start.addEventListener('click', start);
ui.cancel.addEventListener('click', () => { engine.cancel(); ui.cancel.disabled = true; ui.start.disabled = false; setLog('已取消；已完成的证据仍保留。'); });
ui.mode.addEventListener('change', () => {
  const simulation = ui.mode.value === 'SIMULATION';
  ui.banner.className = `mode-banner ${simulation ? 'simulation' : 'real'}`;
  ui.banner.textContent = simulation ? '模拟数据：用于验证软件流程，不代表学习板已下板通过。' : '真实串口模式：不生成模拟 PASS；需使用已实际编译和烧录的角色固件。';
  setLog(simulation ? '软件模拟器已启用。' : '真实模式已选择；请按下板验证流程连接设备。');
});
ui.attempts.addEventListener('click', async event => {
  const retest = event.target.closest('[data-retest]');
  if (retest) {
    for (const [name, checkbox] of Object.entries(ui.faults)) rig.setFault(name, checkbox.checked);
    const attempt = await engine.retest(retest.dataset.retest);
    renderAttempts(currentRun); showEvidence(attempt); await persist(); setLog(`${attempt.testId} 已产生新 attempt #${attempt.attempt}。`); return;
  }
  const row = event.target.closest('[data-attempt]');
  if (row) showEvidence(currentRun.attempts.find(item => item.attempt === Number(row.dataset.attempt)));
});
ui.json.addEventListener('click', () => downloadText(`acceptance-${currentRun.uuid}.json`, exportRunJson(currentRun), 'application/json'));
ui.html.addEventListener('click', () => downloadText(`acceptance-${currentRun.uuid}.html`, exportRunHtml(currentRun), 'text/html'));
