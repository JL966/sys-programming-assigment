#include "test_adapters.h"

static unsigned short distance(signed short a, signed short b)
{
    long delta = (long)a - (long)b;
    if (delta < 0) delta = -delta;
    return (unsigned short)delta;
}

TestVerdict Rule_DirectionalChange(signed short baseline, signed short stimulated,
                                   signed short recovered, unsigned short min_delta,
                                   signed char expected_direction)
{
    long change = (long)stimulated - (long)baseline;
    if ((expected_direction > 0 && change <= 0) || (expected_direction < 0 && change >= 0))
        return VERDICT_FAIL;
    if (distance(stimulated, baseline) < min_delta) return VERDICT_FAIL;
    if (distance(recovered, baseline) > min_delta) return VERDICT_INCONCLUSIVE;
    return VERDICT_PASS;
}

TestVerdict Rule_Ultrasonic(const signed short *values, unsigned char count,
                            unsigned char freshness_observable)
{
    unsigned char i;
    unsigned char changed = 0u;
    if (values == 0 || count == 0u) return VERDICT_INCONCLUSIVE;
    for (i = 0u; i < count; ++i) {
        if (values[i] < 0) return VERDICT_INCONCLUSIVE;
        if (i != 0u && values[i] != values[0]) changed = 1u;
    }
    if (!freshness_observable && !changed) return VERDICT_INCONCLUSIVE;
    return VERDICT_PASS;
}

TestVerdict Rule_RtcAdvance(unsigned long before_seconds, unsigned long after_seconds,
                            unsigned short expected_elapsed, unsigned short tolerance)
{
    unsigned long actual;
    unsigned long low;
    unsigned long high = (unsigned long)expected_elapsed + tolerance;
    if (expected_elapsed > tolerance) low = (unsigned long)(expected_elapsed - tolerance);
    else low = 0ul;
    if (before_seconds >= 86400ul || after_seconds >= 86400ul) return VERDICT_INCONCLUSIVE;
    actual = after_seconds >= before_seconds ? after_seconds - before_seconds :
             (86400ul - before_seconds) + after_seconds;
    return (actual >= low && actual <= high) ? VERDICT_PASS : VERDICT_FAIL;
}
