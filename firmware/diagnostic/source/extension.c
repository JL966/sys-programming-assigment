#ifdef DIAG_HOST_TEST
#include "diagnostic-bsp-stub.h"
#else
#include "STC15F2K60S2.H"
#include "adc.h"
#include "EXT.h"
#include "StepMotor.h"
#include "displayer.h"
#endif
#include "diag.h"
#include "extension.h"
#include "rfid_readonly.h"
/* Exported by the supplied BSP LIB; 0..3 are active modes, 255 is dormant. */
extern unsigned char xdata EXTmodel;
static unsigned char xdata active,running,last,stage,direction,valid,ready;
static unsigned int xdata ticks,serial,value1,value2,total;
static int xdata weight_base;
void ExtensionInit(void){active=0;running=0;last=255;EXTmodel=255;}
static void four(unsigned int v){if(v>9999)v=9999;Seg7Print(10,10,10,10,v/1000,v/100%10,v/10%10,v%10);}
static void motor_display(unsigned char d,unsigned int v){if(v>9999)v=9999;Seg7Print(d,17,17,17,v/1000,v/100%10,v/10%10,v%10);}
void ExtensionSafe(void){
    if(!active)return;
    if(active==17)EmStop(enumStepMotor1);
    if(active==23)RfidSafe();
    if(active>=18){
        if(active==19)SetPWM(0,100,0,100);
        EXTmodel=255;CCAPM1=0;AdcInit(ADCexpEXT);
        P1M0&=0xfc;P1M1|=3;P1|=3;
    }
    active=0;running=0;
}
void ExtensionPrepare(unsigned char id){
    active=id;running=0;last=255;stage=0;ticks=0;serial=0;value1=0;value2=0;total=0;direction=0;valid=0;ready=0;
    if(id>=18){
        EXTmodel=255;CCAPM1=0;AdcInit(ADCexpEXT);
        P1M0&=0xfc;P1M1&=0xfc;P1|=3;
        if(id==21){P1M1|=3;}
        if(id==18||id==20){P1&=0xfd;P1M0|=2;P1M1|=1;}
        if(id==19){P1&=0xfc;P1M0|=3;}
        if(id==22){P1|=3;}
    }
    if(id==17)StepMotorInit();
    if(id==21)AdcInit(ADCincEXT);
    if(id==18)EXTInit(enumEXTUltraSonic);
    if(id==19){EXTInit(enumEXTPWM);SetPWM(0,100,0,100);}
    if(id==20)EXTInit(enumEXTWeight);
    if(id==22){EXTInit(enumEXTDecode);GetDecode();}
}
unsigned char ExtensionStart(unsigned char step,unsigned char *p){
    if(active<17||active>23)return 2;
    if(step==last)return 0;
    if((active==17||active==19||active==18||active==21||active==22)&&step!=0)return 1;
    if(active==23&&step>2)return 1;
    if(active==23&&step==1&&(last!=0||RfidState()!=1))return 2;
    if(active==23&&step==2&&(last!=1||RfidState()!=2))return 2;
    if((active==20)&&step>1)return 1;
    last=step;ticks=0;running=1;phase=2;stage=0;valid=0;ready=0;
    if(active==20 && step==1)weight_base=(int)((unsigned int)p[0]|((unsigned int)p[1]<<8));
    if(active==23){if(step==0)RfidBegin();else RfidArm(step);}
    return 0;
}
void ExtensionTick(void){
    unsigned char s,d,speed;int v;long change;struct_ADC a;
    if(!active||!running)return;
    ticks++;age=ticks;
    if(active==17||active==19){
        s=ticks<=400?0:ticks<=800?1:ticks<=1100?2:ticks<=1500?3:ticks<=1900?4:5;
        if(ticks==1||s!=stage){
            stage=s;d=(s==2||s==5)?0:s<2?1:2;
            speed=d?(active==17?((s==0||s==3)?60:120):((s==0||s==3)?30:70)):0;
            if(active==17){EmStop(enumStepMotor1);if(d&&SetStepMotor(enumStepMotor1,speed,d==1?1000:-1000)!=enumSetStepMotorOK)hw_error=20;}
            else SetPWM(d==1?speed:0,100,d==2?speed:0,100);
            value1=speed;value2=active==17?GetStepMotorStatus(enumStepMotor1):0;direction=d;display_stage=s;motor_display(d,speed);
        }
        if(ticks>=2200){if(active==17){EmStop(enumStepMotor1);value2=GetStepMotorStatus(enumStepMotor1);if(value2!=enumStepMotorFree)hw_error=21;}else SetPWM(0,100,0,100);running=0;phase=3;}
        return;
    }
    if(active==23){RfidTick();four(RfidState());display_stage=RfidState();return;}
    if(ticks%20)return;
    serial++;valid=1;
    if(active==21){a=GetADC();value1=a.EXT_P11;value2=0;four(value1);}
    if(active==18){v=GetUltraSonic();value1=(unsigned int)v;valid=v>=5&&v<=400;if(valid)four(value1);else Seg7Print(10,10,10,10,17,17,17,17);}
    if(active==20){v=GetWeight();value1=(unsigned int)v;valid=v!=-32768&&v!=32767;
        if(last==0){weight_base=v;four(0);}else{change=(long)v-weight_base;if(change<0)change=-change;four(change>9999?9999:(unsigned int)change);}
    }
    if(active==22){v=GetDecode();if(v){direction=v>0?1:2;change=v;if(change<0)change=-change;if(change>9999-total)total=9999;else total+=(unsigned int)change;value1=total;value2|=v>0?1:2;}else direction=0;motor_display(direction,total);}
}
unsigned char ExtensionSnapshot(unsigned char page,unsigned char *p){
    unsigned char i;for(i=0;i<7;i++)p[i]=0;
    if(active==23)return RfidSnapshot(page,p);
    if(page)return 1;
    p[0]=(unsigned char)value1;p[1]=(unsigned char)(value1>>8);p[2]=(unsigned char)value2;p[3]=(unsigned char)(value2>>8);p[4]=(unsigned char)serial;p[5]=(unsigned char)(serial>>8);p[6]=(active==17||active==19)?direction:valid;
    return 0;
}
