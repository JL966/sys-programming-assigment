const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class SerialTransport {
  #serial;
  #port;
  #reader;
  #writer;
  #readTask;
  #sendChain = Promise.resolve();
  #closing = false;

  constructor({ serial = globalThis.navigator?.serial, baudRate = 2400, frameGapMs = 20, sleep = defaultSleep, onBytes = () => {} } = {}) {
    this.#serial = serial;
    this.baudRate = baudRate;
    this.frameGapMs = frameGapMs;
    this.sleep = sleep;
    this.onBytes = onBytes;
  }

  get connected() { return Boolean(this.#port); }

  async open() {
    if (!this.#serial?.requestPort) throw new Error('Web Serial 不可用，请使用 Chrome 或 Edge 通过 http://localhost 打开页面');
    if (this.#port) return this.#port.getInfo?.() || {};
    this.#closing = false;
    this.#port = await this.#serial.requestPort();
    await this.#port.open({ baudRate: this.baudRate, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    this.#writer = this.#port.writable.getWriter();
    this.#readTask = this.#readLoop();
    return this.#port.getInfo?.() || {};
  }

  async #readLoop() {
    this.#reader = this.#port.readable.getReader();
    try {
      while (!this.#closing) {
        const { value, done } = await this.#reader.read();
        if (done) break;
        if (value?.length) this.onBytes(Uint8Array.from(value));
      }
    } finally {
      this.#reader.releaseLock();
      this.#reader = null;
    }
  }

  send(bytes) {
    const payload = Uint8Array.from(bytes);
    this.#sendChain = this.#sendChain.catch(() => {}).then(async () => {
      if (!this.#writer) throw new Error('serial port is not open');
      await this.#writer.write(payload);
      const wireMs = Math.ceil(payload.length * 10000 / this.baudRate);
      await this.sleep(wireMs + this.frameGapMs);
    });
    return this.#sendChain;
  }

  async close() {
    if (!this.#port) return;
    this.#closing = true;
    if (this.#reader) await this.#reader.cancel().catch(() => {});
    await this.#readTask?.catch(() => {});
    await this.#sendChain.catch(() => {});
    if (this.#writer) {
      this.#writer.releaseLock();
      this.#writer = null;
    }
    await this.#port.close();
    this.#port = null;
  }
}
