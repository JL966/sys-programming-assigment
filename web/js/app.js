import { AcceptanceEngine } from './engine.js';
import { PLANS } from './catalog.js';
import { SimulatedRig } from './simulator.js';
import { NodeConnectionManager } from './connection-manager.js';
import { RealRig } from './real-rig.js';
import { EvidenceStore, IndexedDbBackend, MemoryBackend } from './storage.js';
import { assessRun, downloadText, exportRunHtml, exportRunJson, summarizeRun } from './report.js';

const $ = selector => document.querySelector(selector);
const ui = {
  mode: $('#mode-select'), banner: $('#mode-banner'), plan: $('#plan-select'), start: $('#start-button'), cancel: $('#cancel-button'),
  nodes: $('#node-grid'), nodeCount: $('#node-count'), attempts: $('#attempt-list'), evidence: $('#evidence-panel'), summary: $('#summary'),
  json: $('#export-json'), html: $('#export-html'), log: $('#status-log'),
  connections: $('#serial-connections'),
  writeAuthorization: $('#write-authorization'),
  faults: { irBlocked: $('#fault-ir'), rs485Disconnected: $('#fault-485'), rtcStopped: $('#fault-rtc'), eepromMismatch: $('#fault-eeprom') }
};

const rig = new SimulatedRig();
let engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION', persistRun: persist });
const connections = new NodeConnectionManager();
let realRig = null;
let store = new EvidenceStore(new IndexedDbBackend());
let currentRun = null;
let runGeneration = 0;

connections.addEventListener('change', () => {
  if (ui.mode.value === 'REAL') renderNodes(connections.identities);
  for (const button of ui.connections.querySelectorAll('[data-connect]')) {
    const connected = Boolean(connections.clients[button.dataset.connect]);
    button.textContent = `${connected ? '断开' : '连接'} ${button.dataset.connect}`;
    button.classList.toggle('connected', connected);
  }
});

function setLog(text) { ui.log.textContent = text; }
function safe(value) { return String(value ?? '—'); }

function renderNodes(nodes) {
  const entries = Object.values(nodes || {});
  ui.nodeCount.textContent = `${entries.filter(node => node.online).length}/${entries.length} 在线`;
  ui.nodes.innerHTML = entries.length ? entries.map(node => `<div class="node ${node.online ? '' : 'offline'}"><strong>${safe(node.role)}</strong><small>${node.online ? 'ONLINE' : 'OFFLINE'}</small><small>板号 ${safe(node.boardId)} · FW ${safe(node.firmware)}</small><small>档案 ${safe(node.profile)} · 能力 0x${Number(node.capabilities ?? 0).toString(16).padStart(4, '0')}</small></div>`).join('') : '<p class="empty">尚未连接任何角色节点。</p>';
}

function renderAttempts(run) {
  const summary = summarizeRun(run);
  const assessment = assessRun(run);
  ui.summary.textContent = `当前通过 ${summary.passed} · 失败 ${summary.failed} · 阻塞/待判 ${summary.blocked}` +
    (assessment.qualified ? ' · 自动摘要可生成' : ' · 未达到自动合格摘要');
  ui.attempts.innerHTML = run.attempts.map(attempt => `<div class="attempt" data-attempt="${attempt.attempt}"><strong>#${attempt.attempt}</strong><div><strong>${attempt.testId} ${safe(attempt.title)}</strong><small>${safe(attempt.diagnosis?.domain)}</small></div><span>${attempt.automation}</span><span class="verdict ${attempt.verdict}">${attempt.verdict}</span><button data-retest="${attempt.testId}">复测</button></div>`).join('');
}

function showEvidence(attempt) { ui.evidence.textContent = JSON.stringify(attempt, null, 2); }

async function persist(run = currentRun) {
  try { await store.saveRun(run); }
  catch (error) {
    store = new EvidenceStore(new MemoryBackend());
    await store.saveRun(run);
    setLog(`IndexedDB 不可用，已降级为本页内存保存：${error.message}`);
  }
}

