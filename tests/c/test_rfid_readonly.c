#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "diagnostic-bsp-stub.h"
#include "rfid_readonly.h"
static unsigned char regs[64],tx[16],rx[16],tn,rn,pos;
static int card,bad_version,corrupt,bad_select,idle_delay,irq_delay,uid_length=4,selects;
static unsigned int crc_ref(unsigned char *p,int n){unsigned int c=0x6363;int i,j;for(i=0;i<n;i++){c^=p[i];for(j=0;j<8;j++)c=(c>>1)^((c&1)?0x8408:0);}return c;}
unsigned char rd(unsigned char r){if(r==0x37)return bad_version?0:0x92;if(r==9){assert(pos<rn);return rx[pos++];}if(r==0x0a)return rn-pos;if(r==4&&irq_delay){irq_delay--;return 0x10;}return regs[r];}
void wr(unsigned char r,unsigned char v){
 unsigned int c;int i,level,offset,last;
 if(r==4){regs[r]&=~v;return;}
 if(r==0x0a&&(v&0x80)){tn=rn=pos=0;return;}
 if(r==9){assert(tn<16);tx[tn++]=v;return;}
 regs[r]=v;
 if(r==0x0d&&(v&0x80)){
  assert(tn==1||tn==2||tn==9||tn==4);assert(tx[0]==0x52||tx[0]==0x93||tx[0]==0x95||tx[0]==0x97||tx[0]==0x50);
  pos=0;regs[6]=0;regs[0x0c]=0;irq_delay=idle_delay;
  if(!card||tx[0]==0x50){regs[4]=1;rn=0;return;}
  regs[4]=0x30;
  if(tx[0]==0x52){rx[0]=4;rx[1]=0;rn=2;return;}
  level=tx[0]==0x93?0:tx[0]==0x95?1:2;offset=level*3;last=offset+4==uid_length;
  if(tx[1]==0x20){
   if(last){for(i=0;i<4;i++)rx[i]=offset+i+1;}
   else{rx[0]=0x88;for(i=1;i<4;i++)rx[i]=offset+i;}
   rx[4]=rx[0]^rx[1]^rx[2]^rx[3];if(corrupt)rx[4]^=1;rn=5;
  }else{
   assert(tx[1]==0x70&&tn==9);c=crc_ref(tx,7);assert(tx[7]==(c&255)&&tx[8]==(c>>8));
   selects++;rx[0]=last?8:4;c=crc_ref(rx,1);rx[1]=c&255;rx[2]=c>>8;if(bad_select)rx[2]^=1;rn=3;
  }
 }
}
static void tick(int n){while(n--)RfidTick();}
static void reset(void){memset(regs,0,sizeof(regs));card=bad_version=corrupt=bad_select=idle_delay=irq_delay=selects=0;RfidBegin();tick(20);assert(RfidState()==1);}
int main(void){unsigned char p[7];int n;
 for(n=4;n<=10;n+=3){uid_length=n;reset();card=1;tick(100);assert(RfidState()==1);
  idle_delay=2;RfidArm(1);tick(600);assert(RfidState()==2);assert(selects>=2);
  RfidSnapshot(1,p);assert(p[4]==n&&p[0]==1&&p[3]==4);
  if(n>4){RfidSnapshot(3,p);assert(p[0]==5&&p[n-5]==n);}
  RfidArm(2);bad_version=1;card=0;tick(200);assert(RfidState()!=3);
  bad_version=0;card=1;tick(200);RfidArm(2);card=0;tick(300);assert(RfidState()==3);
 }
 reset();card=1;corrupt=1;RfidArm(1);tick(300);assert(RfidState()!=2);
 reset();card=1;bad_select=1;RfidArm(1);tick(300);assert(RfidState()!=2);
 RfidSafe();assert(regs[0x14]==0);puts("PASS: RFID 4/7/10-byte UID, SELECT CRC, IdleIRQ, BCC failure, disconnect vs removal, no writes");return 0;
}
