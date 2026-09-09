#include "records.h"
#include "protocol.h"

void RecordStore_Reset(RecordStore *store)
{
    store->record_id = 0u;
    store->body_crc = 0u;
    store->body_len = 0u;
    store->schema = 1u;
    store->kind = 0u;
    store->occupied = 0u;
}

unsigned char RecordStore_Save(RecordStore *store, unsigned char kind,
                               const unsigned char *body, unsigned short length)
{
    unsigned short i;
    if (store->occupied || length > RECORD_BODY_CAPACITY) return 0u;
    store->record_id++;
    store->kind = kind;
    store->body_len = length;
    for (i = 0u; i < length; ++i) store->body[i] = body[i];
    store->body_crc = Proto_Crc16(body, length);
    store->occupied = 1u;
    return 1u;
}

unsigned char RecordStore_ReadChunk(const RecordStore *store, unsigned char chunk_index,
                                    unsigned char out[RECORD_CHUNK_DATA_SIZE])
{
    unsigned short offset = (unsigned short)chunk_index * RECORD_CHUNK_DATA_SIZE;
    unsigned char i;
    unsigned short total = (unsigned short)(store->body_len + 6u);
    if (!store->occupied || offset >= total) return 0u;
    for (i = 0u; i < RECORD_CHUNK_DATA_SIZE; ++i) {
        unsigned short index = offset + i;
        if (index >= total) out[i] = 0u;
        else if (index == 0u) out[i] = store->schema;
        else if (index == 1u) out[i] = store->kind;
        else if (index == 2u) out[i] = (unsigned char)store->body_len;
        else if (index == 3u) out[i] = (unsigned char)(store->body_len >> 8);
        else if (index == 4u) out[i] = (unsigned char)store->body_crc;
        else if (index == 5u) out[i] = (unsigned char)(store->body_crc >> 8);
        else out[i] = store->body[index - 6u];
    }
    return 1u;
}

unsigned char RecordStore_Release(RecordStore *store, unsigned short record_id)
{
    if (!store->occupied || store->record_id != record_id) return 0u;
    store->occupied = 0u;
    store->body_len = 0u;
    return 1u;
}

unsigned short RecordStore_WireLength(const RecordStore *store)
{
    return store->occupied ? (unsigned short)(store->body_len + 6u) : 0u;
}
