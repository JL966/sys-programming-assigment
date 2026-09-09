import { encodeFrame, FrameStreamDecoder, MESSAGE, NODE } from './protocol.js';

const READS = new Set([MESSAGE.HELLO, MESSAGE.GET_STATUS, MESSAGE.READ_RECORD]);
export class ProtocolClient {
  constructor(transport, node, { timeoutMs = 2000, onFrame = () => {}, onDisconnect = () => {} } = {}) {
    this.transport = transport; this.node = node; this.timeoutMs = timeoutMs;
    this.onFrame = onFrame; this.sequence = 0; this.pending = new Map(); this.closed = false;
    this.decoder = new FrameStreamDecoder({ destination: NODE.PC });
    transport.onBytes = bytes => {
      for (const frame of this.decoder.push(bytes)) {
        this.onFrame({ direction: 'RX', wire: [...frame.wire], at: new Date().toISOString() });
        const p = this.pending.get(frame.seq);
        if (!p || (!p.allowAnySource && frame.src !== this.node) || frame.dst !== NODE.PC || frame.session !== p.session ||
          frame.type !== (p.type | 128) || frame.testId !== p.testId || frame.step !== p.step || !(frame.flags & 1)) continue;
        if (!frame.payload.length) continue;
        if (frame.payload[0] || (frame.flags & 2)) {
          const error = new Error(`node ${this.node}: command status ${frame.payload[0]}`);
          error.status = frame.payload[0]; p.reject(error);
        } else p.resolve(frame);
      }
    };
    transport.onDisconnect = error => {
      const reason = error || new Error('serial disconnected');
      this.abort(reason); onDisconnect(reason);
    };
  }
  abort(error = new Error('client closed')) {
    this.closed = true;
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  async request(type, { session = 0, testId = 0, step = 0, payload = [], retries = 0,
    timeoutMs = this.timeoutMs, destination = this.node, allowAnySource = false } = {}) {
    if (this.closed) throw new Error('client closed');
    if (this.sequence >= 65535) throw new Error('sequence exhausted; reconnect required');
    if (!READS.has(type) && retries) throw new Error('automatic action retry prohibited');
    const seq = ++this.sequence;
    const wire = encodeFrame({ type, src: NODE.PC, dst: destination, session, seq, testId, step, payload });
    for (let attempt = 0; ; attempt++) {
      let timer;
      try {
        return await new Promise((resolve, reject) => {
          this.pending.set(seq, { type, session, testId, step, allowAnySource, resolve, reject });
          timer = setTimeout(() => reject(new Error(`response timeout: node ${this.node}, command ${type}`)), timeoutMs);
          this.onFrame({ direction: 'TX', wire: [...wire], at: new Date().toISOString(), retry: attempt });
          Promise.resolve(this.transport.send(wire)).catch(reject);
        });
      } catch (error) {
        if (this.closed || attempt >= retries || !error.message.includes('timeout')) throw error;
      } finally { clearTimeout(timer); this.pending.delete(seq); }
    }
  }
  async close() { this.abort(); await this.transport.close(); }
}
