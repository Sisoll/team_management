package com.baseball.record.shared.eventfold;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EventApplierTest {

    static GameState fresh() {
        // 我隊客場（away）→ top 半局我隊進攻；簡化 9 人打序、投手 = lineup[0..8] 不重要（offense）
        return new GameState(1, "top", "offense", 0, 0, 0, BaseState.empty(),
            1, null, java.util.List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
    }

    static EventView pa(String type, List<RunnerMove> moves) {
        return new EventView(1, type, UUID.randomUUID(), List.of(), moves, null,
            null, null, null, null, null, null, null, null);
    }

    @Test
    void single_puts_batter_on_first() {
        GameState s = EventApplier.apply(fresh(), pa("SINGLE", List.of(new RunnerMove("B", "1"))));
        assertThat(s.bases().first()).isNotNull();
        assertThat(s.outs()).isZero();
        assertThat(s.scoreUs()).isZero();
    }

    @Test
    void strikeout_adds_out() {
        GameState s = EventApplier.apply(fresh(), pa("STRIKEOUT", List.of(new RunnerMove("B", "OUT"))));
        assertThat(s.outs()).isEqualTo(1);
        assertThat(s.bases().first()).isNull();
    }

    @Test
    void home_run_with_runner_scores_two() {
        GameState start = new GameState(1, "top", "offense", 0, 0, 0,
            BaseState.empty().with("1", "r1"), 3, null, List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
        GameState s = EventApplier.apply(start, pa("HOME_RUN",
            List.of(new RunnerMove("1", "H"), new RunnerMove("B", "H"))));
        assertThat(s.scoreUs()).isEqualTo(2);
        assertThat(s.bases()).isEqualTo(BaseState.empty());
    }

    @Test
    void third_out_flips_half_and_clears_bases() {
        GameState start = new GameState(1, "top", "offense", 2, 0, 0,
            BaseState.empty().with("2", "r2"), 5, null, List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
        GameState s = EventApplier.apply(start, pa("FLY_OUT", List.of(new RunnerMove("B", "OUT"))));
        assertThat(s.outs()).isZero();
        assertThat(s.half()).isEqualTo("bottom");
        assertThat(s.battingSide()).isEqualTo("defense");
        assertThat(s.bases()).isEqualTo(BaseState.empty());
    }

    @Test
    void defense_pa_pitch_tally_accrues_to_pitcher() {
        UUID p = UUID.randomUUID();
        GameState start = new GameState(1, "bottom", "defense", 0, 0, 0, BaseState.empty(),
            0, p, List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
        EventView ev = new EventView(1, "STRIKEOUT", null, List.of(), List.of(new RunnerMove("B", "OUT")),
            new PitchTally(4, 3, 1, 2, 1), p, null, "對手1", null, null, null, null, null);
        GameState s = EventApplier.apply(start, ev);
        assertThat(s.pitcherPitches().get(p).pitches()).isEqualTo(4);
        assertThat(s.outs()).isEqualTo(1);
    }

    @Test
    void base_running_advance_does_not_advance_batting_order() {
        GameState start = new GameState(1, "top", "offense", 0, 0, 0,
            BaseState.empty().with("1", "r1"), 3, null, List.of(),
            new java.util.HashMap<>(), new java.util.ArrayList<>());
        // 盜二壘：1 壘跑者 → 2 壘；打者沒上場打擊
        GameState s = EventApplier.apply(start, pa("BASE_RUNNING", List.of(new RunnerMove("1", "2"))));
        assertThat(s.bases().second()).isEqualTo("r1");
        assertThat(s.bases().first()).isNull();
        assertThat(s.currentBatterOrder()).isEqualTo(3);   // 打序游標不動
        assertThat(s.outs()).isZero();
    }

    @Test
    void base_running_caught_stealing_adds_out_keeps_order() {
        GameState start = new GameState(1, "top", "offense", 0, 0, 0,
            BaseState.empty().with("1", "r1"), 4, null, List.of(),
            new java.util.HashMap<>(), new java.util.ArrayList<>());
        GameState s = EventApplier.apply(start, pa("BASE_RUNNING", List.of(new RunnerMove("1", "OUT"))));
        assertThat(s.outs()).isEqualTo(1);
        assertThat(s.bases().first()).isNull();
        assertThat(s.currentBatterOrder()).isEqualTo(4);
    }
}
