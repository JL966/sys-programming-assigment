#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../../firmware/common/checkpoint.h"
#include "../../firmware/common/test_adapters.h"

static void test_newest_valid_checkpoint_is_selected(void)
{
    Checkpoint first;
    Checkpoint second;
    Checkpoint selected;
    unsigned char slot_a[CHECKPOINT_SIZE];
    unsigned char slot_b[CHECKPOINT_SIZE];
    Checkpoint_Init(&first, 4, 12, 2, 1);
    Checkpoint_Init(&second, 5, 12, 3, 1);
    Checkpoint_Encode(&first, slot_a);
    Checkpoint_Encode(&second, slot_b);
    assert(Checkpoint_Select(slot_a, slot_b, &selected) == CHECKPOINT_OK);
    assert(selected.generation == 5);
    assert(selected.attempt == 3);
}

static void test_corrupt_new_slot_falls_back_to_older_valid_slot(void)
{
    Checkpoint first;
    Checkpoint second;
    Checkpoint selected;
    unsigned char slot_a[CHECKPOINT_SIZE];
    unsigned char slot_b[CHECKPOINT_SIZE];
    Checkpoint_Init(&first, 4, 12, 2, 1);
    Checkpoint_Init(&second, 5, 12, 3, 1);
    Checkpoint_Encode(&first, slot_a);
    Checkpoint_Encode(&second, slot_b);
    slot_b[10] ^= 0x55;
    assert(Checkpoint_Select(slot_a, slot_b, &selected) == CHECKPOINT_OK);
    assert(selected.generation == 4);
    slot_a[11] ^= 0x33;
    assert(Checkpoint_Select(slot_a, slot_b, &selected) == CHECKPOINT_NONE_VALID);
}

static void test_sensor_rules_preserve_inconclusive_boundary(void)
{
    signed short stable[] = {20,20,20,20,20};
    signed short varied[] = {20,21,20,19,20};
    assert(Rule_DirectionalChange(500, 540, 505, 20, 1) == VERDICT_PASS);
    assert(Rule_DirectionalChange(500, 510, 505, 20, 1) == VERDICT_FAIL);
    assert(Rule_Ultrasonic(stable, 5, 0) == VERDICT_INCONCLUSIVE);
    assert(Rule_Ultrasonic(varied, 5, 1) == VERDICT_PASS);
    assert(Rule_RtcAdvance(86398ul, 3ul, 5u, 1u) == VERDICT_PASS);
}

int main(void)
{
    test_newest_valid_checkpoint_is_selected();
    test_corrupt_new_slot_falls_back_to_older_valid_slot();
    test_sensor_rules_preserve_inconclusive_boundary();
    puts("C checkpoint and rule tests passed");
    return 0;
}
