/* Course RC522.C wiring and inverted SM outputs; no card write/auth/block commands.
   Reader command completion is polled across 10 ms ticks, never a busy wait. */
#ifdef DIAG_HOST_TEST
#include "diagnostic-bsp-stub.h"
#else
#include "STC15F2K60S2.H"
#include <intrins.h>
sbit RFID_NSS=P1^1;
sbit RFID_CLK=P4^1;
sbit RFID_SI=P4^2;
sbit RFID_SO=P1^0;
sbit RFID_EA=P4^3;
sbit RFID_IIC=P4^4;
static void edge(void){_nop_();_nop_();_nop_();_nop_();_nop_();_nop_();}
static void send_byte(unsigned char v){unsigned char i;for(i=0;i<8;i++){RFID_SI=!(v&0x80);edge();RFID_CLK=0;edge();v<<=1;RFID_CLK=1;edge();}}
static unsigned char rd(unsigned char reg){unsigned char i,v=0;RFID_NSS=0;RFID_CLK=1;edge();send_byte(((reg<<1)&0x7e)|0x80);for(i=0;i<8;i++){RFID_CLK=0;edge();v=(v<<1)|RFID_SO;RFID_CLK=1;edge();}RFID_NSS=1;RFID_CLK=0;return v;}
static void wr(unsigned char reg,unsigned char v){RFID_NSS=0;RFID_CLK=1;edge();send_byte((reg<<1)&0x7e);send_byte(v);RFID_NSS=1;RFID_CLK=0;}
#endif
#include "rfid_readonly.h"
static unsigned char xdata state,sub,ticks,version,stable,absent,error,uid[4],candidate[5],index,armed;
static unsigned int xdata trials;
static void launch(unsigned char anti){wr(1,0);wr(4,0x7f);wr(0x0a,0x80);wr(0x0d,anti?0:7);wr(9,anti?0x93:0x52);if(anti)wr(9,0x20);wr(1,0x0c);wr(0x0d,anti?0x80:0x87);ticks=0;}
void RfidBegin(void){
#ifndef DIAG_HOST_TEST
    P1M0&=0xfc;P1M1&=0xfc;P1|=3;P4M0|=0x1e;P4M1&=0xe1;RFID_IIC=1;RFID_EA=0;
#endif
    state=0;sub=0;ticks=0;version=0;stable=0;absent=0;error=0;trials=0;armed=0;wr(1,0x0f);
}
void RfidArm(unsigned char step){armed=step;absent=0;sub=2;ticks=0;if(step==1){stable=0;state=1;}}
void RfidSafe(void){wr(1,0);wr(0x14,0);
#ifndef DIAG_HOST_TEST
    P4&=0xe1;
#endif
}
unsigned char RfidState(void){return state;}
void RfidTick(void){
    unsigned char n,i,c;
    ticks++;
    if(sub==0){if(ticks<5)return;version=rd(0x37);if(version==0||version==255){error=1;return;}wr(0x11,0x3d);wr(0x2d,30);wr(0x2c,0);wr(0x2a,0x8d);wr(0x2b,0x3e);wr(0x15,0x40);wr(0x14,3);sub=1;ticks=0;return;}
    if(sub==1){if(rd(0x11)!=0x3d){error=1;return;}state=1;error=0;sub=2;ticks=0;return;}
    if(sub==2){if(ticks<20||state==3||!armed)return;launch(0);trials++;sub=3;return;}
    if(sub==3||sub==5){
        n=rd(4);if(!(n&0x31)&&ticks<10)return;
        wr(0x0d,0);
        if(rd(0x37)!=version||rd(0x11)!=0x3d){error=1;sub=2;ticks=0;return;}
        if((rd(6)&0x1b)||(n&0x30)==0){
            if(sub==3&&(n&1)&&state==2&&armed==2){if(++absent>=3)state=3;}
            else if(sub==3&&state!=2)stable=0;
            sub=2;ticks=0;return;
        }
        absent=0;
        if(sub==3){if(rd(0x0a)!=2||(rd(0x0c)&7)){error=2;sub=2;ticks=0;return;}rd(9);rd(9);launch(1);sub=5;return;}
        if(rd(0x0a)!=5||(rd(0x0c)&7)){error=2;sub=2;ticks=0;return;}
        index=0;sub=6;return;
    }
    if(sub==6){candidate[index++]=rd(9);if(index<5)return;c=0;for(i=0;i<4;i++)c^=candidate[i];
        if(c!=candidate[4]){error=2;stable=0;}
        else if(candidate[0]==0x88){error=3;stable=0;}
        else {n=1;for(i=0;i<4;i++)if(uid[i]!=candidate[i])n=0;if(!n){stable=0;for(i=0;i<4;i++)uid[i]=candidate[i];}if(stable<255)stable++;if(stable>=2)state=2;error=0;}
        sub=2;ticks=0;
    }
}
unsigned char RfidSnapshot(unsigned char page,unsigned char *p){unsigned char i;for(i=0;i<7;i++)p[i]=0;if(page==0){p[0]=state;p[1]=version;p[2]=stable;p[3]=absent;p[4]=error;p[5]=(unsigned char)trials;p[6]=(unsigned char)(trials>>8);}else if(page==1){for(i=0;i<4;i++)p[i]=uid[i];p[4]=stable?4:0;}else return 1;return 0;}
