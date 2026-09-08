# Keil C51 Eval 2 KiB 精简 HEX 设计

日期：2026-09-08

## 目标

在不删除现有完整平台源码和工程的前提下，为 CTRL、DUT、REF 三个角色增加独立的精简固件构建配置，使当前合法 Keil C51 V9.51 Eval 能生成三个可烧录 HEX。

构建成功的硬性判据是链接器报告 `0 Error(s)`、不存在 `L250`、目标 HEX 存在，并且 map 中的 `Program Size` 的 `code` 不超过 `2048` 字节。HEX 是 Intel HEX 文本，磁盘文件大小不等于 MCU CODE 大小，因此不以文件系统中的 `.hex` 字节数作为 2 KiB 判据。

## 交付边界

精简版保留：

- STC15F2K60S2 和 11.0592 MHz；Compact 版使用寄存器级 UART，不链接会使基线 CODE 超过 2 KiB 的 BSP；
- CTRL、DUT、REF 三个固定角色；
- 上电不触发破坏性外设，主循环保持 `while (1) MySTC_OS();`，其中 `MySTC_OS` 是 Compact 自有轮询调度；
- UART1 2400 bps；
- 固定 24 字节 HELLO 响应所需的最小协议字段和 CRC-16/MODBUS；
- 能由三套独立 Keil 工程生成三个带角色名称的 HEX。

为满足 2 KiB 限制，精简版不链接完整会话引擎、记录存储、诊断计划、P1 适配器、报告逻辑和 RS485 自动编排。这些能力继续保留在原完整工程中，待合法完整版许可证构建。精简 HEX 的文件名和文档必须带 `Compact`，不得作为完整硬件验收通过证据。

## 工程结构

新增 `firmware/compact/common` 存放寄存器级最小协议和固件入口；新增 `firmware/compact/ctrl|dut|ref` 三个独立 Keil 工程。Compact 工程只使用经核对的 STC15 寄存器头文件，不链接 BSP；现有 `firmware/ctrl|dut|ref` 继续保留 BSP 和完整功能定位。

生成物：

- `firmware/compact/ctrl/output/AcceptanceCtrlCompact.hex`
- `firmware/compact/dut/output/AcceptanceDutCompact.hex`
- `firmware/compact/ref/output/AcceptanceRefCompact.hex`

## 数据流

节点上电后不驱动显示、蜂鸣器、电机或 EEPROM，只初始化 UART1。UART 接收端仅维护一个固定 24 字节缓冲；发现合法 SOF、版本、长度和 CRC 后，只处理 HELLO 请求，并返回包含固定角色与精简能力标志的 HELLO 响应。未知命令不执行硬件动作。

## 安全与错误处理

- 不执行 EEPROM 写入、电机、掉电或其他破坏性动作。
- CRC 错误、错误版本、错误目标和未知命令静默丢弃，不形成动作副作用。
- 不为未实现项目返回 PASS。
- 编译脚本解析 map 中真实 CODE 数值；超过 2048 字节即失败并删除/拒绝发布对应 HEX。
- 三个角色必须全部成功才允许生成 compact 发布清单。

## 验证

先增加失败检查，证明当前没有三个 Compact HEX。随后实现最小固件并运行：

1. 精简源码静态约束检查；
2. 三个 Keil Eval 工程构建；
3. map 解析，确认每个 `code <= 2048`；
4. HEX 语法、EOF 记录和 SHA-256 检查；
5. 原有 `verify-all.ps1 -SoftwareOnly` 回归，确保完整平台的软件层没有退化；
6. 生成单独的 `compact-release-manifest.json`，明确 `profile=EVAL_COMPACT` 和未下板状态。

烧录后的真实串口和三板通信仍必须按现场验证表执行；仅有 HEX 和软件构建通过不代表实板通过。
