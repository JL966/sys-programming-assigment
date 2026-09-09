#ifndef ACCEPTANCE_TEST_ENGINE_H
#define ACCEPTANCE_TEST_ENGINE_H

#include "protocol.h"
#include "platform_types.h"
#include "session.h"
#include "records.h"

typedef enum EnginePhaseTag {
    ENGINE_IDLE = 0,
    ENGINE_CONFIGURING,
    ENGINE_READY,
    ENGINE_RUNNING,
    ENGINE_PAUSED,
    ENGINE_CLEANUP,
    ENGINE_DONE
} EnginePhase;

typedef struct TestEngineTag {
    SessionState session;
    RecordStore records;
    EnginePhase phase;
    ReasonCode reason;
    unsigned char role;
    unsigned char current_test;
    unsigned short current_attempt;
    unsigned short lease_ticks;
    unsigned short action_count;
    unsigned short config_crc;
    unsigned char last_config_key;
    unsigned char eeprom_write_authorized;
    unsigned char waiting_human;
    unsigned short last_seq;
    unsigned short last_session;
    unsigned char last_src;
    unsigned char last_type;
    CommandStatus last_status;
    unsigned char has_last;
} TestEngine;

void Engine_Init(TestEngine *engine, unsigned char role);
CommandStatus Engine_HandleFrame(TestEngine *engine, const ProtoFrame *request,
                                 ProtoFrame *response);
void Engine_Tick10ms(TestEngine *engine);
CommandStatus Engine_CompleteAttempt(TestEngine *engine, TestVerdict verdict,
                                     ReasonCode reason, unsigned long duration_ms,
                                     unsigned short valid, unsigned short errors);

#endif
