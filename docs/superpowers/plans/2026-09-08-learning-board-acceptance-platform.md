# 学习板自动验收与故障定位平台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `D:/系统编程/my_homework/project` 交付一个可离线运行的 PC 测试管理端、三个可由 Keil C51 编译的 CTRL/DUT/REF 固件，以及协议、自动化测试、构建记录和现场联调说明，形成 P0 验收闭环并为 P1 硬件测试保留真实接口。

**Architecture:** 三个固件共享一套固定 24 字节协议与纯 C 状态机，但通过独立 Keil 工程生成带固定角色的三个 HEX。PC 端采用无构建依赖的 ES Modules，按协议层、会话引擎、测试目录、证据存储、故障规则、报告和界面分层；在无硬件时使用内置三节点模拟器完成全流程回归，真实 Web Serial 模式只接受实际节点证据。

**Tech Stack:** Keil C51/µVision 4、STC15F2K60S2、STCBSP V3.6、C89、PowerShell、Node.js 24 原生测试、HTML/CSS/JavaScript、Web Serial、IndexedDB。

**Spec:** `D:/系统编程/my_homework/学习板自动验收与故障定位平台_详细实施设计与团队交接.md`

## Global Constraints

- 代码时钟固定为 `11059200`；目标器件为 `STC15F2K60S2 Series`。
- 保留教师 BSP 的 `inc` 和 `STCBSP_V3.6.LIB` 配套，IncludePath 为 `.\inc`，XRAM 不扩大到详细设计禁止的范围。
- `while (1)` 内唯一语句为 `MySTC_OS();`；业务由事件回调和 10 ms/1 s 非阻塞任务推进。
- UART1 初始 2400 bps，RS485 初始 1200 bps；固定帧 24 字节，SOF `A5 5A`，协议版本 1，CRC-16/MODBUS 仅作为帧校验算法。
- 所有测试明确区分 `PASS/FAIL/BLOCKED/INCONCLUSIVE/SKIPPED/ABORTED` 与 `AUTO/ASSISTED_AUTO/MANUAL`；模拟结果不得标成真实硬件结果。
- EEPROM 写入、掉电和电机动作默认无授权；P0 不启用电机，EEPROM 只允许 `0x10..0x1F` 且先备份、确认 PC 已保存、再写入、最后恢复校验。
- 不改动 `作业5-0`、Keil 示例、两份交接文档和候选方案源文件。

---

### Task 1: 协议单一事实源与黄金向量

**Files:**
- Create: `protocol/protocol.md`
- Create: `shared/protocol.h`, `shared/protocol.c`
- Create: `web/js/protocol.js`
- Create: `tests/c/test_protocol.c`, `tests/js/protocol.test.mjs`, `tests/run-c-tests.ps1`

**Interfaces:**
- Produces: `ProtoFrame`, `Proto_Encode`, `Proto_Decode`, `Proto_Crc16`, `FrameStreamDecoder`, `encodeFrame`, `decodeFrame`。
- Guarantees: 24 字节帧、8 字节 payload、20 字节 CRC 范围、保留位清零、严格长度/版本/地址/会话检查。

- [x] **Step 1: 写 C 与 JS 失败测试。** 覆盖 `123456789 -> 0x4B37`、HELLO 黄金帧、CRC 错、payload 长度 9、错误版本、错误目标、半帧、粘包、垃圾前缀和帧内 SOF。
- [x] **Step 2: 分别运行 `tests/run-c-tests.ps1` 和 `node --test tests/js/protocol.test.mjs`，确认因协议接口不存在而失败。**
- [x] **Step 3: 用整数和固定数组实现 C89 编解码器；用 `Uint8Array` 实现 JS 编解码器和流拆帧器。** 禁止结构体内存直发，所有多字节字段显式小端读写。
- [x] **Step 4: 运行双端测试并比对同一个硬编码黄金帧。** 预期全部通过，且不是编码器自生成预期。

### Task 2: 固件会话、幂等和安全状态机

**Files:**
- Create: `shared/platform_types.h`, `shared/session.h`, `shared/session.c`
- Create: `shared/test_engine.h`, `shared/test_engine.c`
- Create: `shared/records.h`, `shared/records.c`
- Create: `tests/c/test_engine.c`

**Interfaces:**
- Consumes: `ProtoFrame`。
- Produces: `SessionState`, `TestEngine`, `Engine_HandleFrame`, `Engine_Tick10ms`, `Engine_RequestCancel`, `RecordStore_ReadChunk`。
- Guarantees: 重复 `(session, seq, attempt)` 不重做动作；超时和取消先进入 cleanup；旧 attempt 和运行中配置修改被拒绝。

