#ifndef ACCEPTANCE_RECORDS_H
#define ACCEPTANCE_RECORDS_H

#define RECORD_BODY_CAPACITY 64u
#define RECORD_CHUNK_DATA_SIZE 4u

typedef struct RecordStoreTag {
    unsigned short record_id;
    unsigned short body_crc;
    unsigned short body_len;
    unsigned char schema;
    unsigned char kind;
    unsigned char occupied;
    unsigned char body[RECORD_BODY_CAPACITY];
} RecordStore;

void RecordStore_Reset(RecordStore *store);
unsigned char RecordStore_Save(RecordStore *store, unsigned char kind,
                               const unsigned char *body, unsigned short length);
unsigned char RecordStore_ReadChunk(const RecordStore *store, unsigned char chunk_index,
                                    unsigned char out[RECORD_CHUNK_DATA_SIZE]);

#endif
