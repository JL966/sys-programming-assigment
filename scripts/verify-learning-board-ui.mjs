import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('.local-history/learning-board-qa',{recursive:true});

try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,1024,768,390]){
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:8000');
    assert(await page.locator('.learning-panels').isHidden());
    assert(await page.locator('#list').isVisible());
    await page.locator('#learning-fold').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px has horizontal overflow`);
    assert.equal(await page.locator('.learning-callout').count(),18);
    assert.equal(await page.locator('.learning-lines circle').count(),19);
    await page.locator('.learning-board-panel').screenshot({path:`.local-history/learning-board-qa/board-${width}.png`});
  }
  await page.setViewportSize({width:1024,height:1000});
  await page.goto('http://127.0.0.1:8000');
  await page.locator('#learning-fold').click();
  await page.getByRole('tab',{name:'元器件'}).click();
  await page.locator('.learning-board-panel').screenshot({path:'.local-history/learning-board-qa/components-1024.png'});
  await page.getByRole('tab',{name:'扩展模块'}).click();
  await page.locator('.learning-extension-column').nth(0).locator('summary').first().click();
  await page.locator('.learning-extension-column').nth(1).locator('summary').first().click();
  await page.waitForTimeout(380);
  await page.locator('.learning-board-panel').screenshot({path:'.local-history/learning-board-qa/extensions-1024.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: learning-board layout at 1440, 1024, 768 and 390px');
}finally{
  await browser.close();
}
