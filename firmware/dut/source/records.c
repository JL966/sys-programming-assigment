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
    if (!store->occupied || offset >= store->body_len) return 0u;
    for (i = 0u; i < RECORD_CHUNK_DATA_SIZE; ++i) {
        unsigned short index = offset + i;
        out[i] = index < store->body_len ? store->body[index] : 0u;
    }
    return 1u;
}
