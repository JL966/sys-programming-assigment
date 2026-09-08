#include "test_engine.h"

static unsigned short read_u16(const unsigned char *p)
{
    return (unsigned short)((unsigned short)p[0] | ((unsigned short)p[1] << 8));
}

static unsigned long read_u32(const unsigned char *p)
{
    return (unsigned long)p[0] | ((unsigned long)p[1] << 8) |
           ((unsigned long)p[2] << 16) | ((unsigned long)p[3] << 24);
}

static void make_response(const TestEngine *engine, const ProtoFrame *request,
                          CommandStatus status, ProtoFrame *response)
{
    unsigned char i;
    response->version = PROTO_VERSION;
    response->msg_type = (unsigned char)(request->msg_type | 0x80u);
    response->src = engine->role;
    response->dst = request->src;
    response->session = request->session;
    response->seq = request->seq;
    response->test_id = request->test_id;
    response->step = request->step;
    response->payload_len = 1u;
    response->flags = PROTO_FLAG_RESPONSE;
    if (status != CMD_OK) response->flags |= PROTO_FLAG_ERROR;
    response->payload[0] = (unsigned char)status;
    for (i = 1u; i < PROTO_PAYLOAD_SIZE; ++i) response->payload[i] = 0u;
}

void Engine_Init(TestEngine *engine, unsigned char role)
{
    Session_Reset(&engine->session);
    RecordStore_Reset(&engine->records);
    engine->phase = ENGINE_IDLE;
    engine->reason = REASON_NONE;
    engine->role = role;
    engine->current_test = 0u;
    engine->current_attempt = 0u;
    engine->lease_ticks = 0u;
    engine->action_count = 0u;
    engine->last_seq = 0u;
    engine->last_type = 0u;
    engine->last_status = CMD_OK;
    engine->has_last = 0u;
}

static CommandStatus handle_new(TestEngine *engine, const ProtoFrame *request)
{
    unsigned short value;
    if (request->msg_type == PROTO_MSG_HELLO || request->msg_type == PROTO_MSG_GET_STATUS)
        return CMD_OK;

    if (request->msg_type == PROTO_MSG_BEGIN_SESSION) {
        if (request->session == 0u || request->payload_len != 8u) return CMD_BAD_PARAM;
        if (engine->phase != ENGINE_IDLE && engine->phase != ENGINE_DONE) return CMD_BUSY;
        Session_Reset(&engine->session);
        engine->session.id = request->session;
        engine->session.run_tag = read_u32(request->payload);
        engine->session.plan_id = request->payload[4];
        engine->session.expected_config_crc = read_u16(request->payload + 5);
        engine->session.owner = request->payload[7];
        engine->phase = ENGINE_CONFIGURING;
        return CMD_OK;
    }

    if (!Session_Matches(&engine->session, request->session)) return CMD_WRONG_SESSION;

    switch (request->msg_type) {
    case PROTO_MSG_CONFIG_WRITE:
        if (engine->phase != ENGINE_CONFIGURING || request->payload_len != 8u)
            return CMD_BAD_STATE;
        if (request->payload[0] == 0u || request->payload[0] > 0x0Cu)
            return CMD_BAD_PARAM;
        return CMD_OK;
    case PROTO_MSG_CONFIG_COMMIT:
        if (engine->phase != ENGINE_CONFIGURING || request->payload_len != 2u)
            return CMD_BAD_STATE;
        value = read_u16(request->payload);
        if (value != engine->session.expected_config_crc) return CMD_BAD_PARAM;
        engine->session.committed_config_crc = value;
        engine->session.committed = 1u;
        engine->phase = ENGINE_READY;
        return CMD_OK;
    case PROTO_MSG_RUN_PLAN:
        if (engine->role != PROTO_NODE_CTRL) return CMD_UNSUPPORTED;
        if (engine->phase == ENGINE_RUNNING) return CMD_BUSY;
        if (engine->phase != ENGINE_READY || !engine->session.committed)
            return CMD_BAD_STATE;
        if (request->payload_len < 3u || read_u16(request->payload + 1) == 0u)
            return CMD_BAD_PARAM;
        engine->session.plan_id = request->payload[0];
        engine->phase = ENGINE_RUNNING;
        engine->current_attempt++;
        engine->reason = REASON_NONE;
        return CMD_OK;
    case PROTO_MSG_PREPARE_TEST:
        if (engine->phase != ENGINE_RUNNING || request->payload_len != 8u)
            return CMD_BAD_STATE;
        value = read_u16(request->payload + 2);
        if (value == 0u || value > 60000u) return CMD_BAD_PARAM;
        engine->current_test = request->test_id;
        engine->lease_ticks = (unsigned short)((value + 9u) / 10u);
        return CMD_OK;
    case PROTO_MSG_EXECUTE_STEP:
        if (engine->phase != ENGINE_RUNNING || request->payload_len != 6u)
            return CMD_BAD_STATE;
        if (read_u16(request->payload) != engine->current_attempt) return CMD_BAD_PARAM;
        engine->action_count++;
        return CMD_OK;
    case PROTO_MSG_CANCEL_TEST:
        if (engine->phase != ENGINE_RUNNING && engine->phase != ENGINE_PAUSED)
            return CMD_BAD_STATE;
        engine->reason = REASON_USER_CANCELLED;
        engine->phase = ENGINE_CLEANUP;
        engine->lease_ticks = 0u;
        return CMD_OK;
    case PROTO_MSG_PAUSE_PLAN:
        if (engine->phase != ENGINE_RUNNING) return CMD_BAD_STATE;
        engine->phase = ENGINE_PAUSED;
        return CMD_OK;
    case PROTO_MSG_RESUME_PLAN:
        if (engine->phase != ENGINE_PAUSED) return CMD_BAD_STATE;
        engine->phase = ENGINE_RUNNING;
        return CMD_OK;
    case PROTO_MSG_CLOSE_SESSION:
        engine->phase = ENGINE_DONE;
        engine->lease_ticks = 0u;
        return CMD_OK;
    default:
        return CMD_UNSUPPORTED;
    }
}

CommandStatus Engine_HandleFrame(TestEngine *engine, const ProtoFrame *request,
                                 ProtoFrame *response)
{
    CommandStatus status;
    if (engine->has_last && engine->last_seq == request->seq &&
        engine->last_type == request->msg_type) {
        make_response(engine, request, engine->last_status, response);
        return engine->last_status;
    }
    status = handle_new(engine, request);
    engine->last_seq = request->seq;
    engine->last_type = request->msg_type;
    engine->last_status = status;
    engine->has_last = 1u;
    make_response(engine, request, status, response);
    return status;
}

void Engine_Tick10ms(TestEngine *engine)
{
    if (engine->phase == ENGINE_RUNNING && engine->lease_ticks != 0u) {
        engine->lease_ticks--;
        if (engine->lease_ticks == 0u) {
            engine->reason = REASON_LEASE_EXPIRED;
            engine->phase = ENGINE_CLEANUP;
        }
    }
}
