import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {
  approvedArrowCoordinateSignature,
  boardArrows,
  boardCallouts,
  componentOverviewImage,
  extensionColumns,
  learningBoardImage
} from '../../web/js/learning-board-data.js';

const root=new URL('../../',import.meta.url);
const page=await readFile(new URL('web/index.html',root),'utf8');
const styles=await readFile(new URL('web/style.css',root),'utf8');
const app=await readFile(new URL('web/js/diagnostic-app.js',root),'utf8');

function coordinateSignature(){
  return boardArrows.map(arrow=>arrow.type==='polyline'?arrow.points:[arrow.x1,arrow.y1,arrow.x2,arrow.y2].join(',')).join('|');
}

test('approved board arrows and all diagnostic associations are preserved',()=>{
  assert.equal(boardArrows.length,19);
  assert.equal(boardCallouts.length,18);
  assert.equal(coordinateSignature(),approvedArrowCoordinateSignature);
  const ids=new Set(boardCallouts.flatMap(item=>item.association).map(text=>Number(text.slice(0,2))));
  assert.deepEqual([...ids].sort((a,b)=>a-b),Array.from({length:23},(_,index)=>index+1));
});

test('all local learning-board images exist and seven extension devices are listed',async()=>{
  const devices=extensionColumns.flat();
  assert.equal(extensionColumns.length,2);
  assert.equal(devices.length,7);
  for(const path of [learningBoardImage,componentOverviewImage,...devices.map(item=>item.image)]){
    await access(new URL(`web/${path}`,root));
  }
});

test('learning board sits above diagnostics with three tabs and a plain fold label',()=>{
  assert(page.indexOf('id="learning-board"')<page.indexOf('class="operation-panel panel"'));
  for(const tab of ['board','components','extensions'])assert.match(page,new RegExp(`data-learning-tab="${tab}"`));
  assert.match(page,/id="learning-fold"[^>]*aria-expanded="false"[^>]*>展开</);
  assert.match(page,/class="learning-panels is-collapsed"/);
  assert.doesNotMatch(page,/id="learning-fold"[^>]*[↑↓⌃⌄]/);
});

test('independent extension columns, visible arrows and motion preferences are styled',()=>{
  assert.match(styles,/\.learning-extension-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.match(styles,/\.learning-extension-column\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(styles,/\.learning-lines line[^}]*stroke-width:\s*3/s);
  assert.match(styles,/\.learning-lines[^}]*color: var\(--fault\)/);
  assert.match(styles,/grid-template-rows 340ms/);
  assert.match(styles,/prefers-reduced-motion:\s*reduce/);
});

test('manual choices no longer expose an ambiguous third result',()=>{
  assert.match(app,/buttons\.filter\(value=>value!=='无法确认'\)/);
  assert.match(styles,/\.manual-normal/);
  assert.match(styles,/\.manual-abnormal/);
});
