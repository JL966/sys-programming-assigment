import test from 'node:test';
import assert from 'node:assert/strict';
import { SerialTransport } from '../../web/js/serial-transport.js';

function fakeSerial() {
  const state = { writes: [], opened: null, writerReleased: false, readerReleased: false, closed: false };
  let endRead;
  const reader = {
    async read() { return new Promise(resolve => { endRead = resolve; }); },
    async cancel() { endRead?.({ done: true, value: undefined }); },
    releaseLock() { state.readerReleased = true; }
  };
  const writer = {
    async write(value) { state.writes.push([...value]); },
    releaseLock() { state.writerReleased = true; }
  };
  const port = {
    readable: { getReader: () => reader }, writable: { getWriter: () => writer },
    async open(options) { state.opened = options; }, async close() { state.closed = true; },
    getInfo() { return { usbVendorId: 0x1A86, usbProductId: 0x7523 }; }
  };
  state.endRead = () => endRead?.({ done: true, value: undefined });
  return { state, api: { async requestPort() { return port; } } };
}

test('concurrent sends are serialized in submission order', async () => {
  const fake = fakeSerial();
  const transport = new SerialTransport({ serial: fake.api, baudRate: 2400, frameGapMs: 0, sleep: async () => {} });
  await transport.open();
  await Promise.all([transport.send(Uint8Array.of(1)), transport.send(Uint8Array.of(2))]);
  assert.deepEqual(fake.state.writes, [[1], [2]]);
  assert.deepEqual(fake.state.opened, { baudRate: 2400, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
});

test('close releases both Web Serial locks and closes the port', async () => {
  const fake = fakeSerial();
  const transport = new SerialTransport({ serial: fake.api, frameGapMs: 0, sleep: async () => {} });
  await transport.open();
  await transport.close();
  assert.equal(fake.state.readerReleased, true);
  assert.equal(fake.state.writerReleased, true);
  assert.equal(fake.state.closed, true);
});

test('missing Web Serial API produces an actionable error', async () => {
  const transport = new SerialTransport({ serial: null });
  await assert.rejects(transport.open(), /Chrome|Edge/);
});

test('unexpected EOF releases writer and port before disconnect notification', async () => {
  const fake = fakeSerial();
  let disconnected = false;
  const transport = new SerialTransport({ serial: fake.api, frameGapMs: 0, sleep: async () => {} });
  transport.onDisconnect = () => { disconnected = fake.state.writerReleased && fake.state.closed; };
  await transport.open();
  fake.state.endRead();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(disconnected, true);
  assert.equal(transport.connected, false);
});
