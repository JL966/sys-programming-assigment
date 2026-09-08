# 学习板验收协议 v1

所有 UART 固定帧均为 24 字节：`A5 5A | version | type | src | dst | session(le16) | seq(le16) | test_id | step | payload_len | flags | payload[8] | crc(le16)`。CRC 对偏移 2 到 21 的 20 字节使用 CRC-16/MODBUS 参数（初值 `FFFF`、多项式 `A001`、xorout 0）；整个业务协议不是 Modbus。

节点地址：PC=00、CTRL=01、DUT=02、REF=03、无应答广播=FF。响应类型等于请求类型或 `0x80`，响应 payload 首字节是命令状态。所有未使用 payload 和保留位必须为 0。

黄金向量：PC 发往 CTRL 的 `HELLO(page=0)`、session 0、seq 1：

```text
A5 5A 01 01 00 01 00 00 01 00 00 00 01 00 00 00 00 00 00 00 00 00 24 A2
```

`123456789` 的 CRC 数值为 `4B37`，上线路序为 `37 4B`。命令、状态码、测试目录、记录分片和时序以详细实施设计第 6 章为准；实现中的常量名称分别位于 `shared/protocol.h` 与 `web/js/protocol.js`。
