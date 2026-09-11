import {devices} from './extension-runner.js';
import {deviceAssets} from './device-assets.js';
import {nonNormal} from './diagnostic-feedback.js';
import {resolveDiagnosticMessage} from './diagnostic-messages.js';
import {initLearningBoard} from './learning-board.js';
import {animatePanel,bindEvidenceMotion} from './panel-motion.js';
import {CMD} from './diagnostic-core.js';
import {names,summary,escapeHtml as e} from './diagnostic-core.js';
import {Board} from './diagnostic-client.js';
import {Runner} from './diagnostic-runner.js';
import {save,history,download} from './diagnostic-store.js';
const $=id=>document.getElementById(id);let board,aux,runner,busy=false,stop=false,resolveChoice,onlyBad=false,attempt=1+Math.floor(Math.random()*60000);
function fresh(){return {id:crypto.randomUUID(),started:new Date().toISOString(),rules:'2.4.0',firmware:'2.3.0',items:names.map((name,i)=>({id:i+1,name,status:'UNTESTED',reason:'本项尚未测试。',advice:'',history:[]}))};}
let run=fresh();
async function persist(){try{await save(run);}catch{$('notice').textContent='本地保存失败，请导出报告；EEPROM备份保存失败时不开始写入。';}}
function refreshConnectionStatus(){$('connection-state').textContent=board?.connected?'被测板已连接':'被测板待连接';$('ports').textContent=`被测板：${board?.connected?'已连接':'未连接'} · 辅助板：${aux?.connected?'已连接':'未连接'}`;$('swap').disabled=!(board?.connected&&aux?.connected);}
function resultDetail(item){
 if(item.status==='UNTESTED')return `<div class="detail"><p>${e(item.reason||'本项尚未测试。')}</p></div>`;
 const evidence=item.evidence?.length?`<details class="evidence"><summary aria-expanded="false">查看证据</summary><div class="evidence-body" hidden><pre>${e(JSON.stringify(item.evidence,null,2))}</pre></div></details>`:'';
 return `<div class="detail"><p><strong>原因：</strong>${e(item.reason)}</p><p><strong>建议：</strong>${e(item.advice)}</p><p class="repair-notice">${e(item.repairNotice||'报修请联系老师，勿自行操作。')}</p>${evidence}</div>`;
}
function render(){ $('filter').disabled=$('toggle-list').getAttribute('aria-expanded')==='false';$('overall').textContent=summary(run.items);$('counts').textContent=['NORMAL','ABNORMAL','UNTESTED'].map((s,i)=>`${run.items.filter(x=>x.status===s).length} ${['正常','异常','未测试'][i]}`).join(' · ');$('list').innerHTML=run.items.filter(i=>!onlyBad||nonNormal(i)).map(i=>{const title=`<b>${String(i.id).padStart(2,'0')}　${e(i.name)}</b><span>${({NORMAL:'正常',ABNORMAL:'异常',UNTESTED:'未测试'})[i.status]}</span>`;return `<article class="row ${i.status} row-enter">${i.status==='NORMAL'?`<div class="row-title">${title}</div>`:`<details><summary aria-expanded="false">${title}</summary><div class="result-detail-body" hidden>${resultDetail(i)}</div></details>`}</article>`;}).join('');}
async function connect(which){if(busy&&which!=='aux')return;try{const b=new Board();await b.open();await b.ask(CMD.ROLE,0,0,0,[which==='board'?1:2]);if(which==='board'){await board?.close();board=b;if(!run.checkpoint)run=fresh();render();}else{await aux?.close();aux=b;if(runner)runner.aux=b;}refreshConnectionStatus();$('notice').textContent='';}catch(err){$('notice').textContent=err.message;}}
$('connect').onclick=()=>connect('board');$('aux').onclick=()=>connect('aux');$('swap').onclick=async()=>{if(!busy){[board,aux]=[aux,board];try{await board.ask(CMD.ROLE,0,0,0,[1]);await aux.ask(CMD.ROLE,0,0,0,[2]);}catch(e){$('notice').textContent='角色同步失败，请重新连接：'+e.message;return;}run=fresh();render();refreshConnectionStatus();$('notice').textContent='已交换两板，建立新记录。';}};
$('test').innerHTML=names.map((n,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')} ${e(n)}</option>`).join('');
function choice(steps,buttons){$('steps').classList.toggle('plain-steps',steps.some(s=>s.startsWith('请操作：')));$('steps').innerHTML=steps.map(s=>`<li>${e(s)}</li>`).join('');$('choices').innerHTML='';return new Promise(resolve=>{resolveChoice=value=>{$('choices').innerHTML='';resolve(value);};for(const name of buttons){const b=document.createElement('button');b.textContent=name;if(name==='正常')b.className='manual-normal';if(name==='异常')b.className='manual-abnormal';b.onclick=()=>{resolveChoice=null;$('choices').innerHTML='';resolve(name);};$('choices').append(b);}});}
function cancel(all=false){if(!runner)return;stop=all;runner.cancelled=true;resolveChoice?.('__CANCELLED__');resolveChoice=null;}
$('skip').onclick=()=>cancel(false);$('cancel').onclick=()=>cancel(true);
async function execute(ids,newRun){if(busy)return;if(!board?.connected){$('notice').textContent='请先连接已烧录的被测板。';return;}if(newRun||run.rules!=='2.4.0')run=fresh();busy=true;stop=false;$('cancel').disabled=false;for(const id of ['connect','swap','all','single','history','resume'])$(id).disabled=true;$('task').hidden=false;
 try{for(const id of ids){if(stop)break;const item=run.items[id-1];run.checkpoint={id,remaining:ids.slice(ids.indexOf(id)),phase:'PREPARING'};await save(run);$('display-help').textContent=devices[id]?.display||'';showDevice(id);$('title').textContent=item.name;$('count').textContent=`${id} / ${names.length}`;$('steps').innerHTML='<li>正在读取设备，请稍候。</li>';$('choices').innerHTML='';
 runner=new Runner(board,aux,choice,async backup=>{run.eepromBackup=backup;await save(run);},feedback,reconnectExtension,async detail=>{run.checkpoint={...run.checkpoint,...detail};await save(run);});const rawResult=await runner.run(id,attempt=attempt%65534+1);resolveChoice?.('__CANCELLED__');resolveChoice=null;const result=resolveDiagnosticMessage(id,rawResult,{checkpoint:{...run.checkpoint}});const record={...result,at:new Date().toISOString(),attempt,wire:board?.log.splice(0),auxWire:aux?.log.splice(0)};item.history.push(record);Object.assign(item,{reason:'',advice:'',repairNotice:'',evidence:[],source:'AUTO'},result);render();run.checkpoint={id:ids[ids.indexOf(id)+1],remaining:ids.slice(ids.indexOf(id)+1),phase:'PREPARING'};await persist();}
 }finally{busy=false;runner=null;run.ended=new Date().toISOString();if(!stop&&!run.checkpoint?.remaining?.length)run.checkpoint=null;await persist();$('task').hidden=true;$('cancel').disabled=true;for(const id of ['connect','aux','all','single','history','resume'])$(id).disabled=false;$('swap').disabled=!(board?.connected&&aux?.connected);render();}}
$('all').onclick=()=>execute(names.map((_,i)=>i+1),true);$('single').onclick=()=>execute([Number($('test').value)],false);
$('toggle-list').onclick=()=>{const hidden=$('toggle-list').getAttribute('aria-expanded')==='true';$('filter').disabled=hidden;$('toggle-list').textContent=hidden?'展开清单':'收起清单';$('toggle-list').setAttribute('aria-expanded',String(!hidden));animatePanel($('list'),!hidden);};$('filter').onclick=()=>{if($('toggle-list').getAttribute('aria-expanded')==='false')return;onlyBad=!onlyBad;$('filter').textContent=onlyBad?'显示全部':'只显示异常和未测试';render();};$('html').onclick=()=>download(run,'html');$('json').onclick=()=>download(run,'json');
$('history').onclick=async()=>{try{const all=await history();if(!all.length){$('notice').textContent='暂无历史记录';return;}const selected=prompt(all.slice(0,15).map((r,i)=>`${i+1}. ${r.started} ${summary(r.items)}`).join('\n')+'\n输入序号查看');if(selected&&all[Number(selected)-1]){run=all[Number(selected)-1];render();}}catch{$('notice').textContent='无法读取本地记录';}};
window.addEventListener('beforeunload',ev=>{if(busy){ev.preventDefault();ev.returnValue='';}});render();if(!navigator.serial)$('notice').textContent='请通过一键启动脚本，用Chrome或Edge打开页面。';
function feedback({text,remaining,total}){ $('live').textContent=text||'';$('timer').textContent=remaining===null?'':('剩余 '+Math.ceil(remaining/1000)+' 秒');$('progress').hidden=remaining===null;$('progress').value=remaining===null?0:Math.max(0,1-remaining/total);}
async function reconnectExtension(wiring,r){
 await board?.ask(CMD.STOP).catch(()=>{});
 await choice(['请操作：拔掉被测板USB及其他电源，然后点“已拔掉USB”。','原因：断电换件更安全；进度已保存，辅助板不用拔。'],['已拔掉USB']);
 if(r.cancelled)throw Error('用户跳过或取消');
 if(board?.connected)throw Error('未检测到被测板断开，请先拔掉USB后复测');
 await board?.close().catch(()=>{});
 $('steps').classList.add('plain-steps');
 $('steps').innerHTML=['请操作：换好器件后插回USB，点“重新连接并继续”，选择原被测板。',wiring,'原因：重新建立连接，继续本轮测试，不用重烧HEX。'].map(s=>`<li>${e(s)}</li>`).join('');
 const replacement=await new Promise((resolve,reject)=>{
  resolveChoice=()=>reject(Error('用户跳过或取消'));$('choices').innerHTML='';const button=document.createElement('button');button.textContent='重新连接并继续';$('choices').append(button);
  button.onclick=async()=>{button.disabled=true;let b;try{b=new Board();await b.open();await b.ask(CMD.ROLE,0,0,0,[1]);if(r.cancelled){await b.close();reject(Error('用户跳过或取消'));return;}board=b;r.board=b;resolveChoice=null;$('choices').innerHTML='';resolve(b);}catch(err){await b?.close().catch(()=>{});$('notice').textContent=err.message;button.disabled=false;}};
 });
 refreshConnectionStatus();
 await choice(['核对刚插回的被测板：数码管待机显示01。','如果拿错板，请取消本轮并重新连接；不要把另一块板当成原板继续。'],['身份正确']);
 if(r.cancelled)throw Error('用户跳过或取消');
 run.checkpoint.reconnectedAt=new Date().toISOString();await save(run);return replacement;
}
function showDevice(id){const meta=devices[id],asset=deviceAssets[id];$('device').hidden=!asset;if(!asset)return;$('device').innerHTML=`<img src="${e(asset.path)}" alt="${e(meta.name)}"><p>${e(meta.name)}：${e(asset.description)}</p><small>${e(meta.port)}</small>`;}
$('resume').onclick=async()=>{if(busy)return;try{const runs=await history();const pending=runs.find(r=>r.rules==='2.4.0'&&r.checkpoint?.remaining?.length);if(!pending){$('notice').textContent='没有可恢复的当前版本轮次；旧记录可在历史记录中查看';return;}run=pending;render();$('notice').textContent='已恢复历史结果。连接原被测板后再点恢复；当前未完成项目从准备步骤重新检测，已完成项目不会丢失。';if(board?.connected)await execute(run.checkpoint.remaining,false);}catch(err){$('notice').textContent=err.message;}};

initLearningBoard();
bindEvidenceMotion($('list'));
