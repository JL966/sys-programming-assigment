#include "protocol.h"

static unsigned short read_u16(const unsigned char *p)
{
    return (unsigned short)((unsigned short)p[0] | ((unsigned short)p[1] << 8));
}

static void write_u16(unsigned char *p, unsigned short value)
{
    p[0] = (unsigned char)(value & 0xFFu);
    p[1] = (unsigned char)(value >> 8);
}

unsigned short Proto_Crc16(const unsigned char *bytes, unsigned short length)
{
    unsigned short crc;
    unsigned short i;
    unsigned char bit_index;
    /* Keep this routine C89/C51 compatible: no library or table dependency. */
    crc = 0xFFFFu;
    for (i = 0; i < length; ++i) {
        crc ^= bytes[i];
        for (bit_index = 0; bit_index < 8u; ++bit_index) {
            if ((crc & 1u) != 0u) crc = (unsigned short)((crc >> 1) ^ 0xA001u);
            else crc >>= 1;
        }
    }
    return crc;
}

ProtoResult Proto_Encode(const ProtoFrame *frame, unsigned char out[PROTO_FRAME_SIZE])
{
    unsigned char i;
    unsigned short crc;
    if (frame == 0 || out == 0) return PROTO_ERR_ARGUMENT;
    if (frame->version != PROTO_VERSION) return PROTO_ERR_VERSION;
    if (frame->payload_len > PROTO_PAYLOAD_SIZE) return PROTO_ERR_LENGTH;
    if ((frame->flags & (unsigned char)~(PROTO_FLAG_RESPONSE | PROTO_FLAG_ERROR)) != 0u)
        return PROTO_ERR_FLAGS;
    out[0] = 0xA5u;
    out[1] = 0x5Au;
    out[2] = frame->version;
    out[3] = frame->msg_type;
    out[4] = frame->src;
    out[5] = frame->dst;
    write_u16(out + 6, frame->session);
    write_u16(out + 8, frame->seq);
    out[10] = frame->test_id;
    out[11] = frame->step;
    out[12] = frame->payload_len;
    out[13] = frame->flags;
    for (i = 0; i < PROTO_PAYLOAD_SIZE; ++i)
        out[14u + i] = i < frame->payload_len ? frame->payload[i] : 0u;
    crc = Proto_Crc16(out + 2, 20u);
    write_u16(out + 22, crc);
    return PROTO_OK;
}

ProtoResult Proto_Decode(const unsigned char wire[PROTO_FRAME_SIZE],
                         unsigned char destination,
                         unsigned short expected_session,
                         ProtoFrame *out)
{
    unsigned char i;
    if (wire == 0 || out == 0) return PROTO_ERR_ARGUMENT;
    if (wire[0] != 0xA5u || wire[1] != 0x5Au) return PROTO_ERR_SOF;
    if (read_u16(wire + 22) != Proto_Crc16(wire + 2, 20u)) return PROTO_ERR_CRC;
    if (wire[2] != PROTO_VERSION) return PROTO_ERR_VERSION;
    if (wire[12] > PROTO_PAYLOAD_SIZE) return PROTO_ERR_LENGTH;
    if ((wire[13] & (unsigned char)~(PROTO_FLAG_RESPONSE | PROTO_FLAG_ERROR)) != 0u)
        return PROTO_ERR_FLAGS;
    if (wire[5] != destination && wire[5] != PROTO_NODE_BROADCAST) return PROTO_ERR_ADDRESS;
    if (expected_session != 0u && read_u16(wire + 6) != expected_session)
        return PROTO_ERR_SESSION;
    out->version = wire[2];
    out->msg_type = wire[3];
    out->src = wire[4];
    out->dst = wire[5];
    out->session = read_u16(wire + 6);
    out->seq = read_u16(wire + 8);
    out->test_id = wire[10];
    out->step = wire[11];
    out->payload_len = wire[12];
    out->flags = wire[13];
    for (i = 0; i < PROTO_PAYLOAD_SIZE; ++i) out->payload[i] = wire[14u + i];
    return PROTO_OK;
}
