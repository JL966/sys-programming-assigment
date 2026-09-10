export const learningBoardImage = 'assets/learning-board/board-assembled.webp';
export const componentOverviewImage = 'assets/learning-board/component-overview.webp';

// Endpoint refinements requested on 2026-09-11; unrelated positions stay unchanged.
export const boardArrows = [
  {type:'line',x1:500,y1:45,x2:573,y2:128},
  {type:'line',x1:535,y1:210,x2:558,y2:237},
  {type:'line',x1:125,y1:47,x2:170,y2:76},
  {type:'polyline',points:'270,80 250,62 231,92',x2:231,y2:92},
  {type:'polyline',points:'330,82 322,60 303,92',x2:303,y2:92},
  {type:'line',x1:105,y1:250,x2:180,y2:255},
  {type:'line',x1:406,y1:235,x2:435,y2:277},
  {type:'line',x1:285,y1:382,x2:326,y2:426},
  {type:'line',x1:848,y1:225,x2:850,y2:223},
  {type:'line',x1:847,y1:330,x2:852,y2:303},
  {type:'line',x1:950,y1:164,x2:940,y2:250},
  {type:'line',x1:950,y1:407,x2:940,y2:420},
  {type:'line',x1:949,y1:551,x2:940,y2:550},
  {type:'line',x1:757,y1:490,x2:741,y2:536},
  {type:'line',x1:505,y1:519,x2:469,y2:522},
  {type:'line',x1:790,y1:693,x2:738,y2:662},
  {type:'line',x1:98,y1:610,x2:84,y2:612},
  {type:'polyline',points:'318,690 306,648 312,603',x2:312,y2:603},
  {type:'line',x1:548,y1:696,x2:524,y2:650}
];

export const approvedArrowCoordinateSignature = '500,45,573,128|535,210,558,237|125,47,170,76|270,80 250,62 231,92|330,82 322,60 303,92|105,250,180,255|406,235,435,277|285,382,326,426|848,225,850,223|847,330,852,303|950,164,940,250|950,407,940,420|949,551,940,550|757,490,741,536|505,519,469,522|790,693,738,662|98,610,84,612|318,690 306,648 312,603|548,696,524,650';

export const boardCallouts = [
  {position:'c04',name:'8位数码管',description:'板顶端的八位数字与字符显示区域。',association:['04　8位数码管']},
  {position:'c03',name:'8路LED',description:'L0至L7八个独立指示灯。',association:['03　8路LED']},
  {position:'c10',name:'霍尔传感器',description:'感应靠近或离开的磁铁。',association:['10　霍尔传感器']},
  {position:'c15',name:'红外收发',description:'左侧黑色IR_R为接收头，右侧透明IR_T为发射管。',association:['15　红外收发']},
  {position:'c14',name:'FM收音／耳机',description:'收音芯片配合左侧PHONE耳机接口输出声音。',association:['14　FM收音机／耳机']},
  {position:'c11',name:'振动传感器',description:'板上标有SW的振动感应元件。',association:['11　振动传感器']},
  {position:'c07',name:'无源蜂鸣器',description:'板上圆形B7发声器件。',association:['07　蜂鸣器']},
  {position:'c08',anchor:'right',name:'热敏电阻',description:'板上Rt，用于感知温度变化。',association:['08　温度采集']},
  {position:'c09',anchor:'right',name:'光敏电阻',description:'板上Rop，用于感知明暗变化。',association:['09　光照采集']},
  {position:'cext',anchor:'right',name:'EXT接口',description:'连接模拟量、测距、电机驱动和传感类外设。',association:['18　超声波测距','19　直流电机','20　电子秤','21　电子尺','22　电子转角测量器','23　RFID读卡器']},
  {position:'csm',anchor:'right',name:'SM接口',description:'五针步进电机接口，也参与RFID组合连接。',association:['17　SM步进电机','23　RFID读卡器']},
  {position:'c485',anchor:'right',name:'485接口',description:'两板RS485差分通信接口。',association:['16　扩展模块——RS485收发']},
  {position:'c06',anchor:'right',name:'五向导航键',description:'支持上、下、左、右与中心按压。',association:['06　五向导航键']},
  {position:'c01',name:'复位键',description:'按下后让学习板和诊断固件重新启动。',association:['01　系统启动／复位']},
  {position:'c05',anchor:'right',name:'K1／K2／K3',description:'板底部三个独立功能按键。',association:['05　K1／K2／K3']},
  {position:'c02',name:'USB／UART1',description:'用于供电、烧录和PC串口通信。',association:['02　USB／UART1']},
  {position:'c12',name:'RTC时钟／电池座',description:'U5时钟芯片负责走时，CY2晶振提供时基；纽扣电池在USB断电后继续为时钟供电。',association:['12　RTC时钟']},
  {position:'c13',name:'EEPROM（U6）',description:'CY2晶振右侧的U6八脚存储芯片，断电后仍可保存数据。',association:['13　EEPROM存储']}
];

export const extensionColumns = [
  [
    {name:'SM步进电机',image:'assets/learning-board/stepper-motor.webp',description:'按固定步数与方向转动的电机。',port:'SM接口',association:'17　扩展模块——SM步进电机'},
    {name:'直流电机',image:'assets/learning-board/dc-motor.webp',description:'可观察正反转、停止和速度变化。',port:'EXT接口',association:'19　扩展模块——直流电机'},
    {name:'电子尺',image:'assets/learning-board/electronic-ruler.webp',description:'伸缩时输出随位置变化的模拟量。',port:'EXT接口',association:'21　扩展模块——电子尺'},
    {name:'RFID读卡器',image:'assets/learning-board/rfid-reader.webp',description:'贴近卡片后读取UID，本项目不写卡。',port:'EXT＋SM接口',association:'23　扩展模块——RFID读卡器'}
  ],
  [
    {name:'超声波测距',image:'assets/learning-board/ultrasonic-module.webp',description:'通过发射与接收声波测量距离。',port:'EXT接口',association:'18　扩展模块——超声波测距'},
    {name:'电子秤',image:'assets/learning-board/electronic-scale.webp',description:'检测秤盘受力前后的数值变化。',port:'EXT接口',association:'20　扩展模块——电子秤'},
    {name:'电子转角测量器',image:'assets/learning-board/rotary-angle-sensor.webp',description:'转动时输出方向与脉冲变化。',port:'EXT接口',association:'22　扩展模块——电子转角测量器'}
  ]
];
