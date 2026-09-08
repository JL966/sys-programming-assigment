const item = (id, title, automation, requiredNodes, extra = {}) => Object.freeze({
  id, title, automation, requiredNodes: Object.freeze(requiredNodes),
  destructive: false, profile: 'DUT_CORE', timeoutMs: 3000,
  ruleVersion: '1.0.0', ...extra
});

export const TEST_CATALOG = Object.freeze({
  T01: item('T01', 'UART1 端到端', 'AUTO', ['CTRL']),
  T02: item('T02', 'RS485 双向链路', 'AUTO', ['CTRL','DUT','REF']),
  T03: item('T03', '红外双向链路', 'AUTO', ['CTRL','DUT','REF']),
  T04: item('T04', 'RTC 时间推进', 'AUTO', ['CTRL','DUT'], { timeoutMs: 12000 }),
  T05: item('T05', 'EEPROM 备份写入恢复', 'AUTO', ['CTRL','DUT'], { destructive: true, timeoutMs: 15000 }),
  T06: item('T06', 'EEPROM 受控掉电保留', 'ASSISTED_AUTO', ['CTRL','DUT'], { destructive: true, timeoutMs: 60000 }),
  T07: item('T07', '温度 ADC 响应', 'ASSISTED_AUTO', ['DUT'], { timeoutMs: 30000 }),
  T08: item('T08', '光照变化与恢复', 'ASSISTED_AUTO', ['DUT'], { timeoutMs: 30000 }),
  T09: item('T09', '超声波测距', 'ASSISTED_AUTO', ['DUT'], { profile: 'DUT_ULTRA', timeoutMs: 30000 }),
  T10: item('T10', '按键与事件输入', 'ASSISTED_AUTO', ['DUT'], { timeoutMs: 30000 }),
  T11: item('T11', 'LED 数码管蜂鸣器', 'MANUAL', ['DUT'], { timeoutMs: 30000 }),
  T12: item('T12', 'FM 与音乐', 'MANUAL', ['DUT'], { profile: 'DUT_AUDIO_STEP', timeoutMs: 30000 }),
  T13: item('T13', '直流与步进电机', 'MANUAL', ['DUT'], { profile: 'DUT_MOTOR', destructive: true, timeoutMs: 10000 }),
  T14: item('T14', '调度性能', 'AUTO', ['CTRL','DUT','REF'], { timeoutMs: 60000 }),
  T15: item('T15', '长时间稳定性', 'AUTO', ['CTRL','DUT','REF'], { timeoutMs: 60000 })
});

export const PLANS = Object.freeze({
  1: Object.freeze({ id: 1, title: '快速核心', tests: ['T01','T02','T03','T04','T05'] }),
  2: Object.freeze({ id: 2, title: '常规覆盖', tests: Object.keys(TEST_CATALOG).slice(0, 11) }),
  3: Object.freeze({ id: 3, title: '通信统计', tests: ['T01','T02','T03','T14'] }),
  4: Object.freeze({ id: 4, title: '传感器', tests: ['T07','T08','T09','T10'] }),
  5: Object.freeze({ id: 5, title: '输出人工', tests: ['T11','T12'] })
});
