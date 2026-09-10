import {CMD,median} from './diagnostic-core.js';
export const devices={
 17:{name:'SM步进电机',port:'SM · 5V / S1 / S2 / S3 / S4',wiring:'使用课程五针步进电机，按插头和SM丝印对齐。',display:'1正转、2反转、0停止；后三横线右侧为速度（步/秒）。'},
 18:{name:'超声波测距',port:'EXT · P1.0 Echo / P1.1 Trig',wiring:'课程超声波模块：5V→VCC，GND→GND，P1.0→Echo，P1.1→Trig。',display:'前四位空白；后四位为厘米，----表示暂无有效回波。'},
 19:{name:'直流电机',port:'EXT · PWM双通道',wiring:'使用课程配套电机驱动组件；按原配接口接线，不将裸电机接IO。',display:'1正转、2反转、0停止；后四位为PWM百分比，不是实测转速。'},
 20:{name:'电子秤',port:'EXT · HX710/HX711',wiring:'使用课程原配电子秤组件和线束，先清空秤盘。',display:'前四位空白；后四位为相对空载变化的幅度，不是克数，超过9999显示9999。'},
 21:{name:'电子尺',port:'EXT · P1.1 ADC',wiring:'使用课程电子尺：电源两端接5V/GND，滑动信号接P1.1。',display:'前四位空白；后四位为0～1023 ADC，不是毫米。'},
 22:{name:'电子转角测量器',port:'EXT · A/B相',wiring:'使用课程原配转角组件和线束；按丝印接5V、GND、两相信号。',display:'1/2为两相方向、0为当前无新脉冲；后四位累计相对计数，不是角度。'},
 23:{name:'RFID读卡器',port:'EXT＋SM · 课程MFRC522适配组件',wiring:'保持老师程序能正常使用的EXT＋SM组合接线，中间两针留空。移开校园卡。',display:'前四位空白；0000等待读卡器，0001就绪，0002 UID稳定，0003卡片移开。仅只读卡号，不读写卡内业务数据。'}
};
export const unsigned=(p,n=0)=>p[n]|p[n+1]<<8;
export const signed=p=>{const v=unsigned(p);return v>=32768?v-65536:v;};
export function changeRule(base,id){const noise=Math.max(...base)-Math.min(...base);return {baseline:median(base),noise,limit:Math.max(id===18?5:id===20?8:12,noise*3+2)};}
export async function runExtension(r){
 const id=r.id,meta=devices[id];
 async function reconnect(wiring){r.clock();r.report('已暂停，请断电更换器件');await r.checkpoint({id,phase:'WIRING',wiring,evidence:r.data});r.board=await r.reconnect(wiring,r);r.check();if(id>=18)r.attempt=r.attempt%65534+1;await r.q(CMD.PREPARE);}
 async function checkpoint(stage){await r.checkpoint({id,phase:'TESTING',stage,evidence:r.data});}
 await reconnect(meta.wiring);
 if(id===17||id===19){
  await r.prompt(['清空电机周围，手不要碰转轴。','开始后自动正转低速→高速→停止→反转低速→高速→停止。',meta.display,'每段转动4秒、停止3秒，观察结束后确认。']);
  await r.q(CMD.START);await r.poll(()=>r.q(CMD.STATUS),p=>{const stage=p[4],speeds=id===17?[60,120,0,60,120,0]:[30,70,0,30,70,0];r.report(`${['正转低速','正转高速','停止','反转低速','反转高速','停止'][stage]||'准备'} · ${speeds[stage]??0}${id===17?'步/秒':'% PWM'} · 数码管${stage===2||stage===5?'0':stage<2?'1':'2'}---${String(speeds[stage]??0).padStart(4,'0')}`);if(p[1])throw Error('电机驱动命令或停止状态异常（'+p[1]+'）');return p[0]===3;},27000);
  await r.q(CMD.SNAPSHOT);await checkpoint('motor-complete');
  const choice=await r.manual(['正反转均正常？高速是否更快？两次停止是否生效？','以真实机械动作判断，显示数字变化不代表电机正常。'],15000);
  r.check();
  const status=choice==='正常'?'NORMAL':choice==='异常'?'ABNORMAL':'UNTESTED';
  return {status,source:'MANUAL',reason:status==='NORMAL'?'':status==='ABNORMAL'?'操作者确认电机动作异常':'未收到明确人工确认',evidence:r.data};
 }
 if(id===22){
  await r.prompt(['开始后顺时针转几格，再逆时针转几格。',meta.display]);await r.q(CMD.START);
  await r.poll(()=>r.q(CMD.SNAPSHOT),p=>{r.report(`累计${unsigned(p)}个脉冲 · 方向证据${unsigned(p,2)}（3表示两方向均检测到）`);return p[6]===1&&unsigned(p,2)===3;},15000);await checkpoint('both-directions');
 }else if(id===23){
  await r.prompt(['移开卡片，开始后先检查读卡器。',meta.display]);await r.q(CMD.START);
  const read=async()=>{const p=await r.q(CMD.SNAPSHOT);r.report(`板上${String(p[0]).padStart(4,'0')} · UID稳定${p[2]}次 · 读卡器版本${p[1]}`);const detail=await r.q(CMD.SNAPSHOT,2);r.report(`板上${String(p[0]).padStart(4,'0')} · UID稳定${p[2]}次 · ${({0:'正常',1:'读卡器通信异常',2:'寻卡/防冲突响应异常',3:'级联卡号异常',4:'选卡校验失败',6:'读卡器响应超时'})[p[4]]||'等待响应'} · 阶段${detail[0]}`);return p;};
  await r.poll(read,p=>p[0]>=1&&p[4]===0,10000);await checkpoint('reader-ready');
  await r.prompt(['点击开始后，将配套卡靠近读卡器。','显示0002表示已稳定读取UID。']);await r.q(CMD.START,1);await r.poll(read,p=>p[0]===2&&p[2]>=2&&p[4]===0,15000);const first=await r.q(CMD.SNAPSHOT,1),tail=await r.q(CMD.SNAPSHOT,3);const uid=[...first.slice(0,4),...tail].slice(0,first[4]);r.data.push({kind:'cardUID',length:first[4],uid:uid.map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()});await checkpoint('uid-stable');
  await r.prompt(['点击开始后移开卡片。','显示0003表示检测到卡片移开。']);await r.q(CMD.START,2);await r.poll(read,p=>p[0]===3&&p[3]>=3&&p[4]===0,10000);await checkpoint('removed');
 }else{
  await r.prompt([id===20?'清空秤盘并保持稳定。':id===21?'保持电子尺在初始位置。':'将平整障碍物放在约10～100厘米处并保持稳定。',meta.display]);await r.q(CMD.START,0);
  let last=-1;const base=[];
  const read=async()=>{const p=await r.q(CMD.SNAPSHOT),seq=unsigned(p,4);if(seq===last)return null;last=seq;const v=id===20?signed(p):unsigned(p);r.report(`当前${v}${id===18?'厘米':id===20?'（原始称重值）':' ADC'}`);return p[6]===1?v:null;};
  await r.poll(read,v=>{if(v===null)return false;base.push(v);if(base.length>7)base.shift();return base.length===7&&Math.max(...base)-Math.min(...base)<=(id===20?30:id===18?3:8);},20000);
  const rule=changeRule(base,id);r.data.push({kind:'baseline',...rule,samples:base.slice()});await checkpoint('baseline');
  const b=rule.baseline;if(id===20)await r.q(CMD.START,1,[b&255,(b>>8)&255]);
  await r.prompt([id===20?'点击开始后放上一个小物体。':id===21?'点击开始后拉出电子尺一小段。':'点击开始后把障碍物移近或移远至少5厘米。',meta.display]);
  let stable=0;const changed=await r.poll(read,v=>{if(v===null)return false;stable=Math.abs(v-b)>=rule.limit?stable+1:0;return stable>=3;},20000);r.data.push({kind:'change',value:changed,delta:changed-b,limit:rule.limit});await checkpoint('changed');
  if(id===20||id===21){await r.prompt([id===20?'点击开始后取下物体，等待恢复空载。':'点击开始后推回原来的位置。',meta.display]);stable=0;await r.poll(read,v=>{if(v===null)return false;stable=Math.abs(v-b)<=Math.max(rule.noise*2+2,Math.abs(changed-b)*0.25)?stable+1:0;return stable>=3;},20000);await checkpoint('restored');}
 }
 return {status:'NORMAL',source:'ASSISTED_AUTO',evidence:r.data};
}
