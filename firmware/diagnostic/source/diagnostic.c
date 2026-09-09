#include "STC15F2K60S2.H"
#include "sys.H"
#include "uart1.h"
#include "diag.h"
static unsigned char xdata rx[24], pending[24], tx[24], cache[24], previous[24];
static unsigned char xdata head[2]={0xa5,0x5a};
static unsigned char xdata ready, tx_state, cached;
static unsigned int xdata attempt;
unsigned long xdata uptime;
unsigned int xdata lease;
unsigned int Crc(unsigned char *p,unsigned char n) {
    unsigned int c=0xffff; unsigned char i,b;
    for(i=0;i<n;i++){c^=p[i];for(b=0;b<8;b++)c=(c&1)?(c>>1)^0xa001:c>>1;}
    return c;
}
static void received(void) {
    unsigned char i;
    if(ready || tx_state) return;
    for(i=0;i<24;i++)pending[i]=rx[i];
    ready=1;
}
static void command(void) {
    unsigned char i,same=1,err=0; unsigned int c,a;
    c=Crc(pending+2,20);
    if(pending[0]!=0xa5 || pending[1]!=0x5a || pending[2]!=2 || pending[4]!=0 || pending[5]!=1 || pending[12]!=8 || pending[13]!=0 || pending[22]!=(unsigned char)c || pending[23]!=(unsigned char)(c>>8))return;
    lease=0;
    for(i=0;i<24;i++)if(previous[i]!=pending[i])same=0;
    if(cached && same){for(i=0;i<24;i++)tx[i]=cache[i];tx_state=1;return;}
    for(i=0;i<24;i++)tx[i]=pending[i];
    tx[3]|=0x80;tx[4]=1;tx[5]=0;tx[13]=1;
    for(i=14;i<22;i++)tx[i]=0;
    a=(unsigned int)pending[6]|((unsigned int)pending[7]<<8);
    if(pending[3]==HELLO){
        tx[15]=2;tx[16]=1;tx[17]=1;
        tx[18]=(unsigned char)uptime;tx[19]=(unsigned char)(uptime>>8);tx[20]=(unsigned char)(uptime>>16);tx[21]=(unsigned char)(uptime>>24);
    }else if(pending[3]==2){tx[15]=255;tx[16]=255;tx[17]=1;
    }else if(pending[3]==ROLE){err=HardwareRole(pending[14]);
    }else if(pending[3]==PROGRESS){err=HardwareProgress(pending[14]);
    }else if(pending[3]==PREPARE){
        if(a==0)err=1;
        else if(a!=attempt || pending[10]!=current_test){err=HardwarePrepare(pending[10]);if(!err)attempt=a;}
    }else if(pending[3]==STOP){HardwareSafe();}
    else if(a!=attempt || pending[10]!=current_test)err=2;
    else if(pending[3]==START)err=HardwareStart(pending[11],pending+14);
    else if(pending[3]==STATUS){tx[15]=phase;tx[16]=hw_error;tx[17]=(unsigned char)age;tx[18]=(unsigned char)(age>>8);tx[19]=display_stage;}
    else if(pending[3]==SNAPSHOT){if(pending[11]==1 && current_test>=15)HardwareLinkDetails(tx+15);else HardwareSnapshot(tx+15);}
    else if(pending[3]==BACKUP){for(i=0;i<7;i++)tx[15+i]=evidence[i];}
    else if(pending[3]==ARM || pending[3]==SEND){
        if(current_test!=15 && current_test!=16)err=1;
        else err=HardwareStart(pending[3],pending+14);
    }else err=1;
    tx[14]=err;c=Crc(tx+2,20);tx[22]=(unsigned char)c;tx[23]=(unsigned char)(c>>8);
    for(i=0;i<24;i++){previous[i]=pending[i];cache[i]=tx[i];}cached=1;tx_state=1;
}
static void tick(void){
    uptime++;
    if(lease<60000)lease++;
    HardwareTick();
    if(lease==500)HardwareSafe();
    if(tx_state && GetUart1TxStatus()==enumUart1TxFree){
        if(tx_state==2)tx_state=0;
        else if(Uart1Print(tx,24)==enumUart1TxOK)tx_state=2;
    }
    if(ready && !tx_state){ready=0;command();}
}
void DiagInit(void){ready=0;tx_state=0;cached=0;attempt=0;uptime=0;lease=0;HardwareInit();SetEventCallBack(enumEventSys10mS,tick);SetEventCallBack(enumEventUart1Rxd,received);}
void DiagUart(void){Uart1Init(2400);SetUart1Rxd(rx,24,head,2);}
