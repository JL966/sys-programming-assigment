import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  diagnosticMessages,
  renderDiagnosticMessageMarkdown,
  repairNotice,
  resolveDiagnosticMessage
} from '../../web/js/diagnostic-messages.js';

test('all 23 projects have complete fallback and scenario messages',()=>{
  assert.equal(diagnosticMessages.length,23);
  assert.deepEqual(diagnosticMessages.map(item=>item.id),Array.from({length:23},(_,index)=>index+1));
  for(const item of diagnosticMessages){
    assert(item.name);
    assert(item.entries.fallback,`${item.id} has no fallback`);
    for(const [key,message] of Object.entries(item.entries)){
      assert(message.label,`${item.id}/${key} has no label`);
      assert(message.reason,`${item.id}/${key} has no reason`);
      assert(message.advice,`${item.id}/${key} has no advice`);
    }
  }
});

test('normal, untested and abnormal results keep distinct presentation data',()=>{
  const normal=resolveDiagnosticMessage(1,{status:'NORMAL',reason:'old',advice:'old'});
  assert.equal(normal.reason,'');assert.equal(normal.advice,'');assert.equal(normal.repairNotice,'');
  const skipped=resolveDiagnosticMessage(1,{status:'UNTESTED',reason:'用户跳过或取消'});
  assert.equal(skipped.reason,'本项已跳过，未获得有效检测结果。');assert.equal(skipped.advice,'');assert.equal(skipped.repairNotice,'');
  const abnormal=resolveDiagnosticMessage(1,{status:'ABNORMAL',reason:'操作窗口超时'});
  assert.equal(abnormal.failureCode,'reset-timeout');assert.equal(abnormal.repairNotice,repairNotice);assert(abnormal.reason&&abnormal.advice);
  const manualTimeout=resolveDiagnosticMessage(7,{status:'UNTESTED',source:'MANUAL',reason:'人工确认超时；请复测并选择观察结果'});
  assert.equal(manualTimeout.status,'ABNORMAL');assert.equal(manualTimeout.failureCode,'manual-timeout');
});

test('failure evidence selects stage-specific beginner guidance',()=>{
  const temperature=resolveDiagnosticMessage(8,{status:'ABNORMAL',reason:'操作窗口超时',evidence:[{baseline:500,limit:4}]});
  assert.equal(temperature.failureCode,'no-change');
  const hall=resolveDiagnosticMessage(10,{status:'ABNORMAL',reason:'操作窗口超时',evidence:[{cmd:20,p:[0,1]}]});
  assert.equal(hall.failureCode,'no-leave');
  const infrared=resolveDiagnosticMessage(15,{status:'ABNORMAL',reason:'有效包不足',evidence:[{kind:'linkSummary',counts:[4,2],trials:[]}]});
  assert.equal(infrared.failureCode,'one-direction');assert.match(infrared.advice,/多测试几次/);
  const scale=resolveDiagnosticMessage(20,{status:'ABNORMAL',reason:'操作窗口超时',evidence:[]},{checkpoint:{stage:'changed'}});
  assert.equal(scale.failureCode,'no-restore');
  const rfid=resolveDiagnosticMessage(23,{status:'ABNORMAL',reason:'操作窗口超时',evidence:[{cmd:20,p:[0,0,0,0,0,2]}]},{checkpoint:{stage:'reader-ready'}});
  assert.equal(rfid.failureCode,'seek');
});

test('committed review document is generated from the same message catalog',async()=>{
  const path=new URL('../../诊断异常原因与处理建议.md',import.meta.url);
  assert.equal(await readFile(path,'utf8'),renderDiagnosticMessageMarkdown());
});
