#include "sys.H"
#include "displayer.h"
#include "Key.H"
#include "uart1.h"
#include "uart2.h"
#include "app_role.h"
#include "protocol.h"
#include "test_engine.h"
#include "firmware_app.h"

typedef struct TxSlotTag {
    unsigned char bytes[PROTO_FRAME_SIZE];
    unsigned char valid;
    unsigned char submitted;
} TxSlot;

static unsigned char xdata uart1_rx[PROTO_FRAME_SIZE];
static unsigned char xdata uart2_rx[PROTO_FRAME_SIZE];
static unsigned char xdata uart1_pending[PROTO_FRAME_SIZE];
static unsigned char xdata uart2_pending[PROTO_FRAME_SIZE];
static unsigned char uart1_has_pending;
static unsigned char uart2_has_pending;
static unsigned char frame_head[2] = {0xA5u, 0x5Au};
static TxSlot xdata uart1_active;
static TxSlot xdata uart1_waiting;
static TxSlot xdata uart2_active;
static TxSlot xdata uart2_waiting;
static TestEngine xdata engine;
static ProtoFrame xdata request_frame;
static ProtoFrame xdata response_frame;
static unsigned char xdata encoded_frame[PROTO_FRAME_SIZE];
static unsigned short rx_overflow;
static struct_SysPerF performance;

static void copy24(unsigned char *dst, const unsigned char *src)
{
    unsigned char i;
    for (i = 0u; i < PROTO_FRAME_SIZE; ++i) dst[i] = src[i];
}

static void queue_frame(TxSlot *active, TxSlot *waiting, const unsigned char *wire)
{
    if (!active->valid) {
        copy24(active->bytes, wire);
        active->valid = 1u;
        active->submitted = 0u;
    } else if (!waiting->valid) {
        copy24(waiting->bytes, wire);
        waiting->valid = 1u;
        waiting->submitted = 0u;
    } else {
        rx_overflow++;
    }
}

static void promote_slot(TxSlot *active, TxSlot *waiting)
{
    if (waiting->valid) {
        copy24(active->bytes, waiting->bytes);
        active->valid = 1u;
        active->submitted = 0u;
        waiting->valid = 0u;
    } else {
        active->valid = 0u;
        active->submitted = 0u;
    }
}

static void flush_uart1(void)
{
    if (!uart1_active.valid || GetUart1TxStatus() != enumUart1TxFree) return;
    if (uart1_active.submitted) promote_slot(&uart1_active, &uart1_waiting);
    if (uart1_active.valid && !uart1_active.submitted &&
        Uart1Print(uart1_active.bytes, PROTO_FRAME_SIZE) == enumUart1TxOK)
        uart1_active.submitted = 1u;
}

static void flush_uart2(void)
{
    if (!uart2_active.valid || GetUart2TxStatus() != enumUart2TxFree) return;
    if (uart2_active.submitted) promote_slot(&uart2_active, &uart2_waiting);
    if (uart2_active.valid && !uart2_active.submitted &&
        Uart2Print(uart2_active.bytes, PROTO_FRAME_SIZE) == enumUart2TxOK)
        uart2_active.submitted = 1u;
}

static void on_uart1(void)
{
    if (uart1_has_pending) rx_overflow++;
    else {
        copy24(uart1_pending, uart1_rx);
        uart1_has_pending = 1u;
    }
}

static void on_uart2(void)
{
    if (uart2_has_pending) rx_overflow++;
    else {
        copy24(uart2_pending, uart2_rx);
        uart2_has_pending = 1u;
    }
}

static void enrich_hello(ProtoFrame *response)
{
    response->payload_len = 8u;
    response->payload[0] = CMD_OK;
    response->payload[1] = APP_ROLE;
    response->payload[2] = APP_PROFILE;
    response->payload[3] = APP_FW_MAJOR;
    response->payload[4] = APP_FW_MINOR;
    response->payload[5] = APP_CAP_LOW;
    response->payload[6] = APP_CAP_HIGH;
    response->payload[7] = PROTO_VERSION;
}

static void process_one(unsigned char *wire, TxSlot *active, TxSlot *waiting)
{
    if (Proto_Decode(wire, APP_ROLE, 0u, &request_frame) != PROTO_OK) return;
    Engine_HandleFrame(&engine, &request_frame, &response_frame);
    if (request_frame.msg_type == PROTO_MSG_HELLO && response_frame.payload[0] == CMD_OK)
        enrich_hello(&response_frame);
    if (Proto_Encode(&response_frame, encoded_frame) == PROTO_OK)
        queue_frame(active, waiting, encoded_frame);
}

static void on_10ms(void)
{
    if (uart1_has_pending) {
        uart1_has_pending = 0u;
        process_one(uart1_pending, &uart1_active, &uart1_waiting);
    }
    if (uart2_has_pending) {
        uart2_has_pending = 0u;
        process_one(uart2_pending, &uart2_active, &uart2_waiting);
    }
    Engine_Tick10ms(&engine);
    flush_uart1();
    flush_uart2();
}

static void on_key(void)
{
    unsigned char k1 = GetKeyAct(enumKey1);
    unsigned char k2 = GetKeyAct(enumKey2);
    if (k1 == enumKeyPress) LedPrint((unsigned char)(1u << (APP_ROLE - 1u)));
    if (k2 == enumKeyPress) LedPrint(0u);
}

static void on_1s(void)
{
    performance = GetSysPerformance();
    Seg7Print(APP_ROLE, engine.phase, engine.current_test,
              (unsigned char)(engine.current_attempt / 100u),
              (unsigned char)((engine.current_attempt / 10u) % 10u),
              (unsigned char)(engine.current_attempt % 10u),
              (unsigned char)(performance.PollingMisses ? 12u : 10u),
              (unsigned char)(rx_overflow ? 12u : 10u));
}

void App_Init(void)
{
    uart1_has_pending = 0u;
    uart2_has_pending = 0u;
    uart1_active.valid = uart1_waiting.valid = 0u;
    uart2_active.valid = uart2_waiting.valid = 0u;
    rx_overflow = 0u;
    Engine_Init(&engine, APP_ROLE);
    DisplayerInit();
    SetDisplayerArea(0, 7);
    Seg7Print(APP_ROLE, 0, 10, 10, 10, 10, 10, 10);
    LedPrint(0u);
    KeyInit();
    SetEventCallBack(enumEventUart1Rxd, on_uart1);
    SetEventCallBack(enumEventUart2Rxd, on_uart2);
    SetEventCallBack(enumEventSys10mS, on_10ms);
    SetEventCallBack(enumEventSys1S, on_1s);
    SetEventCallBack(enumEventKey, on_key);
}

/* UART init must run AFTER MySTC_Init(): the BSP system init re-programs the
   interrupt enables, so a UART RX interrupt armed before it gets cleared and
   the node never sees a frame even though the display keeps refreshing. */
void App_StartUart(void)
{
    Uart1Init(2400ul);
    Uart2Init(1200ul, Uart2Usedfor485);
    SetUart1Rxd(uart1_rx, PROTO_FRAME_SIZE, frame_head, 2u);
    SetUart2Rxd(uart2_rx, PROTO_FRAME_SIZE, frame_head, 2u);
}
