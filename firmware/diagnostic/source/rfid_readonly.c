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
static void edge(void){unsigned int i;for(i=0;i<10;i++){_nop_();_nop_();_nop_();}}
static void send_byte(unsigned char v){unsigned char i;for(i=0;i<8;i++){RFID_SI=!(v&0x80);edge();RFID_CLK=0;edge();v<<=1;RFID_CLK=1;edge();}}
static unsigned char rd(unsigned char reg){unsigned char i,v=0;RFID_NSS=0;RFID_CLK=1;edge();send_byte(((reg<<1)&0x7e)|0x80);for(i=0;i<8;i++){RFID_CLK=0;edge();v=(v<<1)|RFID_SO;RFID_CLK=1;edge();}RFID_NSS=1;edge();RFID_CLK=0;edge();return v;}
static void wr(unsigned char reg,unsigned char v){RFID_NSS=0;RFID_CLK=1;edge();send_byte((reg<<1)&0x7e);send_byte(v);RFID_NSS=1;edge();RFID_CLK=0;edge();}
#endif
#include "rfid_readonly.h"
static unsigned char xdata state,sub,ticks,version,stable,absent,error,armed;
static unsigned char xdata uid[10],candidate[10],block[5],reply[3],packet[9];
static unsigned char xdata uidlen,used,level,atqa[2],sak,lastirq,lasterror,lastfifo;
static unsigned int xdata trials;
static unsigned int crc_a(unsigned char *p,unsigned char n){
    unsigned int c=0x6363;unsigned char b,i;
    for(i=0;i<n;i++){b=p[i]^(unsigned char)c;b^=(unsigned char)(b<<4);c=((c>>8)^((unsigned int)b<<8)^((unsigned int)b<<3)^(b>>4))&0xffff;}
    return c;
}
static void finish_exchange(void){wr(0x0d,rd(0x0d)&0x7f);wr(0x0c,rd(0x0c)|0x80);wr(1,0);}
static void launch(unsigned char mode){
    unsigned char i,n,sel=level==0?0x93:level==1?0x95:0x97;unsigned int c;
    if(mode==0){packet[0]=0x52;n=1;}
    else if(mode==1){packet[0]=sel;packet[1]=0x20;n=2;}
    else if(mode==2){packet[0]=sel;packet[1]=0x70;for(i=0;i<5;i++)packet[i+2]=block[i];c=crc_a(packet,7);packet[7]=(unsigned char)c;packet[8]=(unsigned char)(c>>8);n=9;}
    else{packet[0]=0x50;packet[1]=0;c=crc_a(packet,2);packet[2]=(unsigned char)c;packet[3]=(unsigned char)(c>>8);n=4;}
    wr(2,0xf7);wr(1,0);wr(4,0x7f);wr(8,rd(8)&0xf7);
    wr(0x0e,rd(0x0e)&0x7f);wr(0x0a,0x80);wr(0x0d,mode==0?7:0);
    for(i=0;i<n;i++)wr(9,packet[i]);
    wr(1,0x0c);wr(0x0d,mode==0?0x87:0x80);ticks=0;
}
void RfidBegin(void){
#ifndef DIAG_HOST_TEST
    P1M0&=0xfc;P1M1&=0xfc;P1|=3;
    P4M0|=0x1e;P4M1&=0xe1;RFID_IIC=1;RFID_EA=0;RFID_NSS=1;RFID_CLK=0;
#endif
    state=0;sub=0;ticks=0;version=0;stable=0;absent=0;error=0;trials=0;armed=0;
    uidlen=0;used=0;level=0;atqa[0]=atqa[1]=sak=lastirq=lasterror=lastfifo=0;wr(1,0x0f);
}
void RfidArm(unsigned char step){finish_exchange();armed=step;absent=0;sub=2;ticks=0;if(step==1){stable=0;state=1;}}
void RfidSafe(void){finish_exchange();wr(0x14,rd(0x14)&0xfc);
#ifndef DIAG_HOST_TEST
    P4&=0xe1;
#endif
}
unsigned char RfidState(void){return state;}
void RfidTick(void){
    unsigned char i,n,c,same;unsigned int check;
    if(ticks<255)ticks++;
    if(sub==0){
        if(ticks<5)return;version=rd(0x37);if(version==0||version==255){error=1;return;}
        wr(0x11,0x3d);wr(0x2d,30);wr(0x2c,0);wr(0x2a,0x8d);wr(0x2b,0x3e);wr(0x15,0x40);
        wr(0x14,rd(0x14)&0xfc);sub=1;ticks=0;return;
    }
    if(sub==1){if(ticks<1)return;wr(0x14,rd(0x14)|3);sub=7;ticks=0;return;}
    if(sub==7){if(ticks<10)return;if(rd(0x11)!=0x3d){error=1;return;}state=1;error=0;sub=2;ticks=0;return;}
    if(sub==2){if(ticks<20||state==3||!armed)return;level=0;used=0;launch(0);trials++;sub=3;return;}
    if(sub==10){if(ticks<4)return;finish_exchange();sub=2;ticks=0;return;}
    if(sub!=3&&sub!=5&&sub!=9)return;
    lastirq=rd(4);
    /* IdleIRQ alone is not a received card frame: wait for RxIRQ or timer. */
    if(!(lastirq&0x21)&&ticks<10)return;
    lasterror=rd(6);lastfifo=rd(0x0a);
    if(rd(0x37)!=version||rd(0x11)!=0x3d){error=1;finish_exchange();sub=2;ticks=0;return;}
    if((lasterror&0x1b)||!(lastirq&0x20)){
        if(sub==3&&(lastirq&1)&&!(lasterror&0x1b)){
            error=0;if(state==2&&armed==2){if(++absent>=3)state=3;}else stable=0;
        }else{error=(lasterror&0x1b)?2:6;stable=0;absent=0;}
        finish_exchange();sub=2;ticks=0;return;
    }
    absent=0;n=rd(0x0c)&7;
    if(sub==3){
        if(lastfifo!=2||n){error=2;finish_exchange();sub=2;ticks=0;return;}
        atqa[0]=rd(9);atqa[1]=rd(9);finish_exchange();launch(1);sub=5;return;
    }
    if(sub==5){
        if(lastfifo!=5||n){error=2;finish_exchange();sub=2;ticks=0;return;}
        c=0;for(i=0;i<5;i++){block[i]=rd(9);c^=block[i];}finish_exchange();
        if(c){error=2;stable=0;sub=2;ticks=0;return;}
        wr(0x0e,rd(0x0e)|0x80);launch(2);sub=9;return;
    }
    if(lastfifo!=3||n){error=4;finish_exchange();sub=2;ticks=0;return;}
    for(i=0;i<3;i++)reply[i]=rd(9);finish_exchange();
    check=crc_a(reply,1);
    if(reply[1]!=(unsigned char)check||reply[2]!=(unsigned char)(check>>8)){error=4;stable=0;sub=2;ticks=0;return;}
    sak=reply[0];
    if(sak&4){
        if(block[0]!=0x88||level>=2){error=3;sub=2;ticks=0;return;}
        for(i=1;i<4;i++)candidate[used++]=block[i];level++;launch(1);sub=5;return;
    }
    if(used>6){error=3;sub=2;ticks=0;return;}
    for(i=0;i<4;i++)candidate[used++]=block[i];
    same=uidlen==used;
    for(i=0;i<used;i++)if(uid[i]!=candidate[i])same=0;
    if(!same){stable=0;uidlen=used;for(i=0;i<used;i++)uid[i]=candidate[i];}
    if(stable<255)stable++;if(stable>=2)state=2;error=0;
    launch(3);sub=10;
}
unsigned char RfidSnapshot(unsigned char page,unsigned char *p){
    unsigned char i;for(i=0;i<7;i++)p[i]=0;
    if(page==0){p[0]=state;p[1]=version;p[2]=stable;p[3]=absent;p[4]=error;p[5]=(unsigned char)trials;p[6]=(unsigned char)(trials>>8);}
    else if(page==1){for(i=0;i<4;i++)p[i]=uid[i];p[4]=uidlen;}
    else if(page==2){p[0]=sub;p[1]=lastirq;p[2]=lasterror;p[3]=lastfifo;p[4]=atqa[0];p[5]=atqa[1];p[6]=sak;}
    else if(page==3){for(i=4;i<uidlen;i++)p[i-4]=uid[i];}
    else return 1;return 0;
}
