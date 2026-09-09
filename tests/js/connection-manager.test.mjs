import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeConnectionManager } from '../../web/js/connection-manager.js';
import { VirtualBoard, VirtualSerialTransport } from '../../web/js/virtual-board.js';
import { NODE } from '../../web/js/protocol.js';

test('manager verifies and exposes three distinct role clients', async () => {
  const byRole = { CTRL: NODE.CTRL, DUT: NODE.DUT, REF: NODE.REF };
  const manager = new NodeConnectionManager({ makeTransport: role => {
    const transport = new VirtualSerialTransport(new VirtualBoard({ role: byRole[role] }));
    transport.open = async () => ({ virtual: role }); return transport;
  }});
  for (const role of Object.keys(byRole)) await manager.connect(role);
  assert.deepEqual(Object.keys(manager.clients), ['CTRL', 'DUT', 'REF']);
  assert.equal(manager.identities.CTRL.capabilities, 0xff);
  await assert.rejects(manager.connect('CTRL'), /already connected/);
  await manager.close();
});

test('manager closes a port that reports the wrong firmware role', async () => {
  let closed = false;
  const manager = new NodeConnectionManager({ makeTransport: () => {
    const transport = new VirtualSerialTransport(new VirtualBoard({ role: NODE.DUT }));
    transport.open = async () => ({}); const base = transport.close.bind(transport);
    transport.close = async () => { closed = true; await base(); }; return transport;
  }});
  await assert.rejects(manager.connect('CTRL'), /role mismatch/i);
  assert.equal(closed, true);
});

test('unexpected serial disconnect removes the stale role binding', async () => {
  let transport;
  const manager = new NodeConnectionManager({ makeTransport: () => {
    transport = new VirtualSerialTransport(new VirtualBoard({ role: NODE.CTRL }));
    transport.open = async () => ({}); return transport;
  }});
  await manager.connect('CTRL');
  transport.onDisconnect(new Error('cable removed'));
  assert.equal(manager.clients.CTRL, undefined);
});
