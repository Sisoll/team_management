package com.baseball.record.stats;

import com.baseball.record.shared.eventfold.*;

import java.util.*;

/** 由事件流推導單場 box score（純函式）。進攻半局歸我隊打擊、守備半局歸我隊投手＋對手隊伍總計。 */
public final class StatsEngine {
    private StatsEngine() {}

    public static BoxScore fold(InitialStateBuilder.InitialLineup lineup, List<EventView> events) {
        GameState s = InitialStateBuilder.initial(lineup);
        Map<UUID, Bat> bat = new LinkedHashMap<>();
        for (LineupEntry e : lineup.lineup())                  // 先發都先列（含 0 打席）
            if (e.playerId() != null && e.battingOrder() > 0)
                bat.computeIfAbsent(e.playerId(), id -> new Bat(e.battingOrder(), e.fieldPosition()));
        Map<UUID, Pit> pit = new LinkedHashMap<>();
        UUID currentPitcher = lineup.startingPitcherId();      // 自管投手：away 隊 fold 的 currentPitcherId 半局為 null，故獨立追蹤
        int oppHits = 0;

        for (EventView ev : events) {
            GameState before = s;
            String type = ev.eventType();
            if (EventApplier.isSubstitution(type)) {
                if ("PITCHER_CHANGE".equals(type) && ev.subInPlayerId() != null) currentPitcher = ev.subInPlayerId();
                s = EventApplier.apply(before, ev);
                continue;
            }
            boolean offense = "offense".equals(before.battingSide());

            if (offense) {
                LineupEntry batter = batterOf(before);
                if (!EventApplier.isBaserunningOnly(type) && batter != null && batter.playerId() != null) {
                    Bat line = bat.computeIfAbsent(batter.playerId(),
                        id -> new Bat(batter.battingOrder(), batter.fieldPosition()));
                    line.pa++;
                    switch (type) {
                        case "SINGLE" -> line.h++;
                        case "DOUBLE" -> { line.h++; line.doubles++; }
                        case "TRIPLE" -> { line.h++; line.triples++; }
                        case "HOME_RUN" -> { line.h++; line.hr++; }
                        case "WALK" -> line.bb++;
                        case "HIT_BY_PITCH" -> line.hbp++;
                        case "STRIKEOUT" -> line.k++;
                        case "SAC_FLY" -> line.sacFly++;
                        case "SAC_BUNT" -> line.sacBunt++;
                        default -> { /* GROUND_OUT/FLY_OUT/FIELDERS_CHOICE/REACH_ON_ERROR：列為 AB、無安打 */ }
                    }
                    if (!"REACH_ON_ERROR".equals(type))       // RBI：本打席打回本壘數（失誤上壘不計）
                        line.rbi += (int) ev.runnerMoves().stream().filter(m -> "H".equals(m.to())).count();
                }
                for (RunnerMove m : ev.runnerMoves()) {       // R：跑回本壘歸該跑者
                    if (!"H".equals(m.to())) continue;
                    UUID pid = scorerId(before, m.from());
                    if (pid != null && bat.containsKey(pid)) bat.get(pid).r++;
                }
                if (EventApplier.isBaserunningOnly(type))     // SB：盜壘成功歸該跑者
                    for (RunnerMove m : ev.runnerMoves()) {
                        if ("OUT".equals(m.to()) || m.from().equals(m.to())) continue;
                        UUID pid = playerToken(before.bases().at(m.from()));
                        if (pid != null && bat.containsKey(pid)) bat.get(pid).sb++;
                    }
            } else {
                UUID pid = currentPitcher;
                if (pid != null) {
                    Pit p = pit.computeIfAbsent(pid, Pit::new);
                    p.outs += (int) ev.runnerMoves().stream().filter(m -> "OUT".equals(m.to())).count();
                    p.r    += (int) ev.runnerMoves().stream().filter(m -> "H".equals(m.to())).count();
                    if (isHit(type)) { p.h++; oppHits++; }
                    if ("WALK".equals(type)) p.bb++;
                    if ("STRIKEOUT".equals(type)) p.k++;
                    if (ev.pitches() != null) p.pitches += ev.pitches().pitches();
                }
            }
            s = EventApplier.apply(before, ev);
        }

        List<BoxScore.BattingLine> batting = bat.entrySet().stream()
            .sorted(Comparator.comparingInt(en -> en.getValue().order))
            .map(en -> en.getValue().toLine(en.getKey())).toList();
        List<BoxScore.PitchingLine> pitching = pit.entrySet().stream()
            .map(en -> en.getValue().toLine()).toList();
        int teamHits = batting.stream().mapToInt(BoxScore.BattingLine::h).sum();
        return new BoxScore(s.lineScore(),
            new BoxScore.TeamTotals(s.scoreUs(), teamHits),
            new BoxScore.TeamTotals(s.scoreOpp(), oppHits),
            batting, pitching);
    }

    private static LineupEntry batterOf(GameState s) {
        for (LineupEntry e : s.lineup())
            if (e.onField() && e.battingOrder() == s.currentBatterOrder()) return e;
        return null;
    }
    private static UUID scorerId(GameState before, String from) {
        if ("B".equals(from)) { LineupEntry b = batterOf(before); return b == null ? null : b.playerId(); }
        return playerToken(before.bases().at(from));
    }
    private static UUID playerToken(String token) {
        if (token == null) return null;
        try { return UUID.fromString(token); } catch (IllegalArgumentException e) { return null; }  // "OPP:.." → null
    }
    private static boolean isHit(String t) {
        return switch (t) { case "SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN" -> true; default -> false; };
    }

    private static final class Bat {
        final int order; final String position;
        int pa, h, doubles, triples, hr, r, rbi, bb, hbp, k, sb, sacFly, sacBunt;
        Bat(int order, String position) { this.order = order; this.position = position; }
        BoxScore.BattingLine toLine(UUID id) {
            int ab = Math.max(0, pa - bb - hbp - sacFly - sacBunt);
            return new BoxScore.BattingLine(id, order, position, pa, ab, r, h, doubles, triples, hr, rbi, bb, k, sb);
        }
    }
    private static final class Pit {
        final UUID id; int outs, h, r, bb, k, pitches;
        Pit(UUID id) { this.id = id; }
        BoxScore.PitchingLine toLine() { return new BoxScore.PitchingLine(id, outs, h, r, bb, k, pitches); }
    }
}
