#include "compact_protocol.h"

static unsigned short crc16(unsigned char *p)
{
    unsigned char i;
    unsigned char j;
    unsigned short crc = 0xFFFF;
    for (i = 0; i < 20; i++) {
        crc ^= p[i];
        for (j = 0; j < 8; j++) {
            if (crc & 1) crc = (crc >> 1) ^ 0xA001;
            else crc >>= 1;
        }
    }
    return crc;
}

unsigned char CompactProtocol_Handle(unsigned char *frame, unsigned char role)
{
    unsigned char requester;
    unsigned short expected;
    unsigned short crc;
    if (frame[0] != 0xA5 || frame[1] != 0x5A) return 0;
    if (frame[2] != 1 || frame[3] != 1) return 0;
    if (frame[5] != role && frame[5] != 0xFF) return 0;
    if (frame[12] > 8 || frame[13] != 0) return 0;
    expected = (unsigned short)frame[22] | ((unsigned short)frame[23] << 8);
    if (crc16(frame + 2) != expected) return 0;

    requester = frame[4];
    frame[4] = role;
    frame[5] = requester;
    frame[12] = 8;
    frame[13] = 1;
    frame[14] = 0;
    frame[15] = role;
    frame[16] = 0xE1;
    frame[17] = 1;
    frame[18] = 0;
    frame[19] = 1;
    frame[20] = 0;
    frame[21] = 1;
    crc = crc16(frame + 2);
    frame[22] = (unsigned char)crc;
    frame[23] = (unsigned char)(crc >> 8);
    return 1;
}