async function start() {
  const generation = ++runGeneration;
  if (ui.mode.value === 'SIMULATION') {
    for (const [name, checkbox] of Object.entries(ui.faults)) rig.setFault(name, checkbox.checked);
    engine = new AcceptanceEngine({ transport: rig, mode: 'SIMULATION', persistRun: persist });
  } else {
    if (!connections.clients.CTRL) { setLog('请先连接并核对 CTRL；快速核心还需要 DUT 与 REF。'); return; }
    if (realRig) await realRig.endSession();
    realRig = new RealRig({ clients: connections.clients, source: 'REAL_HARDWARE',
      allowDestructive: ui.writeAuthorization.checked,
      manualDecision: async definition => {
        const answer = (window.prompt(`${definition.title}：输入 PASS、FAIL 或 UNKNOWN`, 'UNKNOWN') || 'UNKNOWN').trim().toUpperCase();
        const decision = answer === 'PASS' ? 1 : answer === 'FAIL' ? 2 : 3;
        return { decision, operator: window.prompt('操作员姓名或学号', '') || '未署名', at: new Date().toISOString() };
      } });
    engine = new AcceptanceEngine({ transport: realRig, mode: 'REAL_HARDWARE', persistRun: persist });
  }
  const plan = PLANS[Number(ui.plan.value)];
  ui.start.disabled = true; ui.cancel.disabled = false; ui.mode.disabled = true; setLog(`正在执行：${plan.title}`);
  try {
    const run = await engine.startRun({ planId: plan.id, testIds: plan.tests });
    if (generation !== runGeneration) return;
    currentRun = run;
    renderNodes(currentRun.nodes); renderAttempts(currentRun); await persist();
    ui.json.disabled = ui.html.disabled = false;
    setLog(`运行完成，保留 ${currentRun.attempts.length} 条 attempt。`);
  } catch (error) { setLog(`运行失败：${error.message}`); }
  finally {
    if (generation === runGeneration) { ui.start.disabled = false; ui.cancel.disabled = true; ui.mode.disabled = false; }
  }
}

ui.start.addEventListener('click', start);
ui.cancel.addEventListener('click', () => { engine.cancel(); ui.cancel.disabled = true; ui.start.disabled = false; setLog('已取消；已完成的证据仍保留。'); });
ui.mode.addEventListener('change', () => {
  runGeneration += 1;
  if (engine.active) engine.cancel();
  const simulation = ui.mode.value === 'SIMULATION';
  currentRun = null; ui.attempts.innerHTML = '<p class="empty">切换来源后需开始新的运行，历史数据不会混入本轮。</p>';
  if (simulation && realRig) { void realRig.endSession(); realRig = null; }
  ui.summary.textContent = '等待运行'; ui.evidence.textContent = '选择一个测试项目查看。';
  ui.json.disabled = ui.html.disabled = true; ui.writeAuthorization.checked = false;
  ui.start.disabled = false; ui.cancel.disabled = true; ui.mode.disabled = false;
  ui.writeAuthorization.disabled = simulation;
  ui.banner.className = `mode-banner ${simulation ? 'simulation' : 'real'}`;
  ui.banner.textContent = simulation ? '模拟数据：用于验证软件流程，不代表学习板已下板通过。' : '真实串口模式：不生成模拟 PASS；需使用已实际编译和烧录的角色固件。';
  ui.connections.hidden = simulation;
  Object.values(ui.faults).forEach(control => { control.disabled = !simulation; });
  if (!simulation) renderNodes(connections.identities);
  setLog(simulation ? '软件模拟器已启用。' : '真实模式已选择；请按下板验证流程连接设备。');
});
ui.connections.addEventListener('click', async event => {
  const button = event.target.closest('[data-connect]'); if (!button) return;
  const role = button.dataset.connect; button.disabled = true;
  try {
    if (connections.clients[role]) {
      await connections.disconnect(role); button.textContent = `连接 ${role}`; button.classList.remove('connected');
      setLog(`${role} 已断开。`);
    } else {
      const identity = await connections.connect(role); button.textContent = `断开 ${role}`; button.classList.add('connected');
      setLog(`${role} 已核对：板号 ${identity.boardId}，固件 ${identity.firmware}。`);
    }
    renderNodes(connections.identities);
  } catch (error) { setLog(`${role} 连接失败：${error.message}`); }
  finally { button.disabled = false; }
});
ui.attempts.addEventListener('click', async event => {
  const retest = event.target.closest('[data-retest]');
  if (retest) {
    try {
      if (ui.mode.value === 'SIMULATION')
        for (const [name, checkbox] of Object.entries(ui.faults)) rig.setFault(name, checkbox.checked);
      const attempt = await engine.retest(retest.dataset.retest);
      renderAttempts(currentRun); showEvidence(attempt); await persist(); setLog(`${attempt.testId} 已产生新 attempt #${attempt.attempt}。`);
    } catch (error) { setLog(`复测失败：${error.message}`); }
    return;
  }
  const row = event.target.closest('[data-attempt]');
  if (row) showEvidence(currentRun.attempts.find(item => item.attempt === Number(row.dataset.attempt)));
});
ui.json.addEventListener('click', () => downloadText(`acceptance-${currentRun.uuid}.json`, exportRunJson(currentRun), 'application/json'));
ui.html.addEventListener('click', () => downloadText(`acceptance-${currentRun.uuid}.html`, exportRunHtml(currentRun), 'text/html'));
