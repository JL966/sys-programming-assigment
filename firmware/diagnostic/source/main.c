#include "STC15F2K60S2.H"
#include "sys.H"
#include "diag.h"
code unsigned long SysClock=11059200;
code char decode_table[]={0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f,0,1,2,4,8,16,32,64,128,255};
void main(void) {
    DiagInit();
    MySTC_Init();
    DiagUart();
    while(1) MySTC_OS();
}
