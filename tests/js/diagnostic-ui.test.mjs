import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const page = await readFile(new URL('web/index.html', root), 'utf8');
const styles = await readFile(new URL('web/style.css', root), 'utf8');
const app = await readFile(new URL('web/js/diagnostic-app.js', root), 'utf8');

test('diagnostic dashboard keeps functional controls in one compact operations panel', () => {
  for (const id of ['connect', 'aux', 'swap', 'all', 'test', 'single', 'cancel', 'history', 'resume', 'task', 'list']) {
    assert.match(page, new RegExp(`id="${id}"`), `missing existing control #${id}`);
  }
  assert.match(page, /<main class="app-shell">/);
  assert.match(page, /class="workspace-bar"/);
  assert.match(page, /class="operation-panel panel"/);
  assert.match(page, /class="[^"]*\bconnection-zone\b[^"]*"/);
  assert.match(page, /class="[^"]*\bdiagnosis-zone\b[^"]*"/);
  assert.match(page, /id="toggle-list"/);
  assert.match(page, /class="[^"]*\baction-bar\b[^"]*"/);
  assert.match(page, /class="[^"]*\btask-card\b[^"]*"/);
  assert.doesNotMatch(page, /<h1\b/);
  assert.doesNotMatch(page, /compact-workflow/);
});

test('connection indicator is a live UI value refreshed by board connection flows', () => {
  assert.match(page, /id="connection-state"/);
  assert.match(app, /function refreshConnectionStatus\(\)/);
  assert.match(app, /\$\('connection-state'\)\.textContent=board\?\.connected\?'被测板已连接':'被测板待连接'/);
  assert.match(app, /refreshConnectionStatus\(\);/);
});

test('diagnostic stylesheet provides an uncluttered tool layout and mobile actions', () => {
  for (const token of ['--paper:', '--ink:', '--accent:', '--warning:', '--fault:']) {
    assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(styles, /\.workspace-bar\s*\{/);
  assert.match(styles, /\.operation-panel\s*\{/);
  assert.match(styles, /\.connection-zone, \.diagnosis-zone\s*\{/);
  assert.match(styles, /\.diagnosis-zone\s*\{/);
  assert.match(styles, /\.action-bar\s*\{/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
});

test('result rows reserve one aligned status column and respect reduced motion', () => {
  assert.match(app, /row \$\{i\.status\} row-enter/);
  assert.match(styles, /\.row-title, summary\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('result list can be collapsed without changing diagnostic data', () => {
  assert.match(app, /\$\('toggle-list'\)\.onclick/);
  assert.match(app, /\$\('list'\)\.hidden=/);
  assert.match(app, /setAttribute\('aria-expanded'/);
});

test('diagnostic result card starts with its detailed list collapsed', () => {
  assert.match(page, /class="result-panel panel"/);
  assert.match(page, /id="toggle-list"[^>]*aria-expanded="false"[^>]*>展开清单</);
  assert.match(page, /<section id="list"[^>]*hidden[^>]*>/);
});

test('visual polish uses a warm primary action and low-distraction CSS ambient particles', () => {
  assert.match(styles, /--warm:/);
  assert.match(styles, /--warm-strong:/);
  assert.match(styles, /body::before\s*\{/);
  assert.match(styles, /body::before\s*\{[^}]*radial-gradient/s);
  assert.match(styles, /@keyframes\s+ambient-drift/);
  assert.match(styles, /\.primary\s*\{[^}]*background:\s*var\(--warm\)/s);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[^}]*animation-duration/s);
});

test('surface panels use a translucent glass treatment and particles softly fade', () => {
  assert.match(styles, /\.panel\s*\{[^}]*backdrop-filter:\s*blur\(/s);
  assert.match(styles, /\.panel\s*\{[^}]*background:\s*rgb\([^)]+\/\s*\d+%\)/s);
  assert.match(styles, /@keyframes\s+particle-fade/);
  assert.match(styles, /particle-fade/);
});

test('ambient particles span the viewport instead of clustering at two corners', () => {
  assert.match(styles, /body::before, body::after\s*\{[^}]*width:\s*100vw[^}]*height:\s*100vh/s);
});

test('ambient particle field has faster staggered movement with varied dot sizes', () => {
  assert.match(styles, /ambient-drift 8s/);
  assert.match(styles, /ambient-drift 11s/);
  assert.match(styles, /0 2px, transparent 3px/);
  assert.match(styles, /0 7px, transparent 8px/);
  assert.match(styles, /particle-fade 3\.8s/);
});
