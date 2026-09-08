# Compact 下板验证操作手册（烧录之后做什么）

本手册只讲“HEX 已经烧进板子之后，人在 PC 上要做的步骤”。它验证的是 **Compact 固件**：UART1 2400 bps + 24 字节固定帧 + CRC-16 + 角色 HELLO 应答。

> 一句话边界：这一步只证明“这块板烧对了角色、串口能通、协议帧和 CRC 正确”。它**不证明**红外、RS485、RTC、EEPROM、传感器、数码管、电机任何一项。

## 0. 先搞清楚你烧的是什么

| 角色 | 烧录文件 | MCU CODE | 文件大小 | SHA-256（与 `compact-release-manifest.json` 一致） |
| --- | --- | ---: | ---: | --- |
| CTRL | `firmware/compact/ctrl/output/AcceptanceCtrlCompact.hex` | 610 B | 1883 B | `6F97D75B4E0B9F7D66ABD236288BA3F92CCA487A22A367F03A9A03ED6124A020` |
| DUT | `firmware/compact/dut/output/AcceptanceDutCompact.hex` | 610 B | 1883 B | `A8DC6CE688E558B1C1BDA042275E25DC7DD83FF65FCE54529B8F38C9118A9B0E` |
| REF | `firmware/compact/ref/output/AcceptanceRefCompact.hex` | 610 B | 1883 B | `85C5098978C98B2B37BC6E21473F2423CE9473E8FF369A6682C26CBF83666E40` |

Compact 固件的真实行为（读源码得到，不是猜测）：

- 只初始化 UART1：`SCON=0x50`、Timer2 做波特率、`AUXR|=0x05` 选 Timer2+1T、重装值 `0xFB80` → **2400 bps, 8N1**。
- 主循环轮询收字节；收到 24 字节且 `version=1`、`type=HELLO(0x01)`、`dst=本角色`（或广播 `0xFF`）、`payload_len≤8`、`flags=0`、CRC 正确时，回一帧 HELLO 响应。
- **不初始化**数码管、LED、蜂鸣器、电机、EEPROM、红外、RS485、RTC、ADC。
- 所以：烧完上电后数码管可能乱码/不亮、板子安静不动，这是**正常**的，不是失败。
- 板子**不会主动发数据**，必须 PC 先发帧它才回帧；两帧连续发会丢第二帧，要等响应回来再发下一帧。

## 1. 烧录（每块板一次）

1. 给三块板贴板号：建议 `101=CTRL`、`102=DUT`、`103=REF`，并写下“板号 ↔ COM 口 ↔ 烧的文件”。
2. 打开 STC-ISP：`D:\digital_electronic_circuits\little-semester\stc-isp-v6.88F.exe`。
3. 单片机型号选 **STC15F2K60S2**，串口选该板的 CH340 COM 口。
4. “打开程序文件”选**对应角色**的 HEX（CTRL 板烧 CTRL 文件，千万别三块都烧同一个）。
5. 点“下载/编程”，等提示“操作成功”，板子自动复位运行。
6. 建议再按一下板子的复位键（或断电重新上电），让 ISP 监控程序彻底退出后再跑程序。
7. **关闭 STC-ISP 的下载窗口/串口助手**——它会一直占着 COM 口，导致下一步脚本打不开串口。
8. 记录该板 HEX 的 SHA-256（可用第 2 步脚本输出，或 `Get-FileHash`）。

## 2. 自动验证（每块板一次）

在仓库目录下执行：

```powershell
cd D:\digital_electronic_circuits\little-semester\sys-programming-assigment

# 2.1 先看有哪些串口（找 CH340 的 COM 号）
powershell -ExecutionPolicy Bypass -File scripts\verify-board.ps1 -ListPorts

# 2.2 验证某一块板（把 COM5 换成实际口，CTRL 换成该板角色）
powershell -ExecutionPolicy Bypass -File scripts\verify-board.ps1 -Port COM5 -Role CTRL -Operator 你的名字
```

脚本会自己完成这些事，你只需要看结果：

1. 打开串口 2400 8N1，清空收发缓冲。
2. 连发 **100 帧** 黄金 HELLO（seq 逐次加 1），每帧等响应回来再发下一帧，逐字节校验：帧头、版本、类型、源/目的地址、session/seq 回显、payload 长度、flags、`payload[0]=OK`、`payload[1]=角色`、`payload[7]=协议版本`、CRC-16/MODBUS。
3. 跑 8 个反例：CRC 被改、目的地址不是本角色、版本=2、`payload_len=9`、只发半帧、半帧补齐、垃圾字节后重新同步、反例之后仍能正常响应。前四个和“半帧”必须**没有**响应，后三个必须有**正确**响应。
4. 打印结论，并把 `records/时间-角色-COM口.md` 和 `.json` 两个记录文件写到仓库里。

整块板大约跑 30~60 秒（2400 bps 下一帧往返约 0.2 秒，100 帧加上反例）。

**PASS 长这样**（真实串口的往返耗时通常是 200~250 ms 量级，虚拟板才是个位数）：

```text
HELLO 挑战: 100/100 首次正确响应
反例 8/8 符合预期
结论: PASS —— CTRL 号角色在 COM5 上的 UART1 2400bps 协议 HELLO 全部正确。
记录已写入: ...\records\20260908-2110-CTRL-COM5.md
```

判定标准（三条都满足才算这块板通过）：

- `HELLO 挑战: 100/100`
- 反例全部 `OK`（没有 `FAIL`）
- 脚本退出码 0、`结论: PASS`，且 `records\*.md` 已生成

