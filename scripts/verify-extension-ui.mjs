// Browser-only mocks: no real USB traffic, no production test bypass.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('.local-history/extension-qa',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/diagnostic-client.js',route=>route.fulfill({contentType:'text/javascript',body:`export class Board{constructor(){this.connected=true;this.log=[];window.qaBoard=this;}async open(){return this;}async close(){this.connected=false;}async ask(cmd,a,id,step){if(cmd===16)this.test=id;if(cmd===18)return [0,3,0,0,0,5,0,0];if(cmd===1)return [0,2,2,0,0,0,0,0];return [0,0,0,0,0,0,0,0];}}`}));
 await page.goto('http://127.0.0.1:8000');
 assert.equal(await page.locator('#test option').count(),24);assert.equal(await page.locator('.row').count(),24);
 await page.locator('#connect').click();assert.equal(await page.locator('#connection-state').innerText(),'被测板已连接');assert.equal(await page.locator('#notice').innerText(),'');await page.locator('#test').selectOption('20');await page.locator('#single').click();
 await page.getByRole('button',{name:'已拔掉USB',exact:true}).waitFor();
 await page.screenshot({path:'.local-history/extension-qa/desktop-wiring.png',fullPage:true});
 await page.evaluate(()=>window.qaBoard.connected=false);await page.getByRole('button',{name:'已拔掉USB',exact:true}).click();
 await page.getByRole('button',{name:'重新连接并继续',exact:true}).click();await page.getByRole('button',{name:'身份正确',exact:true}).click();
 await page.getByRole('button',{name:'开始',exact:true}).waitFor();
 assert((await page.locator('#display-help').innerText()).includes('PWM'));assert.equal(await page.locator('#timer').innerText(),'');
 await page.screenshot({path:'.local-history/extension-qa/desktop-prepare.png',fullPage:true});
 await page.getByRole('button',{name:'开始',exact:true}).click();await page.getByRole('button',{name:'异常',exact:true}).waitFor();
 await page.locator('#user-note').fill('测试模拟：反转不动');await page.getByRole('button',{name:'异常',exact:true}).click();await page.locator('#task').waitFor({state:'hidden'});
 assert.equal(await page.locator('.ABNORMAL').count(),1);await page.locator('#filter').click();assert.equal(await page.locator('.row').count(),24);
 await page.locator('#test').selectOption('19');await page.locator('#single').click();await page.getByRole('button',{name:'已拔掉USB',exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await page.reload();await page.locator('#resume').click();await page.locator('#notice').filter({hasText:'已恢复历史结果'}).waitFor();assert.equal(await page.locator('.ABNORMAL').count(),1);
 await page.locator('#connect').click();await page.locator('#resume').click();await page.getByRole('button',{name:'已拔掉USB',exact:true}).waitFor();await page.locator('#skip').click();await page.locator('#task').waitFor({state:'hidden'});assert.equal(await page.locator('.ABNORMAL').count(),1);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local-history/extension-qa/mobile-result.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: 24 items, power-cycle handoff, identity, manual abnormal, notes, nonnormal filter, mobile overflow, no page errors');
}finally{await browser.close();}
