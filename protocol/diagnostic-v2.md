# 统一诊断协议（固件2.1.1，帧version=2）

> 本文件保留1～16协议基础说明；当前交付版本为2.3.0。HELLO版本、能力字节以及17～23扩展定义以[extension-v2.2.md](extension-v2.2.md)为准。

## 基本帧

固定24字节：A5 5A | version | command | src | dst | attempt(2) | seq(2) | test | step | length | flags | payload(8) | CRC(2)。多字节字段小端；CRC-16/MODBUS覆盖索引2～21。请求src=0,dst=1,flags=0,length=8；响应command=request|0x80,src=1,dst=0,flags=1。两块板通过不同USB串口区分，不使用永久地址区分。

命令：HELLO=1、CAPABILITIES=2、PREPARE=16、START=17、STATUS=18、STOP=19、SNAPSHOT=20、BACKUP=21、ROLE=22、PROGRESS=23、ARM=32、SEND=33。PREPARE创建非0 attempt；测试命令需匹配attempt与test。相同请求缓存响应，START防重复事务。BACKUP返回EEPROM原值、测试值、测试读回、恢复读回；START EEPROM的payload[0]必须带回原值。

双板业务帧8字节：D3 71 | token低 | token高 | trial | direction | CRC低 | CRC高；CRC覆盖前6字节。

## 状态与证据

24字节和CRC覆盖范围不变；响应payload[0]为命令状态，其后至多7字节。网页要求HELLO payload[1..3]=2,1,1，拒绝不兼容固件。HELLO uptime仍在payload[4..7]，10ms单位。

- ROLE=22：请求payload[0]=0/1/2；停止后可设置角色，运行中拒绝。上电00、被测01、辅助02。STOP保留角色。
- PROGRESS=23：空闲时设置数码管0～10，用于UART挑战进度。ACK不证明显示光学正常。
- STATUS：响应状态后为 phase,error,ageLo,ageHi,displayStage,0,0。EEPROM stage=1～5。
- SNAPSHOT page0：输入返回按下/释放/错误/键编号；ADC返回Rt、Rop、样本号（各16位小端）；RTC返回秒分时日月周年BCD。链路为 matched,errorCount,lastRxBytes,completeFrames,crcValid,txAccepted,driverIdleAfterSend。
- SNAPSHOT page1（step=1，仅15/16）：duplicateCount,crcErrors,identityErrors,shortPackets,trial,direction,driverStatus。
- ARM序号0～4，direction=0/1。清空单次试次证据；相同USB请求重试仍走协议缓存，避免重复发送。业务包保留8字节。

PC串行调度双向各5个不同序号，每包最多额外重试2次；各至少4个有效序号为正常。PC记录序号、方向、重试、rx/tx/page1和超时统计。板上显示方向1/2及本板该方向累计有效接收数；不会重复累加同一序号。

倒计时由PC动作窗口唯一管理，不将准备时间写进固件硬件运行时间；每步时长见diagnostic-feedback.js。固件5秒无合法命令安全退出，网页准备等待期间发心跳。EEPROM先恢复才处理安全退出。断开页面后只能依靠此超时，不能声称一定发送成功STOP。

红外发射API返回成功仅表示驱动接受请求；其后空闲也不证明红外LED真的发光。只有对端匹配包支持物理链路通过。错误定位为疑似链路问题，不能直接定位坏元件。

数据边界：不把所有计划字段塞进单个7字节响应。原始证据分页；PC计算基线、变化、倒计时与汇总。RTC不验证电池；数码管实际显示需人工核对；EEPROM只抽测0x7F。
