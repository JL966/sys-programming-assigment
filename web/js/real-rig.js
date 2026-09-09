import { crc16, MESSAGE, NODE, PROTOCOL_VERSION } from './protocol.js';
import { decodeRecord, decodeResultBody } from './record-codec.js';

const NODES = Object.freeze({ CTRL: NODE.CTRL, DUT: NODE.DUT, REF: NODE.REF });
const PROFILE_CODES = Object.freeze({ CTRL_BASE: 1, REF_BASE: 2, DUT_CORE: 3,
  DUT_ULTRA: 4, DUT_AUDIO_STEP: 5, DUT_MOTOR: 6 });
const VERDICTS = ['INCONCLUSIVE', 'INCONCLUSIVE', 'PASS', 'FAIL', 'BLOCKED',
  'INCONCLUSIVE', 'SKIPPED', 'ABORTED'];
const REASONS = ['NONE', 'RESPONSE_TIMEOUT', 'DATA_MISMATCH', 'NODE_UNREACHABLE',
  'PRECONDITION_MISSING', 'USER_REJECTED', 'USER_CANCELLED', 'INVALID_SAMPLE',
  'EVIDENCE_GAP', 'RESTORE_FAILED', 'PROFILE_UNSUPPORTED', 'SCHEDULING_OVERLOAD',
  'STORAGE_ERROR', 'REBOOT_DETECTED', 'STIMULUS_UNCONFIRMED', 'LEASE_EXPIRED'];
const sleep = ms => ms ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
const put16 = (out, at, value) => { out[at] = value & 0xff; out[at + 1] = value >>> 8; };
const supportsProfile = (node, required) => {
  if (!required || !node) return true;
  if (typeof node.profile === 'string') return node.profile === required;
  return Number(node.profile) === PROFILE_CODES[required];
};

export class RealRig {
  constructor({ clients, source = 'REAL_HARDWARE', pollMs = 50, allowDestructive = false,
    manualDecision = async () => 3 }) {
    this.clients = clients; this.source = source; this.pollMs = pollMs;
    this.allowDestructive = allowDestructive; this.manualDecision = manualDecision;
    this.session = ((Date.now() ^ Math.floor(Math.random() * 0xffff)) & 0xffff) || 1;
    this.ready = false; this.nodes = {};
  }

  async preflight() {
    const nodes = {};
    for (const [name, client] of Object.entries(this.clients)) {
      const frame = await client.request(MESSAGE.HELLO, { retries: 1 });
      const p = frame.payload;
      if (p[1] !== NODES[name]) throw new Error(`role mismatch: ${name} slot reported node ${p[1]}`);
      if (p[2] !== PROTOCOL_VERSION) throw new Error(`protocol mismatch on ${name}`);
      const caps = await client.request(MESSAGE.HELLO, { step: 1, retries: 1 });
      nodes[name] = { role: name, online: true, protocol: p[2], firmware: `${p[3]}.${p[4]}`,
        profile: p[5], boardId: p[6] | (p[7] << 8), capabilities: caps.payload[3] | (caps.payload[4] << 8) };
    }
    if (!nodes.CTRL) throw new Error('CTRL connection is required');
    const config = this.allowDestructive ? Uint8Array.from([5, 1, 0, 0, 0, 0, 0, 0]) : new Uint8Array();
    const configCrc = crc16(config);
    if (!this.ready) {
      const begin = new Uint8Array(8); begin[0] = 0x41; begin[4] = 1;
      begin[5] = configCrc & 0xff; begin[6] = configCrc >>> 8; begin[7] = NODE.PC;
      await this.clients.CTRL.request(MESSAGE.BEGIN_SESSION, { session: this.session, payload: begin });
      if (config.length) await this.clients.CTRL.request(MESSAGE.CONFIG_WRITE,
        { session: this.session, payload: config });
      await this.clients.CTRL.request(MESSAGE.CONFIG_COMMIT, { session: this.session,
        payload: [configCrc & 0xff, configCrc >>> 8] });
    }
    this.nodes = nodes; this.ready = true;
    return { nodes };
  }

