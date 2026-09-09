#include <assert.h>
#include <stdio.h>
#include "diagnostic-bsp-stub.h"
#include "diag.h"
unsigned long uptime;unsigned int lease;static int writes=0,mem=33,bad_restore=0;
static void(*callbacks[6])(void);static unsigned char keys[3],navs[6],hall_action,vib_action,*ir_buffer;static int digits[8],ir_count,ir_ok=2;static unsigned char ir_packet[8];
unsigned int Crc(unsigned char*p,unsigned char n){unsigned int c=65535;int i,j;for(i=0;i<n;i++){c^=p[i];for(j=0;j<8;j++)c=c&1?(c>>1)^0xa001:c>>1;}return c;}
void DisplayerInit(void){}void SetDisplayerArea(int a,int b){}void KeyInit(void){}void AdcInit(int a){}void BeepInit(void){}void HallInit(void){}void VibInit(void){}
void SetEventCallBack(int e,void(*f)(void)){callbacks[e]=f;}void LedPrint(int v){}void Seg7Print(int a,int b,int c,int d,int e,int f,int g,int h){digits[0]=a;digits[1]=b;digits[2]=c;digits[3]=d;digits[4]=e;digits[5]=f;digits[6]=g;digits[7]=h;}void SetBeep(int f,int t){}
unsigned char GetKeyAct(int i){int v=keys[i];keys[i]=0;return v;}unsigned char GetAdcNavAct(int i){int v=navs[i];navs[i]=0;return v;}unsigned char GetHallAct(void){int a=hall_action;hall_action=0;return a;}unsigned char GetVibAct(void){int a=vib_action;vib_action=0;return a;}
void SetFMRadio(struct_FMRadio f){}void FMRadioInit(struct_FMRadio f){}struct_FMRadio GetFMRadio(void){struct_FMRadio f={955,6,0,0,0};return f;}
struct_ADC GetADC(void){struct_ADC a={0,0,500,400,0};return a;}struct_DS1302_RTC RTC_Read(void){struct_DS1302_RTC t={0,0,0,1,1,1,0x26};return t;}void DS1302Init(struct_DS1302_RTC t){}
unsigned char M24C02_Read(int a){return mem;}void M24C02_Write(int a,int v){writes++;mem=bad_restore&&v==33?44:v;}
void IrInit(int a){}void SetIrRxd(void*a,int n){ir_buffer=a;}int GetIrRxNum(void){return ir_count;}int GetIrStatus(void){return 0;}int IrPrint(void*p,int n){int i;for(i=0;i<8;i++)ir_packet[i]=((unsigned char*)p)[i];return ir_ok;}
void Uart2Init(int a,int b){}void SetUart2Rxd(void*a,int n,void*b,int l){}int GetUart2TxStatus(void){return 0;}void Uart2Print(void*p,int n){}
int main(void){unsigned char p[8]={33},out[7];int i;HardwareInit();assert(HardwarePrepare(17));assert(!HardwarePrepare(13));assert(evidence[0]==33);assert(!HardwareStart(0,p));assert(writes==1);HardwareSafe();for(i=0;i<90;i++)HardwareTick();assert(mem==33);assert(writes==2);HardwareStart(0,p);assert(writes==2);
 assert(!HardwarePrepare(5));assert(!HardwareStart(2,p));navs[enumAdcNavKey3]=enumKeyPress;callbacks[enumEventNav]();navs[enumAdcNavKey3]=enumKeyRelease;callbacks[enumEventNav]();HardwareSnapshot(out);assert(out[0]&&out[1]&&!out[2]);
 HardwareSafe();assert(!HardwareRole(2));assert(digits[6]==0&&digits[7]==2);
 assert(!HardwarePrepare(9));HardwareStart(0,p);uptime=10;HardwareTick();assert(digits[5]==4&&digits[6]==0&&digits[7]==0);
 HardwareSafe();assert(digits[7]==2);
 assert(!HardwarePrepare(12));HardwareStart(0,p);uptime=20;HardwareTick();assert(digits[0]==0&&digits[1]==0&&digits[2]==17&&digits[3]==0&&digits[4]==0&&digits[5]==17&&digits[6]==0&&digits[7]==0);
 assert(!HardwarePrepare(10));HardwareStart(0,p);assert(digits[7]==0);hall_action=enumHallGetClose;callbacks[enumEventHall]();assert(digits[7]==1);hall_action=enumHallGetAway;callbacks[enumEventHall]();assert(digits[7]==2);
 assert(!HardwarePrepare(11));HardwareStart(0,p);vib_action=1;callbacks[enumEventVib]();assert(digits[7]==1);
 assert(!HardwarePrepare(15));p[0]=42;p[1]=0;p[2]=0;p[3]=0;HardwareStart(ARM,p);assert(!HardwareStart(SEND,p));
 for(i=0;i<8;i++)ir_buffer[i]=ir_packet[i];ir_count=8;callbacks[enumEventIrRxd]();HardwareSnapshot(out);assert(out[0]==1&&out[2]==8&&out[4]==1);
 callbacks[enumEventIrRxd]();HardwareLinkDetails(out);assert(out[0]==1);
 HardwareStart(ARM,p);HardwareSnapshot(out);assert(!out[0]);ir_count=3;callbacks[enumEventIrRxd]();HardwareLinkDetails(out);assert(out[3]==1);
 ir_ok=3;assert(HardwareStart(SEND,p)==3);
 p[0]=33;assert(!HardwarePrepare(13));bad_restore=1;HardwareStart(0,p);for(i=0;i<90;i++)HardwareTick();assert(hw_error==7);assert(HardwarePrepare(13)==4);puts("PASS: EEPROM restore/cancel/idempotency/lockout and ADC K3 events");return 0;}
