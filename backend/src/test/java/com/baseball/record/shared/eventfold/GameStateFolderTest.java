package com.baseball.record.shared.eventfold;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class GameStateFolderTest {

    static EventView pa(int seq, String type, RunnerMove... moves) {
        return new EventView(seq, type, UUID.randomUUID(), List.of(), List.of(moves), null,
            null, null, null, null, null, null, null, null);
    }

    /** 我隊 away：起始 top 半局、進攻。打序 9 人（playerId 1..9）。 */
    static InitialStateBuilder.InitialLineup lineup9() {
        List<LineupEntry> es = new ArrayList<>();
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 9; i++)
            es.add(new LineupEntry(i + 1, UUID.randomUUID(), null, pos[i], true, true, false, false));
        return new InitialStateBuilder.InitialLineup("away", es, es.get(0).playerId());
    }

    @Test
    void empty_events_yield_initial_top1_offense() {
        GameState s = GameStateFolder.fold(lineup9(), List.of());
        assertThat(s.inning()).isEqualTo(1);
        assertThat(s.half()).isEqualTo("top");
        assertThat(s.battingSide()).isEqualTo("offense");
        assertThat(s.currentBatterOrder()).isEqualTo(1);
        assertThat(s.outs()).isZero();
    }

    @Test
    void three_strikeouts_flip_to_bottom_defense() {
        GameState s = GameStateFolder.fold(lineup9(), List.of(
            pa(1, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(2, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(3, "STRIKEOUT", new RunnerMove("B", "OUT"))));
        assertThat(s.half()).isEqualTo("bottom");
        assertThat(s.battingSide()).isEqualTo("defense");
        assertThat(s.outs()).isZero();
    }

    @Test
    void runs_in_top_count_to_us_and_linescore() {
        GameState s = GameStateFolder.fold(lineup9(), List.of(
            pa(1, "HOME_RUN", new RunnerMove("B", "H")),
            pa(2, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(3, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(4, "STRIKEOUT", new RunnerMove("B", "OUT"))));
        assertThat(s.scoreUs()).isEqualTo(1);
        assertThat(s.lineScore().get(0)[1]).isEqualTo(1); // top of inning 1 = 1 run
    }

    @Test
    void batting_cursor_advances_and_wraps() {
        List<EventView> evs = new ArrayList<>();
        for (int i = 1; i <= 3; i++) evs.add(pa(i, "STRIKEOUT", new RunnerMove("B", "OUT")));
        GameState s = GameStateFolder.fold(lineup9(), evs);
        // 3 出局後翻到 bottom（defense），守備半局不推我隊打序游標
        assertThat(s.battingSide()).isEqualTo("defense");
    }
}
