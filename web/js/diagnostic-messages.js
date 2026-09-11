export const repairNotice='报修请联系老师，勿自行操作。';

export const diagnosticMessages=[
  {id:1,name:'系统启动／复位',entries:{
    'reset-timeout':{label:'复位动作未检测到',reason:'点击开始后，系统没有检测到学习板重新启动。',advice:'确认按下的是RST复位键并重新测试；若多次无响应，检查供电后联系老师复查复位电路。'},
    fallback:{label:'启动通信异常',reason:'学习板启动后没有返回完整的诊断握手信息。',advice:'重新插拔USB并确认烧录了统一诊断HEX后重试；仍无响应再联系老师。'}
  }},
  {id:2,name:'USB／UART1',entries:{
    protocol:{label:'串口协议检查失败',reason:'USB串口在连续通信、坏帧拒绝或半帧恢复检查中未正确响应。',advice:'关闭STC-ISP和串口助手，重新插拔USB后重试；仍失败可更换数据线或USB口，再联系老师复查CH340和UART1链路。'},
    fallback:{label:'USB串口异常',reason:'PC与学习板之间的USB／UART1通信没有完成。',advice:'确认选择了正确的CH340串口并关闭占用串口的软件，然后重新连接测试。'}
  }},
  {id:3,name:'8路LED',entries:{
    manual:{label:'灯光现象异常',reason:'人工观察到L0～L7未按提示逐个点亮，或全亮、全灭现象不完整。',advice:'确认观察的是L0～L7并重新测试；若同一灯始终不亮或状态错误，联系老师复查LED、限流电阻和焊点。'},
    'manual-timeout':{label:'未完成灯光确认',reason:'倒计时结束前没有完成8路LED现象确认。',advice:'重新测试并观察完整的逐灯、全亮和全灭过程，再及时选择结果。'},
    fallback:{label:'LED测试异常',reason:'8路LED测试没有按预期完成。',advice:'确认操作正确后重新测试；仍异常再联系老师复查LED显示链路。'}
  }},
  {id:4,name:'8位数码管',entries:{
    manual:{label:'显示现象异常',reason:'人工观察到数码管存在缺段、缺位、错位或显示内容不完整。',advice:'重新观察全段、12345678和逐段图案；若固定位置持续异常，联系老师复查数码管及驱动焊点。'},
    'manual-timeout':{label:'未完成显示确认',reason:'倒计时结束前没有完成数码管现象确认。',advice:'重新测试并看完整个显示过程，再及时选择结果。'},
    fallback:{label:'数码管测试异常',reason:'8位数码管测试没有按预期完成。',advice:'确认操作正确后重新测试；仍异常再联系老师复查显示链路。'}
  }},
  {id:5,name:'K1／K2／K3',entries:{
    'wrong-key':{label:'按键与提示不一致',reason:'检测期间收到了其他按键的信号，当前按键结果不能确认。',advice:'看清页面当前要求，只按对应的K键并完整松开后重试。'},
    timeout:{label:'按键动作未检测到',reason:'倒计时内没有同时检测到当前按键的按下和松开。',advice:'重新按下并松开页面指定的按键；若同一按键多次无反馈，联系老师复查按键和焊点。'},
    fallback:{label:'按键检测异常',reason:'K1／K2／K3检测没有按预期完成。',advice:'确认没有同时按多个键并逐项重试；仍异常再联系老师。'}
  }},
  {id:6,name:'五向导航键',entries:{
    'wrong-key':{label:'方向与提示不一致',reason:'检测期间收到了非当前方向的导航键信号。',advice:'按页面顺序只操作当前方向，按下后完整松开，再重新测试。'},
    timeout:{label:'导航动作未检测到',reason:'倒计时内没有检测到当前方向的按下和松开。',advice:'确认按压方向和中心位置正确后重试；若固定方向持续无响应，联系老师复查导航键、分压电阻和焊点。'},
    fallback:{label:'导航键检测异常',reason:'五向导航键检测没有按预期完成。',advice:'按页面提示逐方向重试；仍异常再联系老师。'}
  }},
  {id:7,name:'蜂鸣器',entries:{
    manual:{label:'声音现象异常',reason:'人工确认没有听到三段短音，或实际声音与提示明显不符。',advice:'保持环境安静并重新测试；若仍无声或声音持续异常，联系老师复查蜂鸣器、驱动和焊点。'},
    'manual-timeout':{label:'未完成声音确认',reason:'倒计时结束前没有完成蜂鸣器声音确认。',advice:'在安静环境中重新测试，听完三段短音后及时选择结果。'},
    fallback:{label:'蜂鸣器测试异常',reason:'蜂鸣器测试没有按预期完成。',advice:'确认操作正确后重新测试；仍异常再联系老师。'}
  }},
  {id:8,name:'温度采集',entries:{
    'sample-frozen':{label:'温度数据未更新',reason:'热敏电阻ADC采样值长时间没有刷新。',advice:'重新连接后复测；若数值仍固定不变，联系老师复查热敏电阻、分压电阻和ADC引脚。'},
    'no-change':{label:'温度变化不足',reason:'已取得基准值，但轻捂Rt热敏电阻后没有检测到持续变化。',advice:'确认触摸的是标有Rt的热敏电阻并保持几秒后重试；仍无变化再联系老师。'},
    fallback:{label:'温度采集链路异常',reason:'温度采集没有得到足以判定模块正常的有效证据。',advice:'确认触摸位置和操作正确后重试；仍异常再联系老师复查热敏电阻、分压电阻和ADC线路。'}
  }},
  {id:9,name:'光照采集',entries:{
    'sample-frozen':{label:'光照数据未更新',reason:'光敏电阻ADC采样值长时间没有刷新。',advice:'重新连接后复测；若数值仍固定不变，联系老师复查光敏电阻、分压电阻和ADC引脚。'},
    'no-change':{label:'明暗变化不足',reason:'遮挡和恢复光照过程中，采样值没有出现足够且可重复的变化。',advice:'确认完全遮住的是光敏电阻，并按提示遮挡、移开后重试；仍无变化再联系老师。'},
    fallback:{label:'光照采集链路异常',reason:'光照采集没有得到足以判定模块正常的有效证据。',advice:'确认遮挡位置和操作正确后重试；仍异常再联系老师复查光敏电阻、分压电阻和ADC线路。'}
  }},
  {id:10,name:'霍尔传感器',entries:{
    'no-near':{label:'未检测到磁铁靠近',reason:'倒计时内没有检测到霍尔传感器的靠近状态变化。',advice:'换用磁铁另一面并靠近霍尔元件后重试；仍无反应再联系老师复查霍尔元件和焊点。'},
    'no-leave':{label:'未检测到磁铁离开',reason:'系统已检测到磁铁靠近，但移开后状态没有恢复。',advice:'把磁铁移得更远并重试完整的靠近、离开过程；仍不能恢复再联系老师。'},
    fallback:{label:'霍尔检测异常',reason:'霍尔传感器没有完成靠近和离开两阶段检测。',advice:'确认使用磁铁并按提示完整操作后重试；仍异常再联系老师。'}
  }},
  {id:11,name:'振动传感器',entries:{
    timeout:{label:'未检测到振动',reason:'轻晃学习板后，倒计时内没有收到振动事件。',advice:'轻晃整块学习板而不是敲击其他器件后重试；仍无计数再联系老师复查振动元件和焊点。'},
    fallback:{label:'振动检测异常',reason:'振动传感器没有提供有效触发证据。',advice:'按页面提示轻晃学习板后重试；仍异常再联系老师。'}
  }},
  {id:12,name:'RTC时钟',entries:{
    'invalid-time':{label:'时钟数据无效',reason:'RTC返回的时分秒或日期不是有效的BCD时间数据。',advice:'重新上电后观察数码管HH-MM-SS并复测；仍显示异常再联系老师复查RTC芯片、晶振、电池座和焊点。'},
    'clock-stopped':{label:'时钟没有正常走动',reason:'连续读取的RTC时间没有按合理间隔向前推进。',advice:'确认数码管时间是否走动后重试；仍不走时再联系老师复查RTC芯片、晶振和供电。'},
    fallback:{label:'RTC读取异常',reason:'系统没有取得连续、有效且正常推进的RTC时间。',advice:'重新上电后复测；仍异常再联系老师复查RTC相关器件。'}
  }},
  {id:13,name:'EEPROM存储',entries:{
    'backup-save':{label:'安全备份未保存',reason:'EEPROM原值的本地安全备份未能保存，系统已停止后续写入。',advice:'确认浏览器允许本地存储并重新启动页面后重试；不要在此状态下自行反复断电。'},
    'verify-restore':{label:'写入或恢复校验失败',reason:'EEPROM测试数据校验、原值恢复或恢复后的再次校验未通过。',advice:'保留导出的报告并重新测试一次；若仍失败，联系老师复查EEPROM芯片、总线和焊点。'},
    fallback:{label:'EEPROM测试异常',reason:'EEPROM安全备份、写入、校验和恢复流程没有完整通过。',advice:'不要在测试中断电或复位，重新测试；仍异常再联系老师。'}
  }},
  {id:14,name:'FM收音机／耳机',entries:{
    manual:{label:'收音现象异常',reason:'人工确认耳机中没有可辨识广播，或实际声音与提示明显不符。',advice:'换用已知正常的有线耳机并移动到接收较好的位置后重试；只有沙沙噪声不能证明收音正常。'},
    'manual-timeout':{label:'未完成收音确认',reason:'倒计时结束前没有完成FM收音和耳机输出确认。',advice:'插好有线耳机并重新测试，听到可辨识广播后及时选择结果。'},
    fallback:{label:'FM／耳机链路异常',reason:'FM收音与耳机输出测试没有按预期完成。',advice:'检查耳机是否插到底并重新测试；仍异常再联系老师复查收音和耳机输出链路。'}
  }},
  {id:15,name:'红外收发',entries:{
    command:{label:'红外通信命令异常',reason:'两板在准备或发送红外数据时出现命令错误。',advice:'重新连接两块板，确认都烧录同一诊断HEX后多测试几次；若始终完全不能双向收发，再联系老师。'},
    'no-signal':{label:'未收到有效红外数据',reason:'两块板均没有报告对端发来的有效红外数据。',advice:'把两板红外头相对放在10～20厘米、保持无遮挡并多测试几次；若两板多次仍完全不能双向收发，再联系老师。'},
    'one-direction':{label:'红外单向收发不足',reason:'一个方向能够收到数据，但另一个方向的有效包不足。',advice:'重新对准两板红外发射和接收器件并交换方向多测试几次；若同一方向始终失败，再联系老师。'},
    'packet-loss':{label:'红外有效包不足',reason:'两板已收到红外数据，但完整有效包数量未达到每个方向至少4／5。',advice:'减少强光干扰，调整距离和角度后多测试几次；只有多次仍完全无法双向收发时再联系老师。'},
    fallback:{label:'红外收发异常',reason:'本轮红外双向通信没有达到通过标准。',advice:'按页面要求重新对准并多测试几次；若两板多次仍完全不能双向收发，再联系老师。'}
  }},
  {id:16,name:'扩展模块——RS485收发',entries:{
    command:{label:'RS485通信命令异常',reason:'两板在准备或发送RS485数据时出现命令错误。',advice:'断电复查接线，重新连接两块板并重试；仍失败再联系老师。'},
    'no-signal':{label:'未收到有效RS485数据',reason:'两块板均没有报告对端发来的有效RS485数据。',advice:'断电确认A-A、B-B和参考地连接正确且未连接VCC，然后重新测试。'},
    'one-direction':{label:'RS485单向通信不足',reason:'一个方向能够收到数据，但另一个方向的有效包不足。',advice:'断电复查A、B和参考地接线，并交换两板角色复测；仍为同一方向失败再联系老师。'},
    'packet-loss':{label:'RS485有效包不足',reason:'两板存在收发数据，但完整有效包数量未达到每个方向至少4／5。',advice:'断电压紧杜邦线并确认共地后重试；仍不稳定再联系老师复查接口。'},
    fallback:{label:'RS485收发异常',reason:'本轮RS485双向通信没有达到通过标准。',advice:'确认使用正确接线并重新测试；仍异常再联系老师。'}
  }},
  {id:17,name:'扩展模块——SM步进电机',entries:{
    command:{label:'步进电机驱动命令异常',reason:'学习板没有正确完成步进电机的运行或停止命令。',advice:'断电复查SM插头方向和线序后重试；仍失败再联系老师复查接口和ULN2003驱动。'},
    manual:{label:'步进电机动作异常',reason:'人工确认电机的正转、反转、两档速度或停止现象不符合提示。',advice:'确认使用课程原配步进电机并清空转轴周围后重试；仍异常再联系老师。'},
    'manual-timeout':{label:'未完成电机确认',reason:'自动运行结束后，倒计时内没有完成步进电机动作确认。',advice:'重新测试并观察完整的正转、加速、停止、反转过程，再及时选择结果。'},
    fallback:{label:'步进电机测试异常',reason:'步进电机测试没有取得完整的运行和人工观察结果。',advice:'断电核对SM接线后重新测试；仍异常再联系老师。'}
  }},
  {id:18,name:'扩展模块——超声波测距',entries:{
    baseline:{label:'距离基准无效或不稳定',reason:'超声波模块没有取得连续稳定的有效距离。',advice:'确认5V、GND、Echo和Trig接线，使用平整障碍物并保持10～100厘米后重试。'},
    'no-change':{label:'距离变化未检测到',reason:'基准距离有效，但移动障碍物后没有检测到至少约5厘米的稳定变化。',advice:'将平整障碍物明显移近或移远并保持不动后重试；仍无变化再联系老师。'},
    fallback:{label:'超声波测距异常',reason:'超声波测距没有取得稳定基准和距离变化证据。',advice:'确认模块方向、接线和障碍物位置后重试；仍异常再联系老师。'}
  }},
  {id:19,name:'扩展模块——直流电机',entries:{
    command:{label:'直流电机驱动命令异常',reason:'学习板没有正确完成直流电机的PWM运行或停止命令。',advice:'断电检查课程配套驱动模块和EXT接线后重试，不要把裸电机直接接IO。'},
    manual:{label:'直流电机动作异常',reason:'人工确认电机的正转、反转、两档速度或停止现象不符合提示。',advice:'确认使用课程配套驱动组件并清空转轴周围后重试；仍异常再联系老师。'},
    'manual-timeout':{label:'未完成电机确认',reason:'自动运行结束后，倒计时内没有完成直流电机动作确认。',advice:'重新测试并观察完整的正转、调速、停止、反转过程，再及时选择结果。'},
    fallback:{label:'直流电机测试异常',reason:'直流电机测试没有取得完整的运行和人工观察结果。',advice:'断电核对驱动组件和EXT接线后重新测试；仍异常再联系老师。'}
  }},
  {id:20,name:'扩展模块——电子秤',entries:{
    baseline:{label:'空载基准不稳定',reason:'电子秤在空载状态下没有取得连续稳定的基准值。',advice:'清空秤盘并放在稳定平面，检查模块供电和线束后重试。'},
    'no-change':{label:'加载变化未检测到',reason:'放上物体后，称重原始值没有出现持续且足够的变化。',advice:'使用稍重的小物体并保持秤盘稳定后重试；仍无变化再联系老师复查称重模块和传感器。'},
    'no-restore':{label:'卸载后未恢复',reason:'取下物体后，称重值没有回到接近原空载基准。',advice:'确认物体已完全取下且秤盘没有受力，等待稳定后重试；仍不恢复再联系老师。'},
    fallback:{label:'电子秤检测异常',reason:'电子秤没有完整通过空载、加载和卸载恢复检查。',advice:'确认接线和操作正确后重新测试；仍异常再联系老师。'}
  }},
  {id:21,name:'扩展模块——电子尺',entries:{
    baseline:{label:'电子尺基准不稳定',reason:'电子尺保持初始位置时，ADC值没有形成稳定基准。',advice:'确认5V、GND和P1.1信号接线，保持滑杆不动后重试。'},
    'no-change':{label:'拉出变化未检测到',reason:'拉出电子尺后，ADC值没有出现持续且足够的变化。',advice:'将电子尺明显拉出一段并保持后重试；仍无变化再联系老师复查供电、P1.1和滑动接触。'},
    'no-restore':{label:'推回后未恢复',reason:'电子尺推回初始位置后，ADC值没有回到接近基准。',advice:'确认滑杆已推回原位并保持不动后重试；仍不恢复再联系老师。'},
    fallback:{label:'电子尺检测异常',reason:'电子尺没有完整通过基准、拉出变化和推回恢复检查。',advice:'确认接线和操作正确后重新测试；仍异常再联系老师。'}
  }},
  {id:22,name:'扩展模块——电子转角测量器',entries:{
    'no-pulse':{label:'未检测到转动脉冲',reason:'转动器件后没有收到有效的A／B相信号。',advice:'确认5V、GND和两相信号接线，顺时针转动几格后重试；仍无计数再联系老师。'},
    'one-direction':{label:'只检测到一个方向',reason:'已经收到转动脉冲，但顺时针和逆时针中只有一个方向被识别。',advice:'按提示向两个方向各转几格并重试；仍只识别一个方向再联系老师复查A／B相接线。'},
    fallback:{label:'电子转角检测异常',reason:'电子转角测量器没有提供两个方向的完整脉冲证据。',advice:'确认线束和双向旋转操作正确后重试；仍异常再联系老师。'}
  }},
  {id:23,name:'扩展模块——RFID读卡器',entries:{
    communication:{label:'读卡器通信异常',reason:'学习板没有从RFID读卡器取得有效版本或通信响应。',advice:'断电复查课程适配板的EXT＋SM组合接线和中间两针留空位置后重试。'},
    seek:{label:'未能稳定寻卡',reason:'读卡器已经就绪，但卡片靠近后没有完成寻卡或防冲突响应。',advice:'使用课程程序验证过的卡片，贴近天线不同位置并保持不动后重试。'},
    cascade:{label:'卡号级联响应异常',reason:'读卡器收到卡片响应，但级联卡号格式不完整。',advice:'移开其他卡片，只保留一张配套卡靠近后重试；仍失败再联系老师。'},
    select:{label:'选卡校验失败',reason:'读卡器能够发现卡片，但选卡阶段的校验没有通过。',advice:'将单张卡片平稳贴近天线后重试；多张已验证卡均失败再联系老师。'},
    timeout:{label:'读卡器响应超时',reason:'RFID读卡器在当前阶段长时间没有返回有效响应。',advice:'断电复查EXT＋SM接线，重新连接后再测试；仍超时再联系老师。'},
    'not-ready':{label:'读卡器未就绪',reason:'规定时间内没有完成RFID读卡器初始化。',advice:'移开卡片，断电检查课程适配板接线后重新连接并重试。'},
    'card-not-read':{label:'卡片UID未稳定读取',reason:'读卡器已就绪，但靠近卡片后没有取得稳定UID。',advice:'使用课程程序验证过的卡片，贴近天线并保持不动后重试；仍无法读取再联系老师。'},
    'card-not-removed':{label:'卡片移开未识别',reason:'UID已经读取，但移开卡片后状态没有恢复。',advice:'把卡片移到远离天线的位置并重试完整流程；仍不恢复再联系老师。'},
    fallback:{label:'RFID只读测试异常',reason:'RFID读卡器没有完整通过就绪、读取UID和卡片移开检查。',advice:'断电核对课程适配板接线并使用已验证卡片重试；仍异常再联系老师。'}
  }}
];

