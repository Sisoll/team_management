package com.baseball.record.shared.ruleengine;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LineupValidatorTest {

    /** 棒球 9 人，打序 1..9，守位 P,C,1B,2B,3B,SS,LF,CF,RF，全員既打又守。 */
    static List<SlotView> baseballNine() {
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        List<SlotView> s = new ArrayList<>();
        for (int i = 0; i < 9; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        return s;
    }
    static LineupView formal(List<SlotView> slots) {
        return new LineupView("baseball", false, false, 9, false, slots);
    }

    @Test
    void legal_baseball_nine_passes() {
        ValidationResult r = LineupValidator.validate(formal(baseballNine()));
        assertThat(r.valid()).isTrue();
        assertThat(r.violations()).isEmpty();
    }

    @Test
    void batting_order_gap_fails() {
        List<SlotView> s = baseballNine();
        s.set(8, new SlotView(java.util.UUID.randomUUID(), null, 10, "RF", "starter", true)); // 1..8,10
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.valid()).isFalse();
        assertThat(r.violations()).anyMatch(v -> v.code().equals("BATTING_ORDER_INVALID"));
    }

    @Test
    void missing_required_position_fails() {
        List<SlotView> s = baseballNine();
        s.set(8, new SlotView(java.util.UUID.randomUUID(), null, 9, "RF", "starter", true));
        s.set(7, new SlotView(java.util.UUID.randomUUID(), null, 8, "RF", "starter", true)); // 兩個 RF，缺 CF
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("REQUIRED_POSITION_MISSING"));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("POSITION_DUPLICATE"));
    }

    @Test
    void missing_pitcher_fails() {
        List<SlotView> s = baseballNine();
        s.set(0, new SlotView(java.util.UUID.randomUUID(), null, 1, "DH-bogus", "starter", true));
        // 把 P 換掉造成沒有投手（也會觸發守位缺漏；至少要有 PITCHER_MISSING）
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("PITCHER_MISSING"));
    }

    @Test
    void ineligible_player_fails() {
        List<SlotView> s = baseballNine();
        s.set(0, new SlotView(java.util.UUID.randomUUID(), null, 1, "P", "starter", false)); // 不可出賽
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("PLAYER_NOT_ELIGIBLE"));
    }

    @Test
    void dh_when_not_allowed_fails() {
        // 投手只守不打（無 battingOrder）+ DH 只打不守 → hasDH，但 dhEnabled=false
        List<SlotView> s = new ArrayList<>();
        String[] pos = {"C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 8; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 9, null, "starter", true));   // DH 只打
        s.add(new SlotView(java.util.UUID.randomUUID(), null, null, "P", "starter", true)); // 投手只守
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, false, 9, false, s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("DH_NOT_ALLOWED"));
    }

    @Test
    void dh_when_allowed_passes() {
        List<SlotView> s = new ArrayList<>();
        String[] pos = {"C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 8; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 9, null, "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, null, "P", "starter", true));
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", true, false, 9, false, s));
        assertThat(r.valid()).isTrue();
    }

    @Test
    void ep_when_not_allowed_fails() {
        // 棒球 10 人打擊（>9）= EP，但 epAllowed=false
        List<SlotView> s = baseballNine();
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 10, null, "starter", true)); // 第 10 棒只打
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, false, 9, false, s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("EP_NOT_ALLOWED"));
    }

    @Test
    void friendly_ep_exceeds_defense_passes() { // AC-7
        List<SlotView> s = baseballNine();
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 10, null, "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 11, null, "starter", true));
        // friendly + epAllowed → 人數超守備數不判非法
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, true, 9, true, s));
        assertThat(r.valid()).isTrue();
    }

    @Test
    void friendly_short_handed_passes_but_still_checks_order() {
        // 8 人友誼，仍檢查打序連續、投手存在
        List<SlotView> s = new ArrayList<>();
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF"};
        for (int i = 0; i < 8; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        ValidationResult ok = LineupValidator.validate(new LineupView("baseball", false, true, 9, true, s));
        assertThat(ok.valid()).isTrue();

        s.set(7, new SlotView(java.util.UUID.randomUUID(), null, 9, "CF", "starter", true)); // 1..7,9 缺號
        ValidationResult bad = LineupValidator.validate(new LineupView("baseball", false, true, 9, true, s));
        assertThat(bad.violations()).anyMatch(v -> v.code().equals("BATTING_ORDER_INVALID"));
    }

    @Test
    void formal_wrong_count_fails() {
        List<SlotView> s = baseballNine();
        s.remove(8); // 只剩 8 棒、formal 非 EP → 數量不符
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, false, 9, false, s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("BATTING_COUNT_MISMATCH"));
    }
}
