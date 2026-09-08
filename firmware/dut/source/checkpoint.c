#include "checkpoint.h"
#include "protocol.h"

static unsigned short read_u16(const unsigned char *p)
{
    return (unsigned short)((unsigned short)p[0] | ((unsigned short)p[1] << 8));
}

static unsigned long read_u32(const unsigned char *p)
{
    return (unsigned long)p[0] | ((unsigned long)p[1] << 8) |
           ((unsigned long)p[2] << 16) | ((unsigned long)p[3] << 24);
}

static void write_u16(unsigned char *p, unsigned short value)
{
    p[0] = (unsigned char)(value & 0xFFu);
    p[1] = (unsigned char)(value >> 8);
}

static void write_u32(unsigned char *p, unsigned long value)
{
    p[0] = (unsigned char)(value & 0xFFul);
    p[1] = (unsigned char)((value >> 8) & 0xFFul);
    p[2] = (unsigned char)((value >> 16) & 0xFFul);
    p[3] = (unsigned char)((value >> 24) & 0xFFul);
}

void Checkpoint_Init(Checkpoint *checkpoint, unsigned short generation,
                     unsigned short session, unsigned short attempt,
                     unsigned char pending_restore)
{
    checkpoint->generation = generation;
    checkpoint->session = session;
    checkpoint->attempt = attempt;
    checkpoint->config_crc = 0u;
    checkpoint->backup_crc = 0u;
    checkpoint->run_tag = 0ul;
    checkpoint->plan_id = 0u;
    checkpoint->phase = 0u;
    checkpoint->current_test = 0u;
    checkpoint->verdict = 0u;
    checkpoint->pending_restore = pending_restore ? 1u : 0u;
}

void Checkpoint_Encode(const Checkpoint *checkpoint, unsigned char out[CHECKPOINT_SIZE])
{
    unsigned char i;
    unsigned short crc;
    for (i = 0u; i < CHECKPOINT_SIZE; ++i) out[i] = 0u;
    out[0] = 0xA7u;
    out[1] = 0x5Cu;
    out[2] = 1u;
    out[3] = checkpoint->pending_restore;
    write_u16(out + 4, checkpoint->generation);
    write_u16(out + 6, checkpoint->session);
    write_u16(out + 8, checkpoint->attempt);
    out[10] = checkpoint->plan_id;
    out[11] = checkpoint->phase;
    out[12] = checkpoint->current_test;
    out[13] = checkpoint->verdict;
    write_u16(out + 14, checkpoint->config_crc);
    write_u16(out + 16, checkpoint->backup_crc);
    write_u32(out + 18, checkpoint->run_tag);
    crc = Proto_Crc16(out, 30u);
    write_u16(out + 30, crc);
}

unsigned char Checkpoint_Decode(const unsigned char bytes[CHECKPOINT_SIZE], Checkpoint *out)
{
    if (bytes[0] != 0xA7u || bytes[1] != 0x5Cu || bytes[2] != 1u) return 0u;
    if (read_u16(bytes + 30) != Proto_Crc16(bytes, 30u)) return 0u;
    out->pending_restore = bytes[3] ? 1u : 0u;
    out->generation = read_u16(bytes + 4);
    out->session = read_u16(bytes + 6);
    out->attempt = read_u16(bytes + 8);
    out->plan_id = bytes[10];
    out->phase = bytes[11];
    out->current_test = bytes[12];
    out->verdict = bytes[13];
    out->config_crc = read_u16(bytes + 14);
    out->backup_crc = read_u16(bytes + 16);
    out->run_tag = read_u32(bytes + 18);
    return 1u;
}

CheckpointResult Checkpoint_Select(const unsigned char slot_a[CHECKPOINT_SIZE],
                                   const unsigned char slot_b[CHECKPOINT_SIZE],
                                   Checkpoint *out)
{
    Checkpoint a;
    Checkpoint b;
    unsigned char a_valid = Checkpoint_Decode(slot_a, &a);
    unsigned char b_valid = Checkpoint_Decode(slot_b, &b);
    if (!a_valid && !b_valid) return CHECKPOINT_NONE_VALID;
    if (a_valid && (!b_valid || a.generation >= b.generation)) *out = a;
    else *out = b;
    return CHECKPOINT_OK;
}