const project=id=>diagnosticMessages[id-1];
const hasText=(text,part)=>text.includes(part);
const snapshots=result=>(result.evidence||[]).filter(entry=>entry&&entry.cmd===20&&Array.isArray(entry.p));
const hasBaseline=result=>(result.evidence||[]).some(entry=>entry&&typeof entry==='object'&&(entry.kind==='baseline'||Object.hasOwn(entry,'baseline')));

function linkKey(result){
  const summary=(result.evidence||[]).find(entry=>entry?.kind==='linkSummary');
  if(hasText(result.reason||'','命令错误')||summary?.trials?.some(trial=>trial.error))return 'command';
  const counts=summary?.counts;
  if(!Array.isArray(counts))return 'fallback';
  if(counts[0]===0&&counts[1]===0)return 'no-signal';
  if((counts[0]>=4)!==(counts[1]>=4))return 'one-direction';
  return 'packet-loss';
}

function sensorStageKey(id,result,checkpoint){
  if(hasText(result.reason||'','采样数据未更新'))return 'sample-frozen';
  if(id===8||id===9)return hasBaseline(result)?'no-change':'fallback';
  const stage=checkpoint?.stage;
  if(id===18)return stage==='baseline'?'no-change':'baseline';
  if(id===20||id===21){
    if(stage==='changed')return 'no-restore';
    if(stage==='baseline')return 'no-change';
    return 'baseline';
  }
  return 'fallback';
}

