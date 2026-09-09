#ifdef DIAG_HOST_TEST
#include "diagnostic-bsp-stub.h"
#else
#include "STC15F2K60S2.H"
#include "sys.H"
#include "displayer.h"
#include "Key.H"
#include "adc.h"
#include "Beep.h"
#include "hall.H"
#include "Vib.h"
#include "DS1302.h"
#include "M24C02.h"
#include "FM_Radio.h"
#include "uart2.h"
#include "IR.h"
#endif
#include "diag.h"
#include "extension.h"
unsigned char xdata current_test,phase,hw_error;
unsigned int xdata age;
unsigned char xdata evidence[7];
unsigned int xdata pair_token,pair_trial;
unsigned char xdata pair_direction;
static unsigned char xdata link_rx[8],link_tx[8];
static unsigned char xdata link_details[7];
static unsigned char xdata match_bits[2];
static unsigned char xdata link_head[2]={0xd3,0x71};
static unsigned char xdata started, last_step, key_target, pressed, released, wrong, hall_bits, vib_count;
static unsigned char xdata ee_state, ee_lock, safe_pending, fm_ready, role_id, send_pending;
unsigned char xdata display_stage;
static unsigned int xdata sample_id, adc_rt,adc_ro;
static struct_ADC xdata samples;
static struct_DS1302_RTC xdata rtc;
static struct_FMRadio xdata fm;
static void blank(void){LedPrint(0);Seg7Print(10,10,10,10,10,10,10,10);}
static void all_digits(unsigned char v){Seg7Print(v,v,v,v,v,v,v,v);}
static void number(unsigned int n){Seg7Print(10,10,10,10,n>=1000?n/1000%10:10,n>=100?n/100%10:10,n>=10?n/10%10:10,n%10);}
static void idle(void){Seg7Print(10,10,10,10,10,10,0,role_id);}
unsigned char HardwareRole(unsigned char r){if(r>2)return 1;if(started||ee_state)return 3;role_id=r;idle();return 0;}
unsigned char HardwareProgress(unsigned char v){if(started||ee_state||v>10)return 3;number(v);return 0;}
static int temperature(unsigned int a){
    static unsigned int code table[]={834,789,739,685,628,570,512,456,404,355,310,270,235,204,177,153,133,115,100};
    unsigned char i;
    if(a>834 || a<100)return -999;
    for(i=0;i<18;i++)if(a>=table[i+1])return -5+(int)i*5+(int)(table[i]-a)*5/(table[i]-table[i+1]);
    return 85;
}
void HardwareSafe(void){
    if(ee_state){safe_pending=1;return;}
    ExtensionSafe();
    started=0;phase=0;blank();idle();
    /* BSP tones are bounded to 200 ms; never queue another after cancellation. */
    if(fm_ready){fm.volume=0;SetFMRadio(fm);}
}
static void key_event(unsigned char k,unsigned char a){
    if(!started || (current_test!=5 && current_test!=6) || !a)return;
    if(k!=key_target){wrong=1;return;}
    if(a==enumKeyPress){pressed=1;number(current_test==6?k-2:k+1);}
    if(a==enumKeyRelease && pressed)released=1;
}
static void keys(void){key_event(0,GetKeyAct(enumKey1));key_event(1,GetKeyAct(enumKey2));}
static void nav(void){
    key_event(2,GetAdcNavAct(enumAdcNavKey3));
    key_event(3,GetAdcNavAct(enumAdcNavKeyUp));key_event(4,GetAdcNavAct(enumAdcNavKeyDown));
    key_event(5,GetAdcNavAct(enumAdcNavKeyLeft));key_event(6,GetAdcNavAct(enumAdcNavKeyRight));key_event(7,GetAdcNavAct(enumAdcNavKeyCenter));
}
static void hall(void){unsigned char a=GetHallAct();if(started && current_test==10){if(a==enumHallGetClose)hall_bits|=1;if(a==enumHallGetAway && (hall_bits&1))hall_bits|=2;number(hall_bits==3?2:hall_bits);}}
static void vib(void){if(GetVibAct() && started && current_test==11 && vib_count<255){vib_count++;number(vib_count);}}
static void link_received(void){
    unsigned int c;
    if(!started || (current_test!=15 && current_test!=16))return;
    c=Crc(link_rx,6);
    evidence[2]=8;evidence[3]++;
    if(link_rx[6]!=(unsigned char)c || link_rx[7]!=(unsigned char)(c>>8)){link_details[1]++;evidence[1]++;return;}
    evidence[4]++;
    if(link_rx[0]==0xd3 && link_rx[1]==0x71 && link_rx[2]==(unsigned char)pair_token && link_rx[3]==(unsigned char)(pair_token>>8) && link_rx[4]==(unsigned char)pair_trial && link_rx[5]==pair_direction){if(evidence[0])link_details[0]++;evidence[0]=1;match_bits[pair_direction]|=(1<<pair_trial);}
    else {evidence[1]++;link_details[2]++;}
}
static void ir_received(void){unsigned char n=GetIrRxNum();if(!started||current_test!=15)return;evidence[2]=n;if(n==8)link_received();else {evidence[1]++;link_details[3]++;}SetIrRxd(link_rx,8);}
void HardwareLinkDetails(unsigned char *p){unsigned char i;for(i=0;i<7;i++)p[i]=link_details[i];p[4]=(unsigned char)pair_trial;p[5]=pair_direction;p[6]=current_test==15?GetIrStatus():GetUart2TxStatus();}
void HardwareInit(void){
    unsigned char i;
    current_test=0;phase=0;hw_error=0;age=0;pair_token=0;pair_trial=0;pair_direction=0;
    started=0;pressed=0;released=0;wrong=0;hall_bits=0;vib_count=0;ee_state=0;ee_lock=0;safe_pending=0;fm_ready=0;sample_id=0;adc_rt=0;adc_ro=0;
    for(i=0;i<7;i++)evidence[i]=0;
    role_id=0;send_pending=0;display_stage=0;
    DisplayerInit();SetDisplayerArea(0,7);KeyInit();AdcInit(ADCexpEXT);BeepInit();HallInit();VibInit();IrInit(NEC_R05d);SetIrRxd(link_rx,8);
    SetEventCallBack(enumEventKey,keys);SetEventCallBack(enumEventNav,nav);SetEventCallBack(enumEventHall,hall);SetEventCallBack(enumEventVib,vib);
    SetEventCallBack(enumEventUart2Rxd,link_received);SetEventCallBack(enumEventIrRxd,ir_received);blank();idle();last_step=255;
}
unsigned char HardwarePrepare(unsigned char id){
    unsigned char i;
    if(id<1 || id>24)return 1;
    if(ee_state)return 3;
    HardwareSafe();current_test=id;phase=1;hw_error=0;age=0;last_step=255;safe_pending=0;
    for(i=0;i<7;i++)evidence[i]=0;
    if(id==13){if(ee_lock)return 4;evidence[0]=M24C02_Read(0x7f);evidence[1]=evidence[0]^0x5a;display_stage=1;number(1);}
    if(id==12){rtc=RTC_Read();DS1302Init(rtc);}
    if(id>=15){match_bits[0]=0;match_bits[1]=0;}
    if(id==15){SetIrRxd(link_rx,8);SetEventCallBack(enumEventIrRxd,ir_received);}
    if(id==16){Uart2Init(1200,Uart2Usedfor485);SetUart2Rxd(link_rx,8,link_head,2);}
    if(id>=17)ExtensionPrepare(id);
    return 0;
}
unsigned char HardwareStart(unsigned char step,unsigned char *p){
    unsigned char i;unsigned int c;
    if(ee_state)return 3;
    if(current_test>=17){started=1;return ExtensionStart(step,p);}
    if(step==last_step && current_test<15)return 0;
    if(current_test==13 && (ee_lock || last_step!=255))return 4;
    if(current_test==13 && p[0]!=evidence[0])return 5;
    if(current_test==5 && step>2)return 1;
    if(current_test==6 && step>4)return 1;
    if(current_test==15 || current_test==16){
        if(step==ARM){
            pair_token=(unsigned int)p[0]|((unsigned int)p[1]<<8);pair_trial=p[2];pair_direction=p[3];
            if(!pair_token || pair_trial>4 || pair_direction>1)return 1;
            for(i=0;i<7;i++)evidence[i]=0;
            for(i=0;i<7;i++)link_details[i]=0;
            send_pending=0;
            for(i=0;i<8;i++)link_rx[i]=0;
            if(current_test==15)SetIrRxd(link_rx,8);
        }else if(step==SEND){
            if(!started)return 2;
            if(current_test==15 && GetIrStatus()!=enumIrFree)return 3;
            if(current_test==16 && GetUart2TxStatus()!=enumUart2TxFree)return 3;
            link_tx[0]=0xd3;link_tx[1]=0x71;link_tx[2]=(unsigned char)pair_token;link_tx[3]=(unsigned char)(pair_token>>8);link_tx[4]=(unsigned char)pair_trial;link_tx[5]=pair_direction;
            c=Crc(link_tx,6);link_tx[6]=(unsigned char)c;link_tx[7]=(unsigned char)(c>>8);
            if(current_test==15){if(IrPrint(link_tx,8)!=enumIrTxOK)return 3;}
            else Uart2Print(link_tx,8);
            evidence[5]=1;send_pending=1;
        }else return 1;
    }
    started=1;phase=2;age=0;last_step=step;display_stage=255;
    pressed=0;released=0;wrong=0;hall_bits=0;vib_count=0;
    key_target=current_test==6?step+3:step;
    if(current_test==5||current_test==6||current_test==10||current_test==11)number(0);
    if(current_test==13){
        if(p[0]!=evidence[0])return 5;
        display_stage=2;number(2);M24C02_Write(0x7f,evidence[1]);ee_state=1;
    }
    if(current_test==14){fm.frequency=955;fm.volume=6;fm.GP1=0;fm.GP2=0;fm.GP3=0;if(!fm_ready){FMRadioInit(fm);fm_ready=1;}else SetFMRadio(fm);}
    return 0;
}
void HardwareTick(void){
    unsigned char v,i,n;int t;
    if(current_test>=17){ExtensionTick();return;}
    if(ee_state){
        age++;
        if(ee_state==1 && age>=30){display_stage=3;number(3);evidence[2]=M24C02_Read(0x7f);ee_state=3;age=0;}
        else if(ee_state==3 && age>=30){display_stage=4;number(4);M24C02_Write(0x7f,evidence[0]);ee_state=2;age=0;}
        else if(ee_state==2 && age>=30){display_stage=5;number(5);evidence[3]=M24C02_Read(0x7f);ee_state=0;started=0;phase=3;
            if(evidence[2]!=evidence[1] || evidence[3]!=evidence[0]){hw_error=evidence[3]!=evidence[0]?7:6;ee_lock=1;}
            if(safe_pending)HardwareSafe();}
        return;
    }
    if((uptime%10)==0){samples=GetADC();adc_rt=samples.Rt;adc_ro=samples.Rop;sample_id++;}
    if(!started)return;
    if(send_pending && ((current_test==15&&GetIrStatus()==enumIrFree)||(current_test==16&&GetUart2TxStatus()==enumUart2TxFree))){evidence[6]=1;send_pending=0;}
    if((uptime%10)==0){
        if(current_test==8){t=temperature(adc_rt);if(t==-999)Seg7Print(10,10,10,10,17,17,17,17);else if(t<0)Seg7Print(10,10,10,10,10,17,10,-t);else number(t);}
        if(current_test==9)number(adc_ro);
        if(current_test==12){rtc=RTC_Read();Seg7Print(rtc.hour>>4,rtc.hour&15,17,rtc.minute>>4,rtc.minute&15,17,rtc.second>>4,rtc.second&15);}
        if(current_test==15||current_test==16){n=0;for(i=0;i<5;i++)if(match_bits[pair_direction]&(1<<i))n++;Seg7Print(10,10,10,10,pair_direction+1,10,10,n);}
    }
    if(age<60000)age++;
    if(current_test==3){v=(unsigned char)(age/70);if(v!=display_stage){display_stage=v;if(v<8)LedPrint(1<<v);else if(v==8)LedPrint(255);else LedPrint(0);}if(v>=10){phase=3;started=0;}}
    if(current_test==4){v=(unsigned char)(age/150);if(v!=display_stage){display_stage=v;if(v==0)all_digits(19);else if(v==1)Seg7Print(1,2,3,4,5,6,7,8);else if(v<10)all_digits(v+9);else blank();}if(v>=10){phase=3;started=0;}}
    if(current_test==7){if(age==1)SetBeep(800,20);if(age==50)SetBeep(1200,20);if(age==100)SetBeep(1800,20);if(age>=130){started=0;phase=3;}}
    if(current_test==14 && age>=12000)HardwareSafe();
}
void HardwareSnapshot(unsigned char *p){
    unsigned char i;for(i=0;i<7;i++)p[i]=0;
    if(current_test==5 || current_test==6){p[0]=pressed;p[1]=released;p[2]=wrong;p[3]=key_target;}
    else if(current_test==8 || current_test==9){p[0]=(unsigned char)adc_rt;p[1]=(unsigned char)(adc_rt>>8);p[2]=(unsigned char)adc_ro;p[3]=(unsigned char)(adc_ro>>8);p[4]=(unsigned char)sample_id;p[5]=(unsigned char)(sample_id>>8);}
    else if(current_test==10)p[0]=hall_bits;
    else if(current_test==11)p[0]=vib_count;
    else if(current_test==12){rtc=RTC_Read();p[0]=rtc.second;p[1]=rtc.minute;p[2]=rtc.hour;p[3]=rtc.day;p[4]=rtc.month;p[5]=rtc.week;p[6]=rtc.year;}
    else if(current_test==14){fm=GetFMRadio();p[0]=(unsigned char)fm.frequency;p[1]=(unsigned char)(fm.frequency>>8);p[2]=fm.volume;}
    else {for(i=0;i<7;i++)p[i]=evidence[i];}
}
