const delay = ms => ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();

export class SimulatedRig {
  constructor({ latencyMs = 8, online = {} } = {}) {
    this.latencyMs = latencyMs;
    this.online = { CTRL: true, DUT: true, REF: true, ...online };
    this.faults = { irBlocked: false, rs485Disconnected: false, rtcStopped: false, eepromMismatch: false };
  }

  setFault(name, enabled) {
    if (!(name in this.faults)) throw new RangeError(`unknown simulated fault: ${name}`);
    this.faults[name] = Boolean(enabled);
  }

  async preflight() {
    await delay(this.latencyMs);
    return {
      nodes: Object.fromEntries(Object.entries(this.online).map(([role, isOnline], index) => [role, {
        role, online: isOnline, boardId: 100 + index, protocol: 1,
        firmware: '1.0', profile: role === 'DUT' ? 'DUT_CORE' : `${role}_BASE`
      }]))
    };
  }

  async runTest(definition, context) {
    await delay(this.latencyMs);
    const missing = definition.requiredNodes.find(role => !this.online[role]);
    const common = {
      source: 'SIMULATION', startedAt: new Date().toISOString(), durationMs: this.latencyMs,
      automation: definition.automation, ruleVersion: definition.ruleVersion,
      thresholds: context.thresholds || {}, evidence: {
        ctrlOnline: this.online.CTRL, dutOnline: this.online.DUT, refOnline: this.online.REF
      }
    };
    if (missing) return { ...common, verdict: 'BLOCKED', reason: 'NODE_UNREACHABLE', evidence: { ...common.evidence, missing } };
    if (definition.id === 'T03' && this.faults.irBlocked)
      return { ...common, verdict: 'FAIL', reason: 'RESPONSE_TIMEOUT', evidence: { ...common.evidence, kind: 'infrared', channel: 'IR', trials: 2, valid: 0 } };
    if (definition.id === 'T02' && this.faults.rs485Disconnected)
      return { ...common, verdict: 'FAIL', reason: 'RESPONSE_TIMEOUT', evidence: { ...common.evidence, kind: 'fieldbus', channel: 'RS485', trials: 2, valid: 0 } };
    if (definition.id === 'T04' && this.faults.rtcStopped)
      return { ...common, verdict: 'FAIL', reason: 'DATA_MISMATCH', evidence: { ...common.evidence, kind: 'rtc', before: '12:00:00', after: '12:00:00' } };
    if (definition.id === 'T05' && this.faults.eepromMismatch)
      return { ...common, verdict: 'FAIL', reason: 'RESTORE_FAILED', evidence: { ...common.evidence, kind: 'storage', scratch: '0x10..0x1F', restored: false } };
    if (definition.automation === 'MANUAL')
      return { ...common, verdict: 'INCONCLUSIVE', reason: 'STIMULUS_UNCONFIRMED', evidence: { ...common.evidence, kind: 'manual', awaitingOperator: true } };
    const evidenceByTest = {
      T01: { kind: 'communication', channel: 'UART1', trials: 10, valid: 10, firstTryRate: 1 },
      T02: { kind: 'fieldbus', channel: 'RS485', trials: 4, valid: 4, firstTryRate: 1 },
      T03: { kind: 'infrared', channel: 'IR', trials: 2, valid: 2, firstTryRate: 1 },
      T04: { kind: 'rtc', before: '12:00:00', after: '12:00:10', elapsedSeconds: 10 },
      T05: { kind: 'storage', scratch: '0x10..0x1F', backupCrc: 0x4B37, restored: true },
      T07: { kind: 'sample', channel: 'temperature', baseline: 498, stimulated: 542 },
      T08: { kind: 'sample', channel: 'light', baseline: 620, stimulated: 210, recovered: 615 },
      T09: { kind: 'sample', channel: 'ultrasonic', valuesCm: [20,20,21,20,20] },
      T10: { kind: 'event', events: ['K1_PRESS','K1_RELEASE'] },
      T14: { kind: 'performance', mainLoops: 4321, pollingMisses: 0 }
    };
    return { ...common, verdict: 'PASS', reason: 'NONE', evidence: { ...common.evidence, ...(evidenceByTest[definition.id] || { kind: 'summary' }) } };
  }

  async close() { return undefined; }
}
