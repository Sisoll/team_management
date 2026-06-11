package com.baseball.record.shared.ruleengine;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SubstitutionValidatorTest {

    static SubstitutionAction pinchHit(boolean outOnField) {
        return new SubstitutionAction("PINCH_HIT", UUID.randomUUID(), outOnField,
            UUID.randomUUID(), false, false, false, null, false, Map.of());
    }

    @Test
    void pinch_hit_for_on_field_player_is_valid() {
        ValidationResult r = SubstitutionValidator.validate(pinchHit(true));
        assertThat(r.valid()).isTrue();
    }

    @Test
    void sub_target_not_on_field_fails() {
        ValidationResult r = SubstitutionValidator.validate(pinchHit(false));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("SUB_TARGET_NOT_ON_FIELD"));
    }

    @Test
    void re_entry_not_allowed_fails() { // VR-002/003：reEntryAllowed=false
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), true, false, true, "LF", false, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("RE_ENTRY_NOT_ALLOWED"));
    }

    @Test
    void re_entry_once_allowed_passes() {
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), true, false, true, "LF", true, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.valid()).isTrue();
    }

    @Test
    void re_entry_second_time_fails() { // 已用過再上場
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), true, true, true, "LF", true, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("RE_ENTRY_ALREADY_USED"));
    }

    @Test
    void re_entry_non_starter_fails() { // 只有先發可再上場
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), false, false, true, "LF", true, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("RE_ENTRY_NOT_STARTER"));
    }

    @Test
    void position_change_duplicate_fails() {
        SubstitutionAction a = new SubstitutionAction("POSITION_CHANGE", UUID.randomUUID(), true,
            UUID.randomUUID(), false, false, false, "SS", false, Map.of("SS", 1));
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("POSITION_DUPLICATE"));
    }
}