  async runTest(definition) {
    if (!this.ready) throw new Error('real rig is not ready');
    const missing = definition.requiredNodes.find(role => !this.nodes[role]);
    if (missing) return { source: this.source, verdict: 'BLOCKED', reason: 'NODE_UNREACHABLE',
      startedAt: new Date().toISOString(), durationMs: 0, ruleVersion: definition.ruleVersion,
      evidence: { missing, kind: 'preflight' } };
    if (definition.requiredNodes.includes('DUT') && !supportsProfile(this.nodes.DUT, definition.profile))
      return { source: this.source, verdict: 'BLOCKED', reason: 'PROFILE_UNSUPPORTED',
        startedAt: new Date().toISOString(), durationMs: 0, ruleVersion: definition.ruleVersion,
        evidence: { kind: 'profile', required: definition.profile, actual: this.nodes.DUT.profile } };
    if (definition.destructive && !this.allowDestructive)
      return { source: this.source, verdict: 'BLOCKED', reason: 'PRECONDITION_MISSING',
        startedAt: new Date().toISOString(), durationMs: 0, ruleVersion: definition.ruleVersion,
        evidence: { kind: 'safety-gate', writeAuthorization: false } };
    const id = Number(definition.id.slice(1));
    const mask = 1 << (id - 1), run = new Uint8Array(3); run[0] = 1; put16(run, 1, mask);
    await this.clients.CTRL.request(MESSAGE.RUN_PLAN, { session: this.session, testId: id, payload: run });
    let status;
    let manualEvidence;
    let manualExpired = false;
    if (definition.automation === 'MANUAL') {
      status = await this.clients.CTRL.request(MESSAGE.GET_STATUS, { session: this.session, retries: 1 });
      const attempt = status.payload[2] | (status.payload[3] << 8);
      const manual = await this.manualDecision(definition);
      const requestedDecision = typeof manual === 'object' ? manual.decision : manual;
      const decision = [1, 2, 3].includes(Number(requestedDecision)) ? Number(requestedDecision) : 3;
      manualEvidence = typeof manual === 'object' ? { operator: manual.operator || '未署名', at: manual.at || new Date().toISOString(), decision } : undefined;
      try {
        await this.clients.CTRL.request(MESSAGE.HUMAN_CONFIRM, { session: this.session, testId: id,
          payload: [attempt & 0xff, attempt >>> 8, decision] });
      } catch (error) {
        if (error.status !== 4) throw error;
        manualExpired = true;
      }
    }
    for (let poll = 0; poll < 100; poll++) {
      status = await this.clients.CTRL.request(MESSAGE.GET_STATUS, { session: this.session, retries: 1 });
      if ((status.payload[6] | (status.payload[7] << 8)) !== 0) break;
      await sleep(this.pollMs);
    }
    const recordId = status.payload[6] | (status.payload[7] << 8);
    if (!recordId) throw new Error(`record timeout for ${definition.id}`);
    const bytes = []; let expected = Infinity;
    for (let chunk = 0; bytes.length < expected; chunk++) {
      const rsp = await this.clients.CTRL.request(MESSAGE.READ_RECORD, { session: this.session,
        testId: id, payload: [recordId & 0xff, recordId >>> 8, chunk], retries: 1 });
      bytes.push(...rsp.payload.slice(4));
      if (bytes.length >= 6) expected = 6 + bytes[2] + (bytes[3] << 8);
      if (chunk > 64) throw new Error('record exceeds safety limit');
    }
    const record = decodeRecord(Uint8Array.from(bytes.slice(0, expected)));
    const result = decodeResultBody(record.body);
    return { source: this.source, verdict: VERDICTS[result.verdict] || 'INCONCLUSIVE',
      reason: REASONS[result.reason] || 'BAD_RECORD', startedAt: new Date().toISOString(),
      durationMs: result.durationMs, ruleVersion: definition.ruleVersion,
      evidence: { kind: ['summary','communication','fieldbus','infrared','rtc','storage'][id] || 'result',
        recordId, schema: record.schema, bodyCrc: record.bodyCrc, valid: result.valid, errors: result.errors,
        manual: manualEvidence, manualExpired },
      releaseResult: () => this.clients.CTRL.request(MESSAGE.RELEASE_RESULT, { session: this.session,
        testId: id, payload: [recordId & 0xff, recordId >>> 8] }) };
  }

  async cancel() {
    if (this.ready) await this.clients.CTRL.request(MESSAGE.CANCEL_TEST, { session: this.session, payload: [0, 0, 0] });
  }

  async endSession() {
    if (this.ready) await this.clients.CTRL.request(MESSAGE.CLOSE_SESSION, { session: this.session }).catch(() => {});
    this.ready = false;
  }

  async close() {
    await this.endSession();
    await Promise.all(Object.values(this.clients).map(client => client.close()));
  }
}