- [x] **Step 1: 添加失败测试。** 覆盖 HELLO、BEGIN_SESSION、CONFIG_WRITE/COMMIT、RUN_PLAN、BUSY、重复 EXECUTE、租约到期、取消、记录分片、旧会话和错误状态。
- [x] **Step 2: 运行 C 测试并确认缺失接口导致失败。**
- [x] **Step 3: 实现最小有限状态机和 2 槽发送/记录缓存。** 每槽拥有自己的静态 24 字节生命周期，结果 ACK 与测试 verdict 分离。
- [x] **Step 4: 运行全部 C 测试，确认安全路径和错误码通过。**

### Task 3: 三角色 BSP 固件与 Keil 工程

**Files:**
- Create: `firmware/common/*.c`, `firmware/common/*.h`
- Create: `firmware/ctrl/source/main.c`, `firmware/dut/source/main.c`, `firmware/ref/source/main.c`
- Create: `firmware/{ctrl,dut,ref}/Acceptance{Ctrl,Dut,Ref}.uvproj`
- Create: `firmware/{ctrl,dut,ref}/build.ps1`, `firmware/build-all.ps1`, `firmware/verify-source.ps1`
- Copy: matching BSP `inc/*` and `source/STCBSP_V3.6.LIB` into each role project.

**Interfaces:**
- Consumes: shared protocol/session/engine code。
- Produces: `AcceptanceCtrl.hex`, `AcceptanceDut.hex`, `AcceptanceRef.hex`。
- Role behavior: CTRL 是唯一计划调度者；DUT 执行受限测试动作并返回原始证据；REF 只在 TX_LEASE 窗口提供激励。

- [x] **Step 1: 先写 `verify-source.ps1` 的失败检查。** 检查三个 `SysClock`、BSP 初始化顺序、主循环单语句、固定角色、静态 UART 缓冲、工程库/IncludePath/HEX 输出和 `0x06FF` XRAM 上限。
- [x] **Step 2: 运行脚本并确认空工程失败。**
- [ ] **Step 3: 从 `作业5-0/file/01-Uart1` 同版本资产建立三个工程。** 实现显示安全初态、UART1/2 固定帧收发、角色 HELLO、CRC 错误计数、10 ms 引擎 tick；DUT/REF 加 IR 12 字节缓存，DUT 加 RTC、ADC、按键和 EEPROM 的受限适配器。
- [ ] **Step 4: 运行源检查与 `firmware/build-all.ps1`。** 每个日志必须有 `0 Error(s)`，三个 HEX 必须存在；保存 `.m51` 并记录 CODE/DATA/XDATA。

### Task 4: PC 会话引擎、测试目录与诊断规则

**Files:**
- Create: `web/js/catalog.js`, `web/js/engine.js`, `web/js/diagnostics.js`, `web/js/simulator.js`
- Create: `tests/js/engine.test.mjs`, `tests/js/diagnostics.test.mjs`

**Interfaces:**
- Consumes: protocol functions and a transport `{open, close, send, onFrame}`。
- Produces: `AcceptanceEngine`, `TEST_CATALOG`, `diagnoseAttempt`, `SimulatedRig`。
- Guarantees: HELLO→配置快照→BEGIN→COMMIT→READY→RUN；重测新 attempt；失败历史不可覆盖；模拟运行有醒目标识。

- [x] **Step 1: 写失败测试。** 覆盖四类自动测试、BLOCKED 前提、FAIL 后重测 PASS、人工确认分类、IR 遮挡 D1 定位、485 断路证据不足、旧回调不污染新会话、双击开始只创建一轮。
- [x] **Step 2: 运行 Node 测试并确认预期失败。**
- [x] **Step 3: 实现快速核心目录 T01 UART、T02 RS485、T03 IR、T04 RTC、T05 EEPROM，以及 T07/T08/T09/T10/T11 的 P1 目录与前提。** 模拟器只模拟协议节点，不绕过引擎和规则。
- [x] **Step 4: 运行测试，确认自动、辅助自动、人工和不可判定边界正确。**

### Task 5: 证据存储、恢复与 JSON/HTML 导出

**Files:**
- Create: `web/js/storage.js`, `web/js/report.js`
- Create: `tests/js/storage.test.mjs`, `tests/js/report.test.mjs`

**Interfaces:**
- Produces: `EvidenceStore`, `createRunRecord`, `exportRunJson`, `exportRunHtml`。
- Guarantees: 主键含 run UUID、origin、attempt、record id；固件版本、板号、阈值、原始帧、人工操作者和证据缺口可追溯；HTML 全部转义。

