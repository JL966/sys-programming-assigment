# 实测记录模板

> 复制本模板为 `records/YYYYMMDD-HHMM-<board>-<test>.md`。模拟演示不得填写为下板记录。

| 字段 | 记录 |
| --- | --- |
| run UUID / run_tag / session |  |
| 日期与操作者 |  |
| CTRL / DUT / REF 板号 |  |
| 三固件文件及 SHA-256 |  |
| BSP 库 SHA-256 |  |
| 接线、距离、角度、供电 |  |
| 测试 ID / attempt / parent attempt |  |
| automation / rule_version |  |
| 配置 CRC 与阈值 |  |
| 前提与授权 |  |
| 实际刺激 |  |
| 原始证据文件 |  |
| 期待结果 |  |
| 实际 verdict / reason |  |
| D0/D1/D2 诊断及限制 |  |
| cleanup / 恢复验证 |  |
| MainLoops / PollingMisses |  |
| 照片或视频 |  |
| 复测关联 |  |

现场结论：

- [ ] 本记录来自真实下板。
- [ ] 原始证据可打开且校验一致。
- [ ] 自动、辅助自动或人工分类准确。
- [ ] 失败历史未因复测通过而删除。
- [ ] 没有未处理的 `RESTORE_REQUIRED`。
