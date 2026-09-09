const result = (level, domain, suggestion, limitation) => Object.freeze({ level, domain, suggestion, limitation });

export function diagnoseAttempt(attempt) {
  const { testId, verdict, reason, automation, evidence = {} } = attempt;
  if (automation === 'MANUAL' || reason === 'USER_REJECTED') {
    return result('D0', '人工观察', '复核测试图案、声音和操作者记录。', '人工结论不计入自动通过率。');
  }
  if (reason === 'PROFILE_UNSUPPORTED') {
    return result('D0', '硬件档案', '切换到包含该模块的 DUT 档案并重新核对 HELLO 能力页。', '当前固件没有声明该测试所需的硬件能力。');
  }
  if (verdict === 'BLOCKED' || reason === 'NODE_UNREACHABLE') {
    return result('D0', '节点在线前提', '检查供电、USB/485 接线、角色 HELLO 与协议版本。', '前提未成立，不能判定被测器件失败。');
  }
  if (testId === 'T03' && reason === 'RESPONSE_TIMEOUT' &&
      evidence.ctrlOnline && evidence.dutOnline && evidence.refOnline) {
    return result('D1', '红外链路', '恢复固定距离和方向，移除遮挡后用新 attempt 复测。', '不能仅凭超时定位到具体红外器件。');
  }
  if (testId === 'T02' && reason === 'RESPONSE_TIMEOUT') {
    return result('D1', 'RS485 路径', '检查 A/B、共参考地、短线和两端独立 USB 状态。', '不能区分收发器、线材、焊点或方向控制。');
  }
  if (verdict === 'PASS') {
    return result('D0', '未发现异常', '保留当前原始证据与规则版本。', '通过仅适用于本次测试条件。');
  }
  if (reason === 'DATA_MISMATCH') {
    return result('D1', evidence.channel || '数据路径', '核对两端原始帧、序号、会话和 CRC。', '需要换线或换角色复测才能提高定位等级。');
  }
  return result('D0', '证据不足', '查看原始记录并按前提逐段复测。', '当前证据不能支持元件级结论。');
}
