# 软件验证记录

日期：2026-09-08

## 已通过

- C 协议、会话/状态机、检查点/判定规则：3 个独立测试程序通过。
- JavaScript：23 项 Node 测试通过。
- 所有 `web/js/*.js` 通过语法检查。
- 页面必需结构和固件静态约束检查通过。
- 浏览器模拟闭环：快速核心计划可运行；红外故障生成 FAIL 和“红外链路”诊断；清除故障后复测生成新的 PASS attempt，旧 FAIL 证据仍保留。

复现命令：

```powershell
cd D:\系统编程\my_homework\project
powershell -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SoftwareOnly
```

## Keil 构建证据与阻塞

### Compact 可烧录基线

独立裸机 Compact 配置已由当前合法 C51 Eval 构建成功：CTRL、DUT、REF 的 MCU CODE 均为 `610` 字节，三个 HEX 文件各为 `1883` 字节。两种尺寸都低于 2048 字节并受自动门禁保护。三份日志均为 `0 Error(s), 0 Warning(s)`；与固件链接同源的 Compact HELLO/CRC 纯 C 模块通过主机黄金向量测试，Intel HEX 的记录长度、逐行校验和及 EOF 均通过验证。SHA-256 见项目根目录 `compact-release-manifest.json`。

Compact 只支持 UART1 2400、协议帧 CRC 和角色 HELLO，不代表完整自动验收固件或实板 PASS。

### 完整 BSP 固件

当前安装的 C51 V9.51 显示为 Eval Version。CTRL 工程完成编译和地址布局，链接日志记录：

```text
XDATA( 0X0000-0X06FF )
Program Size: data=94.7 xdata=539 code=9487
*** FATAL ERROR L250: CODE SIZE LIMIT IN RESTRICTED VERSION EXCEEDED
LIMIT: 0800H BYTES
```

因此当时不能生成可烧录 HEX，也不能生成正式发布清单。这不是源代码 DATA/XDATA 溢出。

**2026-09-08 更新**：合法完整版 C51 许可证就绪后，CTRL/DUT/REF 三个完整功能 HEX 已全部构建成功：

```text
CTRL  Program Size: data=94.7 xdata=539 code=9450   0 Error(s)
DUT   Program Size: data=94.7 xdata=539 code=9451   0 Error(s)
REF   Program Size: data=94.7 xdata=539 code=9450   0 Error(s)
```

构建产物为 `firmware/{ctrl,dut,ref}/output/Acceptance*.hex`（各约 27.8 KiB 文本 HEX）。

## 实物下板验证（2026-09-08）

三块学习板分别烧录对应角色的完整版 HEX，用 `scripts/verify-board.ps1` 通过 CH340（COM5，2400 8N1）验证：

| 角色 | HELLO 挑战 | 坏帧反例 | 往返耗时 | 结论 | 记录 |
| --- | --- | --- | --- | --- | --- |
| CTRL | 100/100 | 8/8 | avg 220.3 ms | PASS | `records/20260908-2212-CTRL-COM5.md` |
| DUT | 100/100 | 8/8 | avg 220.2 ms | PASS | `records/20260908-2214-DUT-COM5.md` |
| REF | 100/100 | 8/8 | avg 220.6 ms | PASS | `records/20260908-2215-REF-COM5.md` |

下板过程中定位并修复的两个缺陷：

1. `App_Init()` 里在 `MySTC_Init()` 之前初始化串口，BSP 系统初始化会重设中断使能，串口接收中断被清掉——数码管正常刷新但收不到任何帧。修复：拆出 `App_StartUart()`，在 `main()` 里于 `MySTC_Init()` 之后调用。
2. Keil C51 把指向 `xdata 0x0000` 的泛型指针当作空指针，而 `uart1_pending` 恰好分配在 xdata 0x0000，导致 `Proto_Decode` 的入参判空误报 `PROTO_ERR_ARGUMENT`。修复：该判空只在非 C51 目标保留。

## 尚未完成的硬件结论

- HELLO 层已通过；RS485 双板/三板、红外、RTC、EEPROM、传感器等 G1/G2/G3 项尚未执行。
- IR、RTC、ADC、EEPROM 的 P1 规则和纯逻辑已实现并测试，但尚未依据实际板卡档案接入 G4 固件。
- 所有需要人工或实物确认的记录保持未勾选；模拟数据不得用于证明实板通过。
