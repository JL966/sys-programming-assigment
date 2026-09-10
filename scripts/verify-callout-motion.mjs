import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  await page.goto('http://127.0.0.1:8000');
  await page.locator('#learning-fold').click();
  await page.waitForTimeout(400);
  const geometry=await page.evaluate(()=>{
    const lines=[...document.querySelectorAll('.learning-lines line')];
    return {count:lines.length,bends:document.querySelectorAll('.learning-lines polyline').length,
      infraredShared:lines[3].getAttribute('x1')===lines[4].getAttribute('x1')&&lines[3].getAttribute('y1')===lines[4].getAttribute('y1'),
      color:getComputedStyle(lines[0]).stroke,
      endpoints:lines.map(line=>[Number(line.getAttribute('x2')),Number(line.getAttribute('y2'))])};
  });
  const {boardArrows}=await import('../web/js/learning-board-data.js');
  assert.equal(geometry.count,19);assert.equal(geometry.bends,0);assert(geometry.infraredShared);
  assert.equal(geometry.color,'rgb(180, 35, 24)');
  assert.deepEqual(geometry.endpoints,boardArrows.map(a=>[a.x2,a.y2]));
  const samples=await page.evaluate(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const results=[];
    for(const button of document.querySelectorAll('.learning-callout')){
      button.click();await sleep(320);
      const initial=button.getBoundingClientRect().height;
      button.click();const heights=[];
      await new Promise(resolve=>{
        const start=performance.now();
        function sample(){heights.push(button.getBoundingClientRect().height);if(performance.now()-start<270)requestAnimationFrame(sample);else resolve();}
        requestAnimationFrame(sample);
      });
      results.push({name:button.querySelector('.learning-callout-name').textContent,initial,max:Math.max(...heights),final:heights.at(-1),monotonic:heights.every((v,i)=>i===0||v<=heights[i-1]+1)});
    }
    const button=document.querySelector('.learning-callout.c12');
    for(let i=0;i<5;i++){button.click();await sleep(45);}
    await sleep(350);
    const open=button.getAttribute('aria-expanded')==='true'&&button.getBoundingClientRect().height>40;
    button.click();await sleep(260);
    return {results,rapidClickSettled:open&&button.getBoundingClientRect().height<40};
  });
  for(const item of samples.results){assert(item.max<=item.initial+1,`${item.name} grew while closing`);assert(item.monotonic,`${item.name} jumped`);assert(item.final<40);}
  assert(samples.rapidClickSettled);
  console.log('PASS: all 18 labels shrink monotonically with no height spike; rapid-click reversal settles correctly.');
}finally{await browser.close();}
