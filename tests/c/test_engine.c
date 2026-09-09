#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../../shared/test_engine.h"

static ProtoFrame request(unsigned char type, unsigned short session, unsigned short seq)
{
    ProtoFrame frame;
    memset(&frame, 0, sizeof(frame));
    frame.version = PROTO_VERSION;
    frame.msg_type = type;
    frame.src = PROTO_NODE_PC;
    frame.dst = PROTO_NODE_CTRL;
    frame.session = session;
    frame.seq = seq;
    return frame;
}

static void begin_ready_session(TestEngine *engine)
{
    ProtoFrame req;
    ProtoFrame rsp;
    req = request(PROTO_MSG_BEGIN_SESSION, 7, 1);
    req.payload_len = 8;
    req.payload[4] = 1;
    req.payload[5] = 0xFF;
    req.payload[6] = 0xFF;
    assert(Engine_HandleFrame(engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_CONFIG_COMMIT, 7, 2);
    req.payload_len = 2;
    req.payload[0] = 0xFF;
    req.payload[1] = 0xFF;
    assert(Engine_HandleFrame(engine, &req, &rsp) == CMD_OK);
    assert(engine->phase == ENGINE_READY);
}

static void test_run_requires_committed_session_and_nonzero_mask(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    req = request(PROTO_MSG_RUN_PLAN, 7, 1);
    req.payload_len = 3;
    req.payload[0] = 1;
    req.payload[1] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_WRONG_SESSION);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3;
    req.test_id = 16;
    req.seq = 4;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_BAD_PARAM);
    req.test_id = 1;
    req.seq = 5;
    req.payload[1] = 0;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_BAD_PARAM);
    req.seq = 6;
    req.payload[1] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.phase == ENGINE_RUNNING);
    assert(engine.current_attempt == 1);
}

static void test_duplicate_execute_does_not_repeat_action(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3;
    req.payload[0] = 1;
    req.payload[1] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_EXECUTE_STEP, 7, 4);
    req.test_id = 1;
    req.step = 1;
    req.payload_len = 6;
    req.payload[0] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.action_count == 1);
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.action_count == 1);
}

static void test_cancel_and_lease_expiry_enter_cleanup(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3;
    req.payload[1] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_PREPARE_TEST, 7, 4);
    req.test_id = 2;
    req.payload_len = 8;
    req.payload[0] = 1;
    req.payload[2] = 20;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    Engine_Tick10ms(&engine);
    Engine_Tick10ms(&engine);
    assert(engine.phase == ENGINE_CLEANUP);
    assert(engine.reason == REASON_LEASE_EXPIRED);

    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3;
    req.payload[1] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_CANCEL_TEST, 7, 4);
    req.payload_len = 3;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.phase == ENGINE_CLEANUP);
    assert(engine.reason == REASON_USER_CANCELLED);
}

static void test_status_result_record_and_release_lifecycle(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    unsigned short record_id;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3;
    req.payload[1] = 1;
    req.test_id = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(Engine_CompleteAttempt(&engine, VERDICT_PASS, REASON_NONE, 25, 10, 0) == CMD_OK);

    req = request(PROTO_MSG_GET_STATUS, 7, 4);
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(rsp.payload_len == 8);
    assert(rsp.payload[1] == ENGINE_DONE);
    record_id = (unsigned short)(rsp.payload[6] | ((unsigned short)rsp.payload[7] << 8));
    assert(record_id != 0);

    req = request(PROTO_MSG_READ_RECORD, 7, 5);
    req.payload_len = 3;
    req.payload[0] = (unsigned char)record_id;
    req.payload[1] = (unsigned char)(record_id >> 8);
    req.payload[2] = 0;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(rsp.payload_len == 8);
    assert(rsp.payload[4] == 1); /* schema */
    assert(rsp.payload[5] == 1); /* result kind */

    req = request(PROTO_MSG_RELEASE_RESULT, 7, 6);
    req.payload_len = 2;
    req.payload[0] = (unsigned char)record_id;
    req.payload[1] = (unsigned char)(record_id >> 8);
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.records.occupied == 0);
    assert(engine.phase == ENGINE_READY);
    req.seq = 7;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_RECORD_NOT_FOUND);
}

