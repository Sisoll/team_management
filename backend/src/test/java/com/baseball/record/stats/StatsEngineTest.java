package com.baseball.record.stats;

import com.baseball.record.shared.eventfold.*;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class StatsEngineTest {

    static InitialStateBuilder.InitialLineup awayLineup(UUID... ids) {
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        List<LineupEntry> lu = new ArrayList<>();
        for (int i = 0; i < ids.length; i++)
            lu.add(new LineupEntry(i + 1, ids[i], null, pos[i], true, true, false, false));
        return new InitialStateBuilder.InitialLineup("away", lu, ids[0]);   // away → 先攻
    }

    static EventView ev(int seq, String type, UUID actor, RunnerMove... moves) {
        return new EventView(seq, type, actor, List.of(), List.of(moves), null,
            null, null, null, null, null, null, null, null);
    }

    @Test
    void batter_single_then_scores_records_hit_run_rbi() {
        UUID b1 = UUID.randomUUID(), b2 = UUID.randomUUID();
        UUID[] ids = new UUID[9];
        ids[0] = b1; ids[1] = b2;
        for (int i = 2; i < 9; i++) ids[i] = UUID.randomUUID();

        List<EventView> evs = List.of(
            ev(1, "SINGLE", b1, new RunnerMove("B", "1")),                       // b1 上一壘
            ev(2, "HOME_RUN", b2, new RunnerMove("1", "H"), new RunnerMove("B", "H")) // b2 轟兩分
        );
        BoxScore box = StatsEngine.fold(awayLineup(ids), evs);

        var l1 = box.batting().stream().filter(x -> x.playerId().equals(b1)).findFirst().orElseThrow();
        var l2 = box.batting().stream().filter(x -> x.playerId().equals(b2)).findFirst().orElseThrow();
        assertThat(l1.h()).isEqualTo(1);
        assertThat(l1.ab()).isEqualTo(1);
        assertThat(l1.r()).isEqualTo(1);                 // b1 跑回本壘
        assertThat(l2.h()).isEqualTo(1);
        assertThat(l2.hr()).isEqualTo(1);
        assertThat(l2.rbi()).isEqualTo(2);               // 打回 2 分
        assertThat(l2.r()).isEqualTo(1);
        assertThat(box.team().runs()).isEqualTo(2);
        assertThat(box.team().hits()).isEqualTo(2);
    }

    @Test
    void walk_and_strikeout_affect_ab_correctly() {
        UUID b1 = UUID.randomUUID();
        UUID[] ids = new UUID[9]; ids[0] = b1;
        for (int i = 1; i < 9; i++) ids[i] = UUID.randomUUID();
        BoxScore box = StatsEngine.fold(awayLineup(ids),
            List.of(ev(1, "WALK", b1, new RunnerMove("B", "1"))));
        var l1 = box.batting().stream().filter(x -> x.playerId().equals(b1)).findFirst().orElseThrow();
        assertThat(l1.pa()).isEqualTo(1);
        assertThat(l1.bb()).isEqualTo(1);
        assertThat(l1.ab()).isZero();                    // 保送不計打數
    }

    @Test
    void stolen_base_credits_runner() {
        UUID b1 = UUID.randomUUID();
        UUID[] ids = new UUID[9]; ids[0] = b1;
        for (int i = 1; i < 9; i++) ids[i] = UUID.randomUUID();
        List<EventView> evs = List.of(
            ev(1, "SINGLE", b1, new RunnerMove("B", "1")),
            ev(2, "BASE_RUNNING", null, new RunnerMove("1", "2"))   // b1 盜二壘
        );
        BoxScore box = StatsEngine.fold(awayLineup(ids), evs);
        var l1 = box.batting().stream().filter(x -> x.playerId().equals(b1)).findFirst().orElseThrow();
        assertThat(l1.sb()).isEqualTo(1);
    }

    @Test
    void defense_half_accrues_pitching_and_opponent_totals() {
        UUID[] ids = new UUID[9];
        for (int i = 0; i < 9; i++) ids[i] = UUID.randomUUID();
        // home → top 半局我隊先守；對手打擊：一安、一三振、一得分
        var home = new InitialStateBuilder.InitialLineup("home", awayLineup(ids).lineup(), ids[0]);
        List<EventView> evs = List.of(
            new EventView(1, "SINGLE", null, List.of(), List.of(new RunnerMove("B","1")),
                new PitchTally(3,1,2,0,1), ids[0], null, "對手A", null,null,null,null,null),
            new EventView(2, "STRIKEOUT", null, List.of(), List.of(new RunnerMove("B","OUT")),
                new PitchTally(4,3,1,1,2), ids[0], null, "對手B", null,null,null,null,null)
        );
        BoxScore box = StatsEngine.fold(home, evs);
        var p = box.pitching().stream().filter(x -> x.playerId().equals(ids[0])).findFirst().orElseThrow();
        assertThat(p.h()).isEqualTo(1);
        assertThat(p.k()).isEqualTo(1);
        assertThat(p.outs()).isEqualTo(1);
        assertThat(p.pitches()).isEqualTo(7);            // 3 + 4
        assertThat(box.opponent().hits()).isEqualTo(1);
    }
}
