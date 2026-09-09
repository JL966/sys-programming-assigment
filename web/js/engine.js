import { TEST_CATALOG } from './catalog.js';
import { diagnoseAttempt } from './diagnostics.js';

const makeUuid = () => globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class AcceptanceEngine extends EventTarget {
  #transport;
  #active = false;
  #generation = 0;
  #attempt = 0;
  #persistRun;

  constructor({ transport, mode = 'REAL', thresholds = {}, persistRun = async () => {} }) {
    super();
    if (!transport) throw new TypeError('transport is required');
    this.#transport = transport;
    this.mode = mode;
    this.thresholds = Object.freeze({ ...thresholds });
    this.#persistRun = persistRun;
    this.currentRun = null;
  }

  get active() { return this.#active; }

  async startRun({ planId, testIds }) {
    if (this.#active) throw new Error('a run is already active');
    if (!Array.isArray(testIds) || testIds.length === 0) throw new RangeError('testIds cannot be empty');
    for (const id of testIds) if (!TEST_CATALOG[id]) throw new RangeError(`unknown test: ${id}`);
    this.#active = true;
    const generation = ++this.#generation;
    const run = {
      uuid: makeUuid(), planId, testIds: [...testIds], mode: this.mode, source: this.mode,
      startedAt: new Date().toISOString(), endedAt: null, status: 'RUNNING',
      config: { thresholds: this.thresholds }, nodes: {}, attempts: []
    };
    this.currentRun = run;
    try {
      const preflight = await this.#transport.preflight();
      if (generation !== this.#generation) return run;
      run.nodes = preflight.nodes;
      for (const id of testIds) {
        if (generation !== this.#generation) break;
        await this.#execute(id, run, generation);
      }
      run.status = generation === this.#generation ? 'COMPLETED' : 'ABORTED';
      run.endedAt = new Date().toISOString();
      return run;
    } finally {
      if (generation === this.#generation) this.#active = false;
    }
  }

  async #execute(testId, run, generation) {
    const definition = TEST_CATALOG[testId];
    const attemptNumber = ++this.#attempt;
    const raw = await this.#transport.runTest(definition, {
      runUuid: run.uuid, attempt: attemptNumber, thresholds: this.thresholds, nodes: run.nodes
    });
    if (generation !== this.#generation) return null;
    const { releaseResult, ...result } = raw;
    const attempt = {
      attempt: attemptNumber, parentAttempt: null, testId,
      title: definition.title, automation: definition.automation,
      destructive: definition.destructive, ...result
    };
    attempt.diagnosis = diagnoseAttempt(attempt);
    run.attempts.push(attempt);
    this.dispatchEvent(new CustomEvent('attempt', { detail: attempt }));
    await this.#persistRun(run);
    if (releaseResult) await releaseResult();
    return attempt;
  }

  async retest(testId) {
    if (!this.currentRun) throw new Error('no run to retest');
    if (this.#active) throw new Error('a run is already active');
    if (!TEST_CATALOG[testId]) throw new RangeError(`unknown test: ${testId}`);
    this.#active = true;
    const generation = this.#generation;
    const previous = [...this.currentRun.attempts].reverse().find(item => item.testId === testId);
    try {
      const attempt = await this.#execute(testId, this.currentRun, generation);
      if (attempt) attempt.parentAttempt = previous?.attempt ?? null;
      return attempt;
    } finally {
      this.#active = false;
    }
  }

  cancel() {
    if (!this.#active) return false;
    this.#generation += 1;
    this.#active = false;
    if (this.currentRun) {
      this.currentRun.status = 'ABORTED';
      this.currentRun.endedAt = new Date().toISOString();
    }
    Promise.resolve(this.#transport.cancel?.()).catch(() => {});
    return true;
  }
}
