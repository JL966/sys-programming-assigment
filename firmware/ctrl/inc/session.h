#ifndef ACCEPTANCE_SESSION_H
#define ACCEPTANCE_SESSION_H

typedef struct SessionStateTag {
    unsigned short id;
    unsigned short expected_config_crc;
    unsigned short committed_config_crc;
    unsigned long run_tag;
    unsigned char plan_id;
    unsigned char owner;
    unsigned char committed;
} SessionState;

void Session_Reset(SessionState *session);
unsigned char Session_Matches(const SessionState *session, unsigned short id);

#endif
