#ifndef ACCEPTANCE_TEST_ADAPTERS_H
#define ACCEPTANCE_TEST_ADAPTERS_H

#include "platform_types.h"

TestVerdict Rule_DirectionalChange(signed short baseline, signed short stimulated,
                                   signed short recovered, unsigned short min_delta,
                                   signed char expected_direction);
TestVerdict Rule_Ultrasonic(const signed short *values, unsigned char count,
                            unsigned char freshness_observable);
TestVerdict Rule_RtcAdvance(unsigned long before_seconds, unsigned long after_seconds,
                            unsigned short expected_elapsed, unsigned short tolerance);

#endif