static void test_renew_human_confirmation_and_link_challenge_boundaries(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3; req.payload[1] = 1; req.test_id = 11;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_RENEW_LEASE, 7, 4);
    req.payload_len = 4; req.payload[0] = 1; req.payload[2] = 100;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.lease_ticks == 10);
    req = request(PROTO_MSG_HUMAN_CONFIRM, 7, 5);
    req.test_id = 11; req.payload_len = 3; req.payload[0] = 1; req.payload[2] = 1;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.records.occupied == 1);

    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_LINK_CHALLENGE, 7, 3);
    req.payload_len = 5; req.payload[0] = 9; req.payload[1] = 0x34; req.payload[2] = 0x12;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(rsp.payload_len == 6 && rsp.payload[1] == 9 && rsp.payload[2] == 0x34);
}

static void test_manual_plan_has_a_finite_safety_lease(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.payload_len = 3; req.payload[1] = 1; req.test_id = 11;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.waiting_human == 1u && engine.lease_ticks != 0u);
    while (engine.phase == ENGINE_RUNNING) Engine_Tick10ms(&engine);
    assert(engine.phase == ENGINE_CLEANUP && engine.reason == REASON_LEASE_EXPIRED);
    Engine_Tick10ms(&engine);
    assert(engine.records.occupied == 1u && engine.phase == ENGINE_DONE);
}

static void test_config_crc_order_and_eeprom_write_gate(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    unsigned char config[8] = {5,1,0,0,0,0,0,0};
    unsigned short crc = Proto_Crc16(config, 8);
    Engine_Init(&engine, PROTO_NODE_CTRL);
    req = request(PROTO_MSG_BEGIN_SESSION, 9, 1);
    req.payload_len = 8; req.payload[4] = 1;
    req.payload[5] = (unsigned char)crc; req.payload[6] = (unsigned char)(crc >> 8);
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_CONFIG_WRITE, 9, 2);
    req.payload_len = 8; memcpy(req.payload, config, 8);
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req.seq = 3;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_BAD_PARAM); /* duplicate key */
    req = request(PROTO_MSG_CONFIG_COMMIT, 9, 4);
    req.payload_len = 2; req.payload[0] = (unsigned char)crc; req.payload[1] = (unsigned char)(crc >> 8);
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_RUN_PLAN, 9, 5);
    req.test_id = 5; req.payload_len = 3; req.payload[1] = 0x10;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);

    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_RUN_PLAN, 7, 3);
    req.test_id = 5; req.payload_len = 3; req.payload[1] = 0x10;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_BAD_STATE);
}

static void test_new_session_after_released_result_is_allowed(void)
{
    TestEngine engine;
    ProtoFrame req;
    ProtoFrame rsp;
    Engine_Init(&engine, PROTO_NODE_CTRL);
    begin_ready_session(&engine);
    req = request(PROTO_MSG_BEGIN_SESSION, 8, 3);
    req.payload_len = 8; req.payload[5] = 0xFF; req.payload[6] = 0xFF;
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_OK);
    assert(engine.session.id == 8u && engine.phase == ENGINE_CONFIGURING);
}

int main(void)
{
    test_run_requires_committed_session_and_nonzero_mask();
    test_duplicate_execute_does_not_repeat_action();
    test_cancel_and_lease_expiry_enter_cleanup();
    test_status_result_record_and_release_lifecycle();
    test_renew_human_confirmation_and_link_challenge_boundaries();
    test_manual_plan_has_a_finite_safety_lease();
    test_config_crc_order_and_eeprom_write_gate();
    test_new_session_after_released_result_is_allowed();
    puts("C engine tests passed");
    return 0;
}
