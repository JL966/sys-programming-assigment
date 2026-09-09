import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const page = await readFile(new URL('web/index.html', root), 'utf8');
const styles = await readFile(new URL('web/style.css', root), 'utf8');

test('diagnostic dashboard keeps functional controls inside a clear field workflow', () => {
  for (const id of ['connect', 'aux', 'swap', 'all', 'test', 'single', 'cancel', 'history', 'resume', 'task', 'list']) {
    assert.match(page, new RegExp(`id="${id}"`), `missing existing control #${id}`);
  }
  assert.match(page, /<main class="app-shell">/);
  assert.match(page, /class="connection-status"/);
  assert.match(page, /aria-label="诊断流程"/);
  assert.match(page, /class="[^"]*\baction-bar\b[^"]*"/);
  assert.match(page, /class="task-card"/);
});

test('diagnostic stylesheet defines a restrained field-notebook visual system and mobile action layout', () => {
  for (const token of ['--paper:', '--ink:', '--accent:', '--warning:', '--fault:']) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(styles, /\.connection-status\s*\{/);
  assert.match(styles, /\.action-bar\s*\{/);
  assert.match(styles, /\.workflow\s*\{/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
});
