#ifndef ACCEPTANCE_CHECKPOINT_H
#define ACCEPTANCE_CHECKPOINT_H

#define CHECKPOINT_SIZE 32u

typedef enum CheckpointResultTag {
    CHECKPOINT_OK = 0,
    CHECKPOINT_NONE_VALID = 1
} CheckpointResult;

typedef struct CheckpointTag {
    unsigned short generation;
    unsigned short session;
    unsigned short attempt;
    unsigned short config_crc;
    unsigned short backup_crc;
    unsigned long run_tag;
    unsigned char plan_id;
    unsigned char phase;
    unsigned char current_test;
    unsigned char verdict;
    unsigned char pending_restore;
} Checkpoint;

void Checkpoint_Init(Checkpoint *checkpoint, unsigned short generation,
                     unsigned short session, unsigned short attempt,
                     unsigned char pending_restore);
void Checkpoint_Encode(const Checkpoint *checkpoint, unsigned char out[CHECKPOINT_SIZE]);
unsigned char Checkpoint_Decode(const unsigned char bytes[CHECKPOINT_SIZE], Checkpoint *out);
CheckpointResult Checkpoint_Select(const unsigned char slot_a[CHECKPOINT_SIZE],
                                   const unsigned char slot_b[CHECKPOINT_SIZE],
                                   Checkpoint *out);

#endif
