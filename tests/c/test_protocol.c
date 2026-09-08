#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../../shared/protocol.h"

static const unsigned char hello_golden[PROTO_FRAME_SIZE] = {
    0xA5,0x5A,0x01,0x01,0x00,0x01,0x00,0x00,
    0x01,0x00,0x00,0x00,0x01,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0x24,0xA2
};

static void test_crc_known_vector(void)
{
    const unsigned char text[] = "123456789";
    assert(Proto_Crc16(text, 9) == 0x4B37u);
}

static void test_hello_matches_hand_checked_golden_frame(void)
{
    ProtoFrame frame;
    unsigned char wire[PROTO_FRAME_SIZE];
    memset(&frame, 0, sizeof(frame));
    frame.version = PROTO_VERSION;
    frame.msg_type = PROTO_MSG_HELLO;
    frame.src = PROTO_NODE_PC;
    frame.dst = PROTO_NODE_CTRL;
    frame.seq = 1;
    frame.payload_len = 1;
    assert(Proto_Encode(&frame, wire) == PROTO_OK);
    assert(memcmp(wire, hello_golden, PROTO_FRAME_SIZE) == 0);
}

static void test_decode_rejects_crc_version_length_and_destination(void)
{
    ProtoFrame frame;
    unsigned char wire[PROTO_FRAME_SIZE];
    memcpy(wire, hello_golden, sizeof(wire));
    wire[22] ^= 1;
    assert(Proto_Decode(wire, PROTO_NODE_CTRL, 0, &frame) == PROTO_ERR_CRC);

    memcpy(wire, hello_golden, sizeof(wire));
    wire[2] = 2;
    wire[22] = 0x60;
    wire[23] = 0x91;
    assert(Proto_Decode(wire, PROTO_NODE_CTRL, 0, &frame) == PROTO_ERR_VERSION);

    memcpy(wire, hello_golden, sizeof(wire));
    wire[12] = 9;
    wire[22] = 0xA5;
    wire[23] = 0x48;
    assert(Proto_Decode(wire, PROTO_NODE_CTRL, 0, &frame) == PROTO_ERR_LENGTH);

    assert(Proto_Decode(hello_golden, PROTO_NODE_DUT, 0, &frame) == PROTO_ERR_ADDRESS);
}

int main(void)
{
    test_crc_known_vector();
    test_hello_matches_hand_checked_golden_frame();
    test_decode_rejects_crc_version_length_and_destination();
    puts("C protocol tests passed");
    return 0;
}
