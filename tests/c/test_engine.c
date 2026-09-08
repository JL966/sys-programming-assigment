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
    req.payload[5] = 0x34;
    req.payload[6] = 0x12;
    assert(Engine_HandleFrame(engine, &req, &rsp) == CMD_OK);
    req = request(PROTO_MSG_CONFIG_COMMIT, 7, 2);
    req.payload_len = 2;
    req.payload[0] = 0x34;
    req.payload[1] = 0x12;
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
    assert(Engine_HandleFrame(&engine, &req, &rsp) == CMD_BAD_PARAM);
    req.seq = 4;
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

int main(void)
{
    test_run_requires_committed_session_and_nonzero_mask();
    test_duplicate_execute_does_not_repeat_action();
    test_cancel_and_lease_expiry_enter_cleanup();
    puts("C engine tests passed");
    return 0;
}