- [x] **Step 1: 写内存后端失败测试。** 覆盖重启恢复标志、分片重复/冲突、FAIL 后 PASS 共存、IndexedDB 保存失败禁止 EEPROM 写授权、恶意文本导出转义。
- [x] **Step 2: 运行测试并确认接口缺失。**
- [x] **Step 3: 实现 IndexedDB 后端与测试用内存后端，实现 JSON/独立 HTML 报告下载。**
- [x] **Step 4: 运行存储和报告测试，并人工打开生成的报告样例。**

### Task 6: Web Serial 与操作界面

**Files:**
- Create: `web/index.html`, `web/style.css`, `web/js/serial-transport.js`, `web/js/app.js`
- Create: `web/verify-web.ps1`, `tests/js/serial-transport.test.mjs`

**Interfaces:**
- Produces: 角色卡、计划选择、测试进度、原始证据抽屉、诊断建议、复测、取消、人工确认和导出操作。
- Guarantees: 每 COM 口单写队列；2400 bps 帧后额外 20 ms；断开释放 reader/writer 锁；模拟/真实模式视觉上不可混淆。

- [x] **Step 1: 写传输失败测试和页面静态检查。** 覆盖串行写、关闭时锁释放、断开中止、缺 Web Serial 提示和必需 DOM id。
- [x] **Step 2: 运行测试并确认失败。**
- [x] **Step 3: 实现三栏仪表盘和 Web Serial 适配。** 默认打开模拟演示但以黄色横幅标记；切换真实模式后禁止生成模拟 PASS。
- [x] **Step 4: 运行 `node --test tests/js/*.test.mjs`、`node --check web/js/*.js` 和 `web/verify-web.ps1`。**

### Task 7: P1 适配、检查点和现场验证表

**Files:**
- Create: `firmware/common/test_adapters.c`, `firmware/common/checkpoint.c`
- Create: `tests/c/test_checkpoint.c`, `docs/hardware-baseline.md`, `docs/on-board-validation.md`, `docs/test-record-template.md`

**Interfaces:**
- Produces: RTC 推进、温光变化、超声波、输入事件、声光人工项目的有界适配；CTRL 32 字节 A/B 检查点纯逻辑。
- Guarantees: 无新鲜度证据的超声波为 INCONCLUSIVE；声光只可人工确认；EEPROM 未确认型号/原值时 BLOCKED。

- [x] **Step 1: 写检查点 generation、CRC、部分损坏选择和恢复失败测试。**
- [x] **Step 2: 运行 C 测试并确认失败。**
- [x] **Step 3: 实现 P1 适配与检查点纯逻辑；所有现场参数留在可编辑配置，不写虚构实测值。**
- [x] **Step 4: 完成 G0/G1/G2 现场表格。** 所有需要人确认的项目保持未勾选，给出接线、烧录、100 次挑战、遮挡/恢复和 EEPROM 恢复步骤。

### Task 8: 全量验证与交付说明

**Files:**
- Create: `README.md`, `CHANGELOG.md`, `release-manifest.json`, `scripts/verify-all.ps1`
- Modify: plan checkboxes with actual completion evidence.

**Interfaces:**
- Produces: 一键软件验证、三个可烧录 HEX、可离线网页、模拟闭环、现场验证入口和 SHA-256 清单。

- [x] **Step 1: 编写 `verify-all.ps1` 串联 C 测试、Node 测试、JS 语法、网页静态检查、固件源检查和三工程 Keil 构建。**
- [ ] **Step 2: 运行全量验证；任何失败先记录并修复，不生成虚假 release manifest。**
- [ ] **Step 3: 生成 SHA-256、构建日志摘要和浏览器操作说明。** README 明确区分“软件测试通过 / Keil 编译通过 / 尚未下板”。
- [x] **Step 4: 最终检查目录中无临时温控项目、无账号/COM 私密配置、无对硬件实测的虚构结论。**

## Execution status (2026-09-08)

- Tasks 1, 2, 4, 5, 6 and 7 are implemented and pass the software regression suite.
- Task 3 Steps 1-2 are complete. Step 3 remains partial: the three G1 role projects, fixed protocol, HELLO and safe scheduler skeleton exist; physical IR/RTC/ADC/EEPROM adapters are deliberately not claimed as integrated firmware until board profiling is performed.
- Task 3 Step 4 is blocked by the installed legal C51 V9.51 Eval linker limit. The CTRL map reports `data=94.7`, `xdata=539`, `code=9487`, XDATA `0x0000..0x06FF`, followed only by fatal `L250` because code exceeds the Eval `0x0800` limit. No HEX is produced.
- Task 8 Step 2 passes with `-SoftwareOnly`; the complete build remains blocked by the same license limit. Step 3 remains unchecked because the release manifest correctly refuses to sign a build without all three HEX files.
- No physical-board PASS is asserted. G1/G2/G4 checks in the on-board documents remain for the team to execute and sign.
