import { NODE, MESSAGE, PROTOCOL_VERSION } from './protocol.js';
import { ProtocolClient } from './protocol-client.js';
import { SerialTransport } from './serial-transport.js';

const ROLE_NODE = Object.freeze({ CTRL: NODE.CTRL, DUT: NODE.DUT, REF: NODE.REF });

export class NodeConnectionManager extends EventTarget {
  constructor({ makeTransport = () => new SerialTransport(), timeoutMs = 2000 } = {}) {
    super(); this.makeTransport = makeTransport; this.timeoutMs = timeoutMs;
    this.slots = new Map();
  }
  get clients() { return Object.fromEntries([...this.slots].map(([role, slot]) => [role, slot.client])); }
  get identities() { return Object.fromEntries([...this.slots].map(([role, slot]) => [role, slot.identity])); }

  async connect(role) {
    if (!ROLE_NODE[role]) throw new RangeError(`unknown role: ${role}`);
    if (this.slots.has(role)) throw new Error(`${role} is already connected`);
    const transport = this.makeTransport(role);
    try {
      const portInfo = await transport.open();
      const client = new ProtocolClient(transport, ROLE_NODE[role], { timeoutMs: this.timeoutMs,
        onDisconnect: () => {
          if (this.slots.get(role)?.client === client) {
            this.slots.delete(role);
            Promise.resolve(transport.close()).catch(() => {});
            this.dispatchEvent(new CustomEvent('change', { detail: this.identities }));
          }
        } });
      const hello = await client.request(MESSAGE.HELLO, { retries: 1,
        destination: NODE.BROADCAST, allowAnySource: true });
      const p = hello.payload;
      if (p[1] !== ROLE_NODE[role]) throw new Error(`role mismatch: expected ${role}, received ${p[1]}`);
      if (p[2] !== PROTOCOL_VERSION) throw new Error(`protocol mismatch: expected ${PROTOCOL_VERSION}, received ${p[2]}`);
      const caps = await client.request(MESSAGE.HELLO, { step: 1, retries: 1,
        destination: NODE.BROADCAST, allowAnySource: true });
      const identity = { role, online: true, protocol: p[2], firmware: `${p[3]}.${p[4]}`,
        profile: p[5], boardId: p[6] | (p[7] << 8), capabilities: caps.payload[3] | (caps.payload[4] << 8), portInfo };
      this.slots.set(role, { transport, client, identity });
      this.dispatchEvent(new CustomEvent('change', { detail: this.identities }));
      return identity;
    } catch (error) { await transport.close().catch(() => {}); throw error; }
  }

  async disconnect(role) {
    const slot = this.slots.get(role); if (!slot) return;
    this.slots.delete(role); await slot.client.close();
    this.dispatchEvent(new CustomEvent('change', { detail: this.identities }));
  }
  async close() { await Promise.all([...this.slots.keys()].map(role => this.disconnect(role))); }
}