## 3. 三块板都要做，并且交叉核对

| 步骤 | 做什么 | 通过标准 |
| --- | --- | --- |
| B1 | 只插 101 板，`-Role CTRL` | 100/100 + 反例全 OK |
| B2 | 只插 102 板，`-Role DUT` | 100/100 + 反例全 OK |
| B3 | 只插 103 板，`-Role REF` | 100/100 + 反例全 OK |
| B4 | 三块板同时插上，用拔插法确认“板号 ↔ COM 口”没有记错，再各跑一次 | 与 B1~B3 结论一致 |

`-Challenges` 可以调小做快速预检（例如 `-Challenges 10`），但**交付记录必须用默认 100 次**。

## 4. 手工兜底（脚本打不开串口时）

用 STC-ISP 自带“串口助手”：

- 波特率 **2400**，数据位 8，停止位 1，无校验；接收和发送都选 **HEX**。
- 发送下面 24 字节（对应角色），期望收到同样 24 字节的响应。

| 角色 | 发送（HELLO, session=0, seq=1） | 期望收到 |
| --- | --- | --- |
| CTRL | `A5 5A 01 01 00 01 00 00 01 00 00 00 01 00 00 00 00 00 00 00 00 00 24 A2` | `A5 5A 01 01 01 00 00 00 01 00 00 00 08 01 00 01 E1 01 00 01 00 01 53 C0` |
| DUT | `A5 5A 01 01 00 02 00 00 01 00 00 00 01 00 00 00 00 00 00 00 00 00 D4 52` | `A5 5A 01 01 02 00 00 00 01 00 00 00 08 01 00 02 E1 01 00 01 00 01 90 84` |
| REF | `A5 5A 01 01 00 03 00 00 01 00 00 00 01 00 00 00 00 00 00 00 00 00 85 C2` | `A5 5A 01 01 03 00 00 00 01 00 00 00 08 01 00 03 E1 01 00 01 00 01 D1 B8` |

响应字段解释：`payload[0]=00`（命令成功）、`payload[1]=角色号`、`payload[2]=0xE1`（Compact 档案号）、`payload[3]=1` 固件主版本、`payload[4]=0` 次版本、`payload[5..6]=01 00` 能力位、`payload[7]=1` 协议版本。

> 注意：Compact 响应里 `type` 保持 `0x01`，而完整固件会按协议返回 `0x81`。PC 端解码器两者都接受；这属于 Compact 的已知简化。

## 5. 记录与交付

1. 每块板都会生成 `records\<时间>-<角色>-<COM口>.md` 与 `.json`，这两个文件就是下板证据，建议一起提交。
2. 同时把 `docs/test-record-template.md` 复制成 `records\YYYYMMDD-HHMM-<板号>-<测试>.md`，补上模板里脚本填不了的东西：板号照片、接线、供电、USB 线、环境。
3. 只有三块板都 PASS 之后，才可以把 `compact-release-manifest.json` 的 `hardwareValidated` 从 `false` 改成 `true`；改之前请先提交证据记录。
4. 失败记录也要保留，不要删掉重跑覆盖。

## 6. 失败排查表

| 现象 | 最可能的原因 | 处理 |
| --- | --- | --- |
| 脚本报“无法打开串口” | STC-ISP/串口助手还占着口；COM 号写错；CH340 驱动没装 | 关掉占用程序；`-ListPorts` 重新确认；设备管理器看 CH340 |
| `NO_RESPONSE`，一个字节都收不到 | 没烧成功、烧的是别的角色、板子没复位、串口选错 | 重新烧录并复位；确认 `-Role` 与烧录文件一致；换 COM 口试 |
| 收到字节但 CRC/字段校验失败 | 波特率不匹配（时钟不是 11.0592 MHz）或串口线/供电干扰 | 确认 2400 8N1；换 USB 数据线；换 USB 口 |
| `payload[1]` 角色与预期不符 | 三块板烧了同一个 HEX，或板号与 COM 口对应记错 | 重烧对应角色；拔插法重新核对 COM 口 |
| 前几帧正常，后面开始丢 | 连续发帧导致轮询收字节丢包（Compact 是轮询实现） | 用脚本（它会等响应）；手工测试时一次只发一帧 |
| 偶发失败、重跑又过 | 供电/线材不稳、USB 口供电不足 | 换线、换口，必要时带供电的 USB HUB；记录最差而不是只记平均 |

## 7. 这一步之后是什么

- 本手册通过 = “三块板能烧进去、角色正确、串口协议通”。这是完整验收的**第 0 层**。
- 完整自动验收需要 `firmware/*/output/*.hex`（完整 BSP 版），当前 C51 V9.51 是 Eval 版，完整固件 `code=9487` 超过 2 KiB 被 `FATAL ERROR L250` 拦住，**暂时烧不出来**。
- 拿到学校合法完整 C51 许可证后：
  ```powershell
  powershell -ExecutionPolicy Bypass -File firmware\build-all.ps1
  powershell -ExecutionPolicy Bypass -File scripts\verify-all.ps1
  ```
  然后按 `docs/on-board-validation.md` 做 G1（单板）、G2（双板到三板 485）、G3（核心测试项）。
- 网页的“真实串口诊断”目前只是占位（`web/js/app.js` 在非模拟模式直接返回提示，没有接 Web Serial），所以真实下板验证请用本手册的脚本或串口助手；GUI 接真实串口属于后续开发项。
