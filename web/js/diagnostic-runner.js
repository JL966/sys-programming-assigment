import {runExtension} from './extension-runner.js';
import {CMD,median,threshold,rtcTime,frame,crc} from './diagnostic-core.js';
import {durations as D,temperature,temperatureRiseGate} from './diagnostic-feedback.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export class Runner {
 constructor(board,aux,ui,backup,update=()=>{},reconnect=async()=>{throw Error('未配置重连流程');},checkpoint=async()=>{}){Object.assign(this,{board,aux,ui,backup,update,reconnect,checkpoint});this.deadline=0;this.live='';this.cancelled=false;this.data=[];}
 clock(ms=0){this.deadline=ms?Date.now()+ms:0;this.total=ms;this.report();}
 report(text){if(text!==undefined)this.live=text;this.update({text:this.live,remaining:this.deadline?Math.max(0,this.deadline-Date.now()):null,total:this.total});}
 async manual(steps,ms){this.clock(ms);this.report('请按实际看到或听到的现象选择结果');let timer,connection;try{return await Promise.race([this.ui(steps,['正常','异常']),new Promise(r=>{timer=setTimeout(()=>r('确认超时'),ms);}),new Promise((_,reject)=>{connection=setInterval(()=>{try{this.check();}catch(e){reject(e);}},100);})]);}finally{clearTimeout(timer);clearInterval(connection);this.clock();}}
 check(){if(this.cancelled)throw Error('用户跳过或取消');if(!this.board.connected || ((this.id===15||this.id===16)&&this.aux&&!this.aux.connected))throw Error('连接中断');}
 async pause(ms){for(let t=0;t<ms;t+=100){this.check();this.report();await wait(Math.min(100,ms-t));}}
 async q(cmd,step=0,p=[],b=this.board){this.check();const r=await b.ask(cmd,this.attempt,this.id,step,p);this.data.push({cmd,step,p:r,board:b===this.board?'被测板':'辅助板',at:Date.now()});return r.slice(1);}
 async prompt(steps){this.clock();this.report('准备好后点击开始');this.check();await this.ui(steps,['开始']);this.check();}
 async poll(read,test,ms=15000){this.clock(ms);const end=this.deadline;try{while(Date.now()<end){this.check();const p=await read();if(Date.now()<=end&&test(p))return p;await this.pause(100);}throw Error('操作窗口超时，未检测到要求响应；确认动作后复测');}finally{this.clock();}}
 async run(id,attempt){this.id=id;this.attempt=attempt;this.data=[];this.cancelled=false;const ticker=setInterval(()=>this.report(),100);const heartbeat=setInterval(()=>{if(!this.cancelled&&id!==2){this.board.ask(CMD.HELLO).catch(()=>{});if((id===15||id===16))this.aux?.ask(CMD.HELLO).catch(()=>{});}},1500);try{
  if(id===1){let before=await this.board.ask(CMD.HELLO);await this.prompt(['准备按一下板上的RST。','点击开始后，按RST并等待。']);const u=p=>(p[4]+p[5]*256+p[6]*65536+p[7]*16777216);await this.poll(async()=>{const p=await this.board.ask(CMD.HELLO);this.data.push({resetHello:p});return p;},p=>u(p)<u(before),20000);return {status:'NORMAL',source:'ASSISTED_AUTO',evidence:this.data};}
  if(id===2){for(let n=0;n<10;n++){this.check();this.report(`串口挑战 ${n+1}/10`);const p=await this.board.ask(CMD.HELLO);this.data.push(p);await this.board.ask(CMD.PROGRESS,0,0,0,[n+1]);}this.report('串口挑战10/10，继续验证坏帧拒绝和半帧恢复');for(const index of [2,5,12,22]){this.check();const b=frame(CMD.HELLO,50000+index);b[index]^=8;if(index!==22){const c=crc(b.slice(2,22));b[22]=c&255;b[23]=c>>>8;}await this.board.rejectProbe(b);await this.board.ask(CMD.HELLO);}this.data.push(await this.board.splitProbe());await this.board.transport.send(new Uint8Array([17,18,19]));await this.board.ask(CMD.HELLO);return {status:'NORMAL',source:'AUTO',evidence:this.data};}
  if((id===15||id===16)&&!this.aux?.connected){await this.prompt(['现在可点击上方“连接辅助板”，选择第二个USB串口。','连接完成后点击开始；没有辅助板请跳过。']);if(!this.aux?.connected)return {status:'UNTESTED',reason:'未连接辅助板；连接第二块同固件学习板后复测。'};}
  if(id>=17)return await runExtension(this);
  await this.q(CMD.PREPARE);
  if([3,4,7,14].includes(id)){
   const instructions={3:['观察L0至L7逐个点亮。','确认全亮和全灭均正确。'],4:['观察全段、12345678及逐段图案。','确认没有缺段、缺位和错位。'],7:['保持周围安静。','确认听到三段短音。'],14:['插入已知正常的有线耳机。','收听95.5MHz，确认有可辨识广播。','仅有沙沙噪声请选择异常。']};
   await this.prompt(instructions[id]);await this.q(CMD.START);
   let keep=setInterval(()=>this.board.ask(CMD.STATUS,this.attempt,id).catch(()=>{}),1000);
   try{if(id!==14)await this.poll(()=>this.q(CMD.STATUS),p=>p[0]===3,20000);else await this.q(CMD.SNAPSHOT);
    const choice=await this.manual(instructions[id],id===14?D.fm:D.manual);this.check();return {status:choice==='正常'?'NORMAL':choice==='异常'?'ABNORMAL':'UNTESTED',source:'MANUAL',reason:choice==='异常'?'操作者确认现象不符合预期':choice==='确认超时'?'人工确认超时；请复测并选择观察结果':'',evidence:this.data};
   }finally{clearInterval(keep);}
  }
  if(id===5||id===6){const keys=id===5?['K1','K2','K3']:['上','下','左','右','中'];for(let k=0;k<keys.length;k++){await this.prompt([`准备操作${keys[k]}。`,`开始后按下并松开；数码管从0变成${k+1}表示收到按下。`]);await this.q(CMD.START,k);await this.poll(()=>this.q(CMD.SNAPSHOT),p=>{this.report(`${keys[k]}：${p[0]?'已按下':'等待按下'} · ${p[1]?'已松开':'等待松开'}`);if(p[2])throw Error('检测到其他按键，请按当前提示复测');return p[0]&&p[1];});await this.pause(400);}}
  else if(id===8||id===9){await this.prompt(['保持正常环境，不触摸传感器。',id===8?'开始后显示整数摄氏度；小变化以页面ADC为准。':'开始后显示光照ADC值0～1023。']);await this.q(CMD.START);let last=-1,b=null;const sample=async()=>{const p=await this.q(CMD.SNAPSHOT);const serial=p[4]|p[5]<<8;if(serial===last)throw Error('采样数据未更新');last=serial;const v=id===8?p[0]|p[1]<<8:p[2]|p[3]<<8;this.report(`${id===8?`温度 ${temperature(v)??'超出范围'} ℃ · `:''}ADC ${v}${b===null?' · 采集基线':` · 基线 ${b} · 变化 ${v-b}`}`);return v;};const base=[];for(let n=0;n<13;n++){const v=await sample();if(n>=3)base.push(v);await this.pause(120);}b=median(base);const limit=threshold(base,id);this.data.push({baseline:b,limit});await this.prompt([id===8?'点击开始后持续轻捂Rt热敏电阻，等待明显升温。':'点击开始后完全遮住光敏电阻。','保持动作，观察数码管与网页数值变化。']);const window=[];const warming=temperatureRiseGate(b,limit);let stable=0;const changed=await this.poll(sample,v=>{window.push(v);if(window.length>3)window.shift();if(id===8)return window.length===3&&warming(median(window),v);const d=Math.abs(median(window)-b);stable=d>=limit&&v>0&&v<1023?stable+1:0;return stable>=3;},id===8?D.temperature:D.light);if(id===9){await this.prompt(['保持遮挡，准备恢复光照。','点击开始后移开手，数值应向基线恢复。']);await this.poll(sample,v=>Math.abs(v-b)<Math.abs(changed-b)*0.6,D.light);}}
  else if(id===10){await this.prompt(['先移开磁铁。','开始后靠近磁铁，数码管0变1；再移开，显示2。']);await this.q(CMD.START);await this.poll(()=>this.q(CMD.SNAPSHOT),p=>{this.report('请靠近磁铁，等待数码管显示1');return p[0]&1;},D.hall);this.report('已检测接近，请移开磁铁，等待显示2');await this.poll(()=>this.q(CMD.SNAPSHOT),p=>p[0]===3,D.hall);await this.pause(600);}
  else if(id===11){await this.prompt(['开始后轻晃学习板。','数码管从0开始，每收到振动事件计数加1。']);await this.q(CMD.START);await this.poll(()=>this.q(CMD.SNAPSHOT),p=>{this.report('振动事件 '+p[0]+' 次');return p[0]>0;},D.vibration);await this.pause(700);}
  else if(id===12){await this.q(CMD.START);const times=[];for(let n=0;n<3;n++){times.push(rtcTime(await this.q(CMD.SNAPSHOT)));this.report('RTC '+times.map(t=>new Date(t).toISOString().slice(11,19)).join(' → ')+'；数码管HH-MM-SS');if(n<2)await this.pause(2100);}if(times.slice(1).some((t,i)=>t-times[i]<1000||t-times[i]>6000))throw Error('RTC时间未正常推进');this.data.push({rtcTimes:times,scope:'只验证通电走时，不验证后备电池、绝对时间精度'});}
  else if(id===13){const original=await this.q(CMD.BACKUP);await this.backup({address:127,original:original[0],test:original[1],attempt:this.attempt});this.report('EEPROM 1/5 已备份；请勿断电');await this.pause(350);await this.q(CMD.START,0,[original[0]]);const p=await this.poll(()=>this.q(CMD.STATUS),p=>{this.report(`EEPROM ${p[4]}/5：${['','备份','写入','校验','恢复','最终校验'][p[4]]||'处理中'}；不要断电`);return p[0]===3;},5000);const e=await this.q(CMD.BACKUP);await this.pause(500);if(p[1]||e[0]!==e[3]||e[1]!==e[2])throw Error('EEPROM写入校验或原值恢复失败；请保留报告');}
  else if((id===15||id===16)){
   await this.prompt(id===15?['两板红外头相对，距离10～20厘米，保持无遮挡。','数码管左侧1/2为方向，右侧为本板该方向有效接收包数。']:['没有485线请跳过。','断电接A-A、B-B、参考地，不接VCC；重新连接USB后开始。']);
   await this.q(CMD.PREPARE,0,[],this.aux);this.clock(D.link);const end=this.deadline,counts=[0,0],trials=[],token=1+Math.floor(Math.random()*65534);
   for(let d=0;d<2;d++)for(let t=0;t<5;t++){
    let ok=false;const sender=d?this.aux:this.board,receiver=d?this.board:this.aux;
    for(let retry=0;retry<3&&!ok&&Date.now()<end;retry++){
     this.report('被测板→辅助板 '+counts[0]+'/5 · 辅助板→被测板 '+counts[1]+'/5 · 第'+(t+1)+'包 · 重试'+retry+'/2');
     const p=[token&255,token>>>8,t,d];await this.q(CMD.ARM,0,p,sender);await this.q(CMD.ARM,0,p,receiver);
     let rx=[],tx=[],details=[],error='';
     try{await this.q(CMD.SEND,0,[],sender);const until=Math.min(end,Date.now()+800);do{rx=await this.q(CMD.SNAPSHOT,0,[],receiver);if(Date.now()<=end&&rx[0]===1){ok=true;break;}await this.pause(80);}while(Date.now()<until);tx=await this.q(CMD.SNAPSHOT,0,[],sender);details=await this.q(CMD.SNAPSHOT,1,[],receiver);}
     catch(e){if(this.cancelled||!sender.connected||!receiver.connected)throw e;error=e.message;}
     trials.push({direction:d,sequence:t,retry,matched:ok,rx,tx,details,error});await this.pause(120);
    }
    if(ok)counts[d]++;
   }
   this.data.push({kind:'linkSummary',counts,trials,timeouts:trials.filter(t=>!t.matched&&!t.error).length});this.clock();this.report('双向有效包 '+counts[0]+'/5、'+counts[1]+'/5');
   if(counts.some(n=>n<4))throw Error((trials.some(t=>t.error)?'存在发送或命令错误；':trials.some(t=>t.rx[2]>0)?'已收到红外/485数据，但有效包不足；':'对端未报告有效接收数据；')+'双向有效包 '+counts[0]+'/5、'+counts[1]+'/5，要求各至少4包；请展开收发、长度、CRC和重试证据复查链路');
  }
  return {status:'NORMAL',source:[8,9,10,11,5,6].includes(id)?'ASSISTED_AUTO':'AUTO',evidence:this.data};
 }catch(e){return {status:this.cancelled||!this.board.connected||((id===15||id===16)&&!this.aux?.connected)||e.message.includes('连接中断')?'UNTESTED':'ABNORMAL',reason:e.message,evidence:this.data};}
 finally{clearInterval(ticker);clearInterval(heartbeat);this.clock();await this.board.ask(CMD.STOP).catch(()=>{});if(id===13)await wait(1100);await this.board.ask(CMD.ROLE,0,0,0,[1]).catch(()=>{});if((id===15||id===16)){await this.aux?.ask(CMD.STOP).catch(()=>{});await this.aux?.ask(CMD.ROLE,0,0,0,[2]).catch(()=>{});}}}
}
