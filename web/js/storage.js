import { crc16 } from './protocol.js';

const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export class MemoryBackend {
  #runs = new Map();
  async put(run) { this.#runs.set(run.uuid, clone(run)); }
  async get(uuid) { const value = this.#runs.get(uuid); return value ? clone(value) : null; }
  async values() { return [...this.#runs.values()].map(clone); }
}

export class IndexedDbBackend {
  #databaseName;
  #dbPromise;
  constructor(databaseName = 'learning-board-acceptance-v1') { this.#databaseName = databaseName; }
  #open() {
    if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB unavailable'));
    if (!this.#dbPromise) this.#dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('runs', { keyPath: 'uuid' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
    return this.#dbPromise;
  }
  async #transaction(mode, work) {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('runs', mode);
      const request = work(tx.objectStore('runs'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  }
  put(run) { return this.#transaction('readwrite', store => store.put(clone(run))); }
  get(uuid) { return this.#transaction('readonly', store => store.get(uuid)); }
  values() { return this.#transaction('readonly', store => store.getAll()); }
}

export class EvidenceStore {
  constructor(backend = new IndexedDbBackend()) {
    this.backend = backend;
    this.destructiveAuthorized = false;
  }
  async saveRun(run) {
    if (!run?.uuid) throw new TypeError('run uuid is required');
    await this.backend.put(run);
    return run;
  }
  async getRun(uuid) { return (await this.backend.get(uuid)) || null; }
  async listPendingRestores() { return (await this.backend.values()).filter(run => run.pendingRestore === true); }
  async persistBeforeDestructive(run) {
    this.destructiveAuthorized = false;
    await this.saveRun(run);
    this.destructiveAuthorized = true;
    return true;
  }
  closeDestructiveGate() { this.destructiveAuthorized = false; }
}

export class FragmentAssembler {
  #chunks = new Map();
  constructor({ bodyLength, bodyCrc }) {
    if (!Number.isInteger(bodyLength) || bodyLength < 0 || bodyLength > 1024) throw new RangeError('invalid body length');
    this.bodyLength = bodyLength;
    this.bodyCrc = bodyCrc;
  }
  add(index, bytes) {
    if (!Number.isInteger(index) || index < 0 || index > 255) throw new RangeError('invalid chunk index');
    const incoming = Uint8Array.from(bytes);
    const existing = this.#chunks.get(index);
    if (existing) {
      if (existing.length !== incoming.length || existing.some((value, i) => value !== incoming[i]))
        throw new Error(`record fragment conflict at chunk ${index}`);
      return false;
    }
    this.#chunks.set(index, incoming);
    return true;
  }
  assemble() {
    const count = Math.ceil(this.bodyLength / 4);
    const body = new Uint8Array(this.bodyLength);
    for (let index = 0; index < count; index += 1) {
      const chunk = this.#chunks.get(index);
      if (!chunk) throw new Error(`record fragment ${index} missing`);
      body.set(chunk.subarray(0, Math.min(4, this.bodyLength - index * 4)), index * 4);
    }
    if (crc16(body) !== this.bodyCrc) throw new Error('record body CRC mismatch');
    return body;
  }
}