function hallKey(result){
  const sawNear=snapshots(result).some(entry=>Boolean(entry.p[1]&1));
  return sawNear?'no-leave':'no-near';
}

function angleKey(result){
  const values=snapshots(result).map(entry=>entry.p);
  const count=values.reduce((best,p)=>Math.max(best,(p[1]||0)|((p[2]||0)<<8)),0);
  return count>0?'one-direction':'no-pulse';
}

function rfidKey(result,checkpoint){
  const error=snapshots(result).map(entry=>entry.p[5]||0).find(Boolean);
  if(error===1)return 'communication';
  if(error===2)return 'seek';
  if(error===3)return 'cascade';
  if(error===4)return 'select';
  if(error===6)return 'timeout';
  if(checkpoint?.stage==='uid-stable')return 'card-not-removed';
  if(checkpoint?.stage==='reader-ready')return 'card-not-read';
  return 'not-ready';
}

export function failureKey(id,result,context={}){
  const reason=result.reason||'';
  if(hasText(reason,'人工确认超时')||hasText(reason,'确认超时')||hasText(reason,'未收到明确人工确认'))return 'manual-timeout';
  if(result.source==='MANUAL'&&hasText(reason,'操作者确认'))return 'manual';
  if(hasText(reason,'检测到其他按键'))return 'wrong-key';
  if(id===1&&hasText(reason,'操作窗口超时'))return 'reset-timeout';
  if(id===2)return 'protocol';
  if(id===8||id===9||id===18||id===20||id===21)return sensorStageKey(id,result,context.checkpoint);
  if(id===10&&hasText(reason,'超时'))return hallKey(result);
  if(id===11&&hasText(reason,'超时'))return 'timeout';
  if(id===12){
    if(/BCD|范围|日期无效/.test(reason))return 'invalid-time';
    if(hasText(reason,'未正常推进'))return 'clock-stopped';
  }
  if(id===13){
    if(/保存|disk|storage|备份.*失败/i.test(reason)&&!hasText(reason,'恢复'))return 'backup-save';
    if(/校验|恢复/.test(reason))return 'verify-restore';
  }
  if(id===15||id===16)return linkKey(result);
  if((id===17||id===19)&&/命令|停止状态/.test(reason))return 'command';
  if(id===22)return angleKey(result);
  if(id===23)return rfidKey(result,context.checkpoint);
  if(hasText(reason,'操作窗口超时'))return 'timeout';
  return 'fallback';
}

