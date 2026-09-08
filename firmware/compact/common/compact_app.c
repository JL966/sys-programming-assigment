#include "STC15F2K60S2.H"
#include "app_role.h"
#include "compact_app.h"
#include "compact_protocol.h"

#define COMPACT_FRAME_SIZE 24

static unsigned char xdata frame[COMPACT_FRAME_SIZE];
static unsigned char frame_pos;

static void uart_send_frame(void)
{
    unsigned char i;
    for (i = 0; i < COMPACT_FRAME_SIZE; i++) {
        TI = 0;
        SBUF = frame[i];
        while (!TI) ;
    }
    TI = 0;
}

static void accept_byte(unsigned char value)
{
    if (frame_pos == 0) {
        if (value != 0xA5) return;
    } else if (frame_pos == 1 && value != 0x5A) {
        frame_pos = (value == 0xA5) ? 1 : 0;
        return;
    }
    frame[frame_pos++] = value;
    if (frame_pos == COMPACT_FRAME_SIZE) {
        frame_pos = 0;
        if (CompactProtocol_Handle(frame, APP_ROLE)) uart_send_frame();
    }
}

void CompactApp_Init(void)
{
    frame_pos = 0;
    SCON = 0x50;
    AUXR |= 0x05;
    T2H = 0xFB;
    T2L = 0x80;
    AUXR |= 0x10;
    RI = 0;
    TI = 0;
}

void MySTC_OS(void)
{
    if (RI) {
        unsigned char value = SBUF;
        RI = 0;
        accept_byte(value);
    }
}
