# 学习板自动验收与故障定位平台

本目录是依据《学习板自动验收与故障定位平台 详细实施设计与团队交接》建立的实施工程。它把 CTRL、DUT、REF 三角色固件、固定二进制协议、PC 测试管理端、模拟故障闭环、证据存储、JSON/HTML 报告和现场验证表放在同一项目中。

## 当前真实状态

| 层次 | 状态 | 证据 |
| --- | --- | --- |
| C/JS 协议与状态机 | 通过 | GCC 测试、Node 测试、跨语言黄金帧 |
| PC 模拟验收闭环 | 通过 | 浏览器已验证快速计划、红外 FAIL、恢复后新 attempt PASS |
| 网页与报告 | 通过 | 语法/结构测试、IndexedDB 降级、JSON/HTML 转义 |
| 三个 Keil 工程配置 | 已生成并通过静态约束检查 | 器件、BSP、角色、输出、XRAM `0x06FF` |
| 三个 Compact HEX | **已生成** | 裸机安全通信基线；三个角色 CODE 均为 610 字节，0 Error、0 Warning |
| 三个完整功能 HEX | **未生成** | 当前 C51 V9.51 为 Eval；完整 BSP 平台约 9.5 KiB，触发 L250 |
| 实物下板 | **未执行** | 必须由组员烧录、接线和记录；项目没有伪造通过结论 |

G1 核心构建日志已证明 DATA/XDATA 布局错误已消除：CTRL 为 `data=94.7, xdata=539`，链接范围为 `0x0000..0x06FF`。P1 检查点和传感器规则保留在 `firmware/common` 并已通过 GCC 测试，尚未提前链接进 G1 固件；应在 G4 按实际硬件档案逐项接入并重新记录 map。当前 G1 剩余构建阻塞是合法 C51 许可证。

## 可直接烧录的 2 KiB Compact HEX

为了在合法 Keil Eval 下交付可烧录文件，项目保留完整 BSP 工程，同时增加了不链接 BSP 的寄存器级 Compact 配置。最终 MCU CODE 均远小于 2048 字节：

| 角色 | MCU CODE | HEX 文件大小 | HEX |
| --- | ---: | ---: | --- |
| CTRL | 610 B | 1883 B | `firmware/compact/ctrl/output/AcceptanceCtrlCompact.hex` |
| DUT | 610 B | 1883 B | `firmware/compact/dut/output/AcceptanceDutCompact.hex` |
| REF | 610 B | 1883 B | `firmware/compact/ref/output/AcceptanceRefCompact.hex` |

Compact 版支持 UART1 2400 bps、固定 24 字节帧、CRC-16/MODBUS 校验和角色 HELLO；不会执行 EEPROM、电机或其他破坏性动作。它不包含完整会话引擎、RS485 自动编排和 P1 适配器，因此不能用 Compact HEX 宣称完整验收通过。

重新构建和验证：

```powershell
powershell -ExecutionPolicy Bypass -File firmware\compact\build-all.ps1
powershell -ExecutionPolicy Bypass -File tests\compact\test-intel-hex.ps1
powershell -ExecutionPolicy Bypass -File tests\compact\test-compact-clean-build.ps1
powershell -ExecutionPolicy Bypass -File tests\compact\test-compact-manifest.ps1
```

三份文件的 MCU CODE 和磁盘大小都设有 2048 字节自动门禁；尺寸、SHA-256 和能力边界记录在 `compact-release-manifest.json`。STC-ISP 烧录时分别选择相应角色文件；默认 UART1 使用 P3.0/P3.1，波特率 2400，11.0592 MHz。

## 快速体验 PC 平台

```powershell
cd D:\系统编程\my_homework\project
node scripts\serve.mjs
```

Chrome/Edge 打开 `http://127.0.0.1:8000`。默认是黄色标识的“软件模拟演示”：

1. 勾选“遮挡红外链路”，运行“快速核心”。T03 应为 FAIL，诊断域为“红外链路”。
2. 取消遮挡，点击 T03 的“复测”。页面生成新的 PASS attempt，旧 FAIL 不会被覆盖。
3. 选择任一行查看原始证据，导出 JSON 或 HTML。报告始终标记为模拟数据。

切换到“真实串口诊断”时，页面不会用模拟结果填充 PASS。Compact HEX 可用于角色 HELLO 和基础串口联调；真实完整自动计划仍需要完整版 C51 生成三个完整 HEX，并按现场表完成 G1/G2 联调。

## 验证命令

软件层全量验证：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-all.ps1 -SoftwareOnly
```

合法完整 C51 许可证就绪后：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-all.ps1
powershell -ExecutionPolicy Bypass -File scripts\generate-release-manifest.ps1
```

`generate-release-manifest.ps1` 在任一 HEX 缺失或日志有失败时会拒绝生成，不会把不完整构建包装成发布版。

## 目录

```text
project/
  protocol/protocol.md          固定 24 字节协议与黄金向量
  shared/                       C89 协议、会话、记录和安全状态机
  firmware/common/              固件适配、检查点和 P1 判定纯逻辑
  firmware/ctrl|dut|ref/        三个独立 Keil 工程及同版本 BSP
  web/                          无构建依赖的 PC 管理页面
  tests/c, tests/js             GCC 与 Node 回归测试
  docs/                         硬件基线、下板步骤、实测记录模板
  scripts/                      本地服务器、验证和发布清单脚本
```

## 固件构建与烧录

三个工程均由已验证的 `作业5-0/file/01-Uart1` 模板生成，BSP 库 SHA-256 为：

```text
5A02A4DF4DA6FBF6F6CC024822974F0692D160B85C271201E70BE519B08D64B9
```

构建后预期文件：

- `firmware/ctrl/output/AcceptanceCtrl.hex`
- `firmware/dut/output/AcceptanceDut.hex`
- `firmware/ref/output/AcceptanceRef.hex`

STC-ISP 选择 STC15F2K60S2 和相应 CH340 COM 口。CTRL/DUT/REF 必须烧录匹配角色，先单板 HELLO，再双板 485，最后三板。完整流程见 [下板分层验证](docs/on-board-validation.md) 与 [硬件基线](docs/hardware-baseline.md)。

## 安全与结论边界

- EEPROM `0x10..0x1F` 未经现场确认时禁止写入；先备份、PC 落盘确认、写入、恢复、再读 CRC。
- 电机/掉电/写入许可每个新会话默认关闭；本版不启用电机。
- 声光输出是 MANUAL；温光/超声波是 ASSISTED_AUTO；没有新鲜度证据的超声波恒值是 INCONCLUSIVE。
- `ACK` 只表示命令被接受，不等于硬件 PASS。
- 编译通过也不等于下板通过；正式结论必须附 [实测记录模板](docs/test-record-template.md) 所列证据。
