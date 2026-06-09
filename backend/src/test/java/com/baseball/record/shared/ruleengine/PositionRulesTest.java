package com.baseball.record.shared.ruleengine;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PositionRulesTest {
    @Test void baseball_has_9_required_and_d9() {
        assertThat(PositionRules.requiredPositions("baseball")).hasSize(9).contains("P","RF");
        assertThat(PositionRules.standardDefensiveCount("baseball")).isEqualTo(9);
    }
    @Test void slowpitch_has_10_required_with_sf_and_d10() {
        assertThat(PositionRules.requiredPositions("softball_slow")).hasSize(10).contains("SF");
        assertThat(PositionRules.standardDefensiveCount("softball_slow")).isEqualTo(10);
    }
    @Test void teeball_has_no_required() {
        assertThat(PositionRules.requiredPositions("teeball")).isEmpty();
    }
    @Test void valid_positions_for_slowpitch_include_sf() {
        assertThat(PositionRules.validPositions("softball_slow")).contains("SF");
        assertThat(PositionRules.validPositions("baseball")).doesNotContain("SF");
    }
}
