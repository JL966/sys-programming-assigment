#include "STC15F2K60S2.H"
#include "compact_app.h"

#define SYS_CLOCK 11059200UL

void main(void)
{
    CompactApp_Init();
    while (1) MySTC_OS();
}