export function untestedMessage(result={}){
  const reason=result.reason||'';
  if(hasText(reason,'未连接辅助板'))return '未连接辅助板，本项未获得有效检测结果。';
  if(hasText(reason,'连接中断'))return '测试期间连接中断，本项未获得有效检测结果。';
  if(hasText(reason,'用户跳过')||result.cancelled)return '本项已跳过，未获得有效检测结果。';
  return reason&&reason!=='尚未执行'?reason:'本项尚未测试。';
}

export function resolveDiagnosticMessage(id,result,context={}){
  if(result.status==='UNTESTED'&&result.source==='MANUAL'&&/确认超时|未收到明确人工确认/.test(result.reason||''))result={...result,status:'ABNORMAL'};
  if(result.status==='NORMAL')return {...result,reason:'',advice:'',repairNotice:'',failureCode:''};
  if(result.status==='UNTESTED')return {...result,reason:untestedMessage(result),advice:'',repairNotice:'',failureCode:''};
  const item=project(id);
  const failureCode=failureKey(id,result,context);
  const message=item?.entries[failureCode]||item?.entries.fallback||{reason:'本项检测没有按预期完成。',advice:'确认操作正确后重新测试；仍异常再联系老师。'};
  return {...result,failureCode,reason:message.reason,advice:message.advice,repairNotice};
}
