# Changelog

## 2026-09-08

- 建立协议 v1：24 字节固定帧、CRC16、C/JS 黄金向量和流拆帧。
- 建立固件会话、配置提交、幂等动作、租约、取消清理和记录缓存纯逻辑。
- 从同版本 BSP 模板生成 CTRL/DUT/REF 三个 Keil 工程，修正 C51 关键字冲突、DATA 工作区和 XRAM 上限。
- 建立 PC 测试目录、三节点模拟器、D0/D1 诊断、失败/复测历史和并发运行保护。
- 建立 IndexedDB/内存证据存储、分片冲突检测、JSON/HTML 导出与内容转义。
- 建立响应式操作页面并用真实浏览器验证红外故障—恢复闭环。
- 建立双槽检查点和 RTC/温光/超声波判定纯逻辑、硬件基线与下板验证模板。
- 新增独立裸机 Compact 配置，在合法 C51 Eval 下生成 CTRL/DUT/REF 三个 HEX；三个角色 CODE 均为 610 字节，构建 0 Error、0 Warning。
- Compact 的 HELLO/CRC 处理提取为可由 GCC 主机测试的纯 C 模块，并与 C51 固件链接同一份源代码。
- 新增 Intel HEX 逐记录校验和检查、2 KiB map 门禁及带 SHA-256 的 `compact-release-manifest.json`。
- 新增 PC 端下板验证工具 `scripts/verify-board.ps1`：真实串口发 100 帧黄金 HELLO 并逐字节校验响应，附 8 个坏帧反例，自动落盘 `records/` 证据；`-SelfTest` 与虚拟板测试 `tests/board/test-board-tool.ps1` 已接入 `verify-all.ps1 -SoftwareOnly`。
- 新增 `docs/compact-on-board-check.md`：烧录后的人工操作步骤、期望输出、手工兜底帧和失败排查表。
- 取得合法 C51 许可证后，CTRL/DUT/REF 三个完整功能 HEX 全部构建成功（CODE 约 9450 字节，0 Error）并写入仓库。
- 修复下板才暴露的两个缺陷：(1) 串口初始化必须放在 `MySTC_Init()` 之后，否则 BSP 系统初始化会清掉串口接收中断，表现为“数码管正常刷新但串口收不到帧”；(2) Keil C51 把指向 `xdata 0x0000` 的泛型指针当作空指针，`Proto_Decode`/`Proto_Encode` 的入参判空因此误报参数错误，现改为只在非 C51 目标保留该判空（桌面 GCC 测试不变）。
- `firmware/build-role.ps1` 与 `firmware/compact/build-role.ps1` 改为自动查找本机 `UV4.exe`，不再依赖协作者机器的硬编码路径。
- 三块学习板实物下板验证通过：CTRL/DUT/REF 各 100/100 次 HELLO 挑战首次正确响应，8 项坏帧反例全部符合预期，证据保存在 `records/`。
- 已知边界：完整固件的红外、RS485、RTC、EEPROM、传感器等 G1/G2/G3 项仍需现场接线与记录，尚未执行。

## 2026-09-09

- 接通 Web Serial 三角色身份核验、真实协议编排、记录回读和来源隔离。
- 增加虚拟三板字节级集成环境及记录 CRC/生命周期测试。
- 补齐固件配置 CRC、状态、结果记录、租约、人工确认、链路挑战和 EEPROM 授权门禁。
- DUT/REF 新源码成功生成完整 HEX；CTRL 新源码受本机 BL51 L250 阻塞，保留旧 HEX 且不生成混合发布清单。
- 增加真实运行的硬件档案能力门禁、人工项目有限安全租约、持久化后释放记录和自动合格摘要判定；页面切换来源与并发复测受保护。
- 网页结构门禁覆盖全部真实串口模块和安全控件；C/JS 软件回归现为 44 项 Node 测试并通过浏览器无错误冒烟验证。
