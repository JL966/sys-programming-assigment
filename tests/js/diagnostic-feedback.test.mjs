import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../../web/js/diagnostic-runner.js';
import {CMD} from '../../web/js/diagnostic-core.js';
import {temperature,nonNormal,linkPass,durations} from '../../web/js/diagnostic-feedback.js';
test('display conversion, fixed limits and non-normal filter',()=>{
 assert.equal(temperature(512),25);assert.equal(temperature(834),-5);assert.equal(temperature(100),85);assert.equal(temperature(1023),null);
 assert.deepEqual(['NORMAL','ABNORMAL','UNTESTED'].filter(status=>nonNormal({status})),['ABNORMAL','UNTESTED']);
 assert(linkPass([4,5]));assert(!linkPass([5,3]));assert.equal(durations.temperature,30000);
});
test('preparation has no timer; operation timeout fails; manual timeout is distinct',async()=>{
 const b={connected:true,ask:async()=>[0]};const updates=[];const r=new Runner(b,null,async()=>{},()=>{},v=>updates.push(v));
 await r.prompt(['prepare']);assert.equal(r.deadline,0);
 await assert.rejects(r.poll(async()=>0,()=>false,5),/超时/);assert(updates.some(v=>v.remaining!==null));assert.equal(r.deadline,0);
 r.ui=()=>new Promise(()=>{});assert.equal(await r.manual([],5),'确认超时');assert.equal(r.deadline,0);
});
function board(failSequences=[]){return {connected:true,sequence:0,asks:[],async ask(cmd,attempt,id,step,p){this.asks.push(cmd);if(cmd===CMD.ARM)this.sequence=p[2];if(cmd===CMD.SEND&&failSequences.includes(this.sequence))throw Error('发送拒绝');return cmd===CMD.SNAPSHOT?[0,1,0,8,1,1,1,1]:[0,0,0,0,0,0,0,0];}};}
test('dual link counts distinct sequences, permits 4/5 and records attempts',async()=>{
 const a=board([2]),b=board();const r=new Runner(a,b,async()=>{},async()=>{});r.pause=async()=>{};
 const result=await r.run(15,22);assert.equal(result.status,'NORMAL');const summary=result.evidence.find(x=>x.kind==='linkSummary');assert.deepEqual(summary.counts,[4,5]);assert.equal(summary.trials.filter(x=>x.direction===0&&x.sequence===2).length,3);
 assert(a.asks.includes(CMD.STOP));assert.equal(a.asks.at(-1),CMD.ROLE);
});
test('one failing direction fails whole link',async()=>{const r=new Runner(board([1,2]),board(),async()=>{},async()=>{});r.pause=async()=>{};assert.equal((await r.run(15,30)).status,'ABNORMAL');});
test('manual no-response becomes untested, never abnormal',async()=>{const b=board();b.ask=async c=>c===CMD.STATUS?[0,3]:[0];const r=new Runner(b,null,async()=>{},async()=>{});r.manual=async()=> '确认超时';assert.equal((await r.run(7,2)).status,'UNTESTED');});
