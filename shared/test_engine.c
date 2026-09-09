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

static void put_u16(unsigned char *p, unsigned short value)
{
    p[0] = (unsigned char)value;
    p[1] = (unsigned char)(value >> 8);
}

static void put_u32(unsigned char *p, unsigned long value)
{
    p[0] = (unsigned char)value;
    p[1] = (unsigned char)(value >> 8);
    p[2] = (unsigned char)(value >> 16);
    p[3] = (unsigned char)(value >> 24);
}

static unsigned short crc_update(unsigned short crc, unsigned char value)
{
    unsigned char bit_index;
    crc ^= value;
    for (bit_index = 0u; bit_index < 8u; ++bit_index)
        crc = (crc & 1u) ? (unsigned short)((crc >> 1) ^ 0xA001u) : (unsigned short)(crc >> 1);
    return crc;
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
    engine->config_crc = 0xFFFFu;
    engine->last_config_key = 0u;
    engine->eeprom_write_authorized = 0u;
    engine->waiting_human = 0u;
    engine->last_seq = 0u;
    engine->last_session = 0u;
    engine->last_src = 0u;
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
        if (engine->phase != ENGINE_IDLE && engine->phase != ENGINE_DONE &&
            !(engine->phase == ENGINE_READY && !engine->records.occupied)) return CMD_BUSY;
        Session_Reset(&engine->session);
        engine->session.id = request->session;
        engine->session.run_tag = read_u32(request->payload);
        engine->session.plan_id = request->payload[4];
        engine->session.expected_config_crc = read_u16(request->payload + 5);
        engine->session.owner = request->payload[7];
        engine->config_crc = 0xFFFFu;
        engine->last_config_key = 0u;
        engine->eeprom_write_authorized = 0u;
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
        if (request->payload[0] <= engine->last_config_key) return CMD_BAD_PARAM;
        {
            unsigned char i;
            for (i = 0u; i < 8u; ++i)
                engine->config_crc = crc_update(engine->config_crc, request->payload[i]);
        }
        engine->last_config_key = request->payload[0];
        if (request->payload[0] == 5u) engine->eeprom_write_authorized = request->payload[1] == 1u;
        return CMD_OK;
    case PROTO_MSG_CONFIG_COMMIT:
        if (engine->phase != ENGINE_CONFIGURING || request->payload_len != 2u)
            return CMD_BAD_STATE;
        value = read_u16(request->payload);
        if (value != engine->session.expected_config_crc || value != engine->config_crc)
            return CMD_BAD_PARAM;
        engine->session.committed_config_crc = value;
        engine->session.committed = 1u;
        engine->phase = ENGINE_READY;
        return CMD_OK;
    case PROTO_MSG_RUN_PLAN:
        if (engine->role != PROTO_NODE_CTRL) return CMD_UNSUPPORTED;
        if (request->test_id > 15u) return CMD_BAD_PARAM;
        if (engine->phase == ENGINE_RUNNING) return CMD_BUSY;
        if (engine->phase != ENGINE_READY || !engine->session.committed)
            return CMD_BAD_STATE;
        if (request->payload_len < 3u || read_u16(request->payload + 1) == 0u)
            return CMD_BAD_PARAM;
        if (request->test_id == 5u && !engine->eeprom_write_authorized)
            return CMD_BAD_STATE;
        engine->session.plan_id = request->payload[0];
        engine->phase = ENGINE_RUNNING;
        engine->current_attempt++;
        engine->current_test = request->test_id;
        engine->waiting_human = (unsigned char)(request->test_id >= 11u && request->test_id <= 13u);
        engine->lease_ticks = engine->waiting_human ?
            (request->test_id == 13u ? 1000u : 3000u) : 0u;
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
    case PROTO_MSG_READ_RECORD:
        if (request->payload_len != 3u) return CMD_BAD_PARAM;
        if (!engine->records.occupied || read_u16(request->payload) != engine->records.record_id)
            return CMD_RECORD_NOT_FOUND;
        {
            unsigned char chunk[RECORD_CHUNK_DATA_SIZE];
            if (!RecordStore_ReadChunk(&engine->records, request->payload[2], chunk))
                return CMD_RECORD_NOT_FOUND;
        }
        return CMD_OK;
    case PROTO_MSG_RELEASE_RESULT:
        if (request->payload_len != 2u) return CMD_BAD_PARAM;
        if (!RecordStore_Release(&engine->records, read_u16(request->payload)))
            return CMD_RECORD_NOT_FOUND;
        engine->phase = ENGINE_READY;
        engine->current_test = 0u;
        return CMD_OK;
    case PROTO_MSG_RENEW_LEASE:
        if (engine->phase != ENGINE_RUNNING || request->payload_len != 4u)
            return CMD_BAD_STATE;
        if (read_u16(request->payload) != engine->current_attempt) return CMD_BAD_PARAM;
        value = read_u16(request->payload + 2u);
        if (value == 0u || value > 60000u) return CMD_BAD_PARAM;
        engine->lease_ticks = (unsigned short)((value + 9u) / 10u);
        return CMD_OK;
    case PROTO_MSG_HUMAN_CONFIRM:
        if (engine->phase != ENGINE_RUNNING || !engine->waiting_human ||
            request->payload_len != 3u || read_u16(request->payload) != engine->current_attempt)
            return CMD_BAD_STATE;
        if (request->payload[2] == 1u)
            return Engine_CompleteAttempt(engine, VERDICT_PASS, REASON_NONE, 0ul, 1u, 0u);
        if (request->payload[2] == 2u)
            return Engine_CompleteAttempt(engine, VERDICT_FAIL, REASON_USER_REJECTED, 0ul, 0u, 1u);
        if (request->payload[2] == 3u)
            return Engine_CompleteAttempt(engine, VERDICT_INCONCLUSIVE, REASON_STIMULUS_UNCONFIRMED, 0ul, 0u, 0u);
        return CMD_BAD_PARAM;
    case PROTO_MSG_LINK_CHALLENGE:
        if (request->payload_len != 5u) return CMD_BAD_PARAM;
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

static void enrich_response(const TestEngine *engine, const ProtoFrame *request,
                            CommandStatus status, ProtoFrame *response)
{
    unsigned char chunk[RECORD_CHUNK_DATA_SIZE];
    if (status != CMD_OK) return;
    if (request->msg_type == PROTO_MSG_GET_STATUS) {
        response->payload_len = 8u;
        response->payload[1] = (unsigned char)engine->phase;
        put_u16(response->payload + 2u, engine->current_attempt);
        response->payload[4] = engine->current_test;
        response->payload[5] = (unsigned char)engine->reason;
        put_u16(response->payload + 6u, engine->records.occupied ? engine->records.record_id : 0u);
    } else if (request->msg_type == PROTO_MSG_READ_RECORD) {
        response->payload_len = 8u;
        put_u16(response->payload + 1u, engine->records.record_id);
        response->payload[3] = request->payload[2];
        RecordStore_ReadChunk(&engine->records, request->payload[2], chunk);
        response->payload[4] = chunk[0]; response->payload[5] = chunk[1];
        response->payload[6] = chunk[2]; response->payload[7] = chunk[3];
    } else if (request->msg_type == PROTO_MSG_LINK_CHALLENGE) {
        response->payload_len = 6u;
        response->payload[1] = request->payload[0]; response->payload[2] = request->payload[1];
        response->payload[3] = request->payload[2]; response->payload[4] = request->payload[3];
        response->payload[5] = request->payload[4];
    }
}

CommandStatus Engine_HandleFrame(TestEngine *engine, const ProtoFrame *request,
                                 ProtoFrame *response)
{
    CommandStatus status;
    if (engine->has_last && engine->last_seq == request->seq &&
        engine->last_session == request->session && engine->last_src == request->src &&
        engine->last_type == request->msg_type) {
        make_response(engine, request, engine->last_status, response);
        enrich_response(engine, request, engine->last_status, response);
        return engine->last_status;
    }
    status = handle_new(engine, request);
    engine->last_seq = request->seq;
    engine->last_session = request->session;
    engine->last_src = request->src;
    engine->last_type = request->msg_type;
    engine->last_status = status;
    engine->has_last = 1u;
    make_response(engine, request, status, response);
    enrich_response(engine, request, status, response);
    return status;
}

CommandStatus Engine_CompleteAttempt(TestEngine *engine, TestVerdict verdict,
                                     ReasonCode reason, unsigned long duration_ms,
                                     unsigned short valid, unsigned short errors)
{
    unsigned char body[15];
    if (engine->phase != ENGINE_RUNNING && engine->phase != ENGINE_CLEANUP) return CMD_BAD_STATE;
    if (engine->records.occupied) return CMD_BUFFER_FULL;
    put_u16(body, engine->current_attempt);
    body[2] = engine->current_test;
    body[3] = (unsigned char)verdict;
    body[4] = (unsigned char)reason;
    body[5] = engine->waiting_human ? 3u : 1u;
    body[6] = 1u;
    put_u32(body + 7u, duration_ms);
    put_u16(body + 11u, valid);
    put_u16(body + 13u, errors);
    if (!RecordStore_Save(&engine->records, 1u, body, 15u)) return CMD_BUFFER_FULL;
    engine->reason = reason;
    engine->waiting_human = 0u;
    engine->lease_ticks = 0u;
    engine->phase = ENGINE_DONE;
    return CMD_OK;
}

void Engine_Tick10ms(TestEngine *engine)
{
    if (engine->phase == ENGINE_RUNNING && engine->lease_ticks != 0u) {
        engine->lease_ticks--;
        if (engine->lease_ticks == 0u) {
            engine->reason = REASON_LEASE_EXPIRED;
            engine->phase = ENGINE_CLEANUP;
        }
    } else if (engine->phase == ENGINE_CLEANUP && !engine->records.occupied) {
        TestVerdict verdict = engine->reason == REASON_USER_CANCELLED ? VERDICT_ABORTED : VERDICT_FAIL;
        Engine_CompleteAttempt(engine, verdict, engine->reason, 0ul, 0u, 1u);
    }
}
