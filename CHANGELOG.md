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
- 已知边界：完整 BSP 固件仍受 C51 Eval L250 限制；Compact 仅用于安全角色 HELLO/串口基线，尚无实物下板结论。
