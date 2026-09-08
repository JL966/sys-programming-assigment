#include "session.h"

void Session_Reset(SessionState *session)
{
    session->id = 0u;
    session->expected_config_crc = 0u;
    session->committed_config_crc = 0u;
    session->run_tag = 0ul;
    session->plan_id = 0u;
    session->owner = 0u;
    session->committed = 0u;
}

unsigned char Session_Matches(const SessionState *session, unsigned short id)
{
    return (unsigned char)(session->id != 0u && session->id == id);
}
