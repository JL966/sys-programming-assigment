#ifndef DIAG_BSP_STUB
#define DIAG_BSP_STUB
#define code
#define enumIrTxOK 2
#define xdata
typedef struct{unsigned int EXT_P10,EXT_P11,Rt,Rop,Nav;}struct_ADC;
typedef struct{unsigned char second,minute,hour,day,month,week,year;}struct_DS1302_RTC;
typedef struct{unsigned int frequency;unsigned char volume,GP1,GP2,GP3;}struct_FMRadio;
enum{enumKey1,enumKey2,enumKey3};
enum{enumKeyNull,enumKeyPress,enumKeyRelease,enumKeyFail};
enum{enumAdcNavKey3,enumAdcNavKeyRight,enumAdcNavKeyDown,enumAdcNavKeyCenter,enumAdcNavKeyLeft,enumAdcNavKeyUp};
enum{enumHallNull,enumHallGetClose,enumHallGetAway};
enum{enumEventKey,enumEventNav,enumEventHall,enumEventVib,enumEventUart2Rxd,enumEventIrRxd};
#define ADCexpEXT 0x98
#define NEC_R05d 43
#define enumIrFree 0
#define enumUart2TxFree 0
#define Uart2Usedfor485 1
void DisplayerInit(void);void SetDisplayerArea(int,int);void KeyInit(void);void AdcInit(int);void BeepInit(void);void HallInit(void);void VibInit(void);
void SetEventCallBack(int,void(*)(void));void LedPrint(int);void Seg7Print(int,int,int,int,int,int,int,int);void SetBeep(int,int);
unsigned char GetKeyAct(int);unsigned char GetAdcNavAct(int);unsigned char GetHallAct(void);unsigned char GetVibAct(void);
void SetFMRadio(struct_FMRadio);void FMRadioInit(struct_FMRadio);struct_FMRadio GetFMRadio(void);
struct_ADC GetADC(void);struct_DS1302_RTC RTC_Read(void);void DS1302Init(struct_DS1302_RTC);
unsigned char M24C02_Read(int);void M24C02_Write(int,int);
void IrInit(int);void SetIrRxd(void*,int);int GetIrRxNum(void);int GetIrStatus(void);int IrPrint(void*,int);
void Uart2Init(int,int);void SetUart2Rxd(void*,int,void*,int);int GetUart2TxStatus(void);void Uart2Print(void*,int);
#endif
