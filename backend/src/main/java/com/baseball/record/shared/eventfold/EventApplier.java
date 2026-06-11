package com.baseball.record.shared.eventfold;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 把單一事件套用到 GameState（純函式，回新狀態）。跑者移動皆顯式（runnerMoves）。 */
public final class EventApplier {
    private EventApplier() {}

    public static GameState apply(GameState s, EventView ev) {
        if (isSubstitution(ev.eventType())) return applySubstitution(s, ev);
        return applyPlay(s, ev);
    }

    public static boolean isSubstitution(String t) {
        return switch (t) {
            case "PINCH_HIT", "PINCH_RUN", "POSITION_CHANGE", "PITCHER_CHANGE", "RE_ENTRY" -> true;
            default -> false;
        };
    }

    /** PA 結果 / 跑壘：套用 runnerMoves、計分、計出局、投球累計、必要時翻半局、推進打序游標。 */
    static GameState applyPlay(GameState s, EventView ev) {
        BaseState bases = s.bases();
        int outs = s.outs(), scoreUs = s.scoreUs(), scoreOpp = s.scoreOpp();
        int runs = 0, newOuts = 0;

        // 先清空被移動「出發壘」（B 不在壘上），再放置「目的壘」；H=得分、OUT=出局。
        // 收集目的地避免覆寫衝突：先算離壘，再放新位置。
        String first = bases.first(), second = bases.second(), third = bases.third();
        Map<String, String> place = new HashMap<>(); // base -> runner token
        for (RunnerMove m : ev.runnerMoves()) {
            String token = switch (m.from()) {
                case "1" -> first; case "2" -> second; case "3" -> third;
                case "B" -> batterToken(ev); default -> null;
            };
            // 離開原壘
            switch (m.from()) { case "1" -> first = null; case "2" -> second = null; case "3" -> third = null; }
            switch (m.to()) {
                case "H" -> runs++;
                case "OUT" -> newOuts++;
                case "1", "2", "3" -> place.put(m.to(), token);
                default -> {}
            }
        }
        BaseState moved = new BaseState(
            place.getOrDefault("1", first), place.getOrDefault("2", second), place.getOrDefault("3", third));

        outs += newOuts;
        if ("offense".equals(s.battingSide())) scoreUs += runs; else scoreOpp += runs;

        // 投球累計（守備半局、有投手）
        Map<UUID, PitchTally> pp = new HashMap<>(s.pitcherPitches());
        if (ev.pitches() != null && s.currentPitcherId() != null)
            pp.merge(s.currentPitcherId(), ev.pitches(), PitchTally::plus);

        List<int[]> line = addLineScore(s, runs);

        // 翻半局
        if (outs >= 3) {
            String nextHalf = "top".equals(s.half()) ? "bottom" : "top";
            int nextInning = "top".equals(s.half()) ? s.inning() : s.inning() + 1;
            String nextSide = flipSide(s.battingSide());
            return new GameState(nextInning, nextHalf, nextSide, 0, scoreUs, scoreOpp,
                BaseState.empty(), nextBatterOrderForHalf(s, nextSide), nextPitcher(s, nextSide),
                s.lineup(), pp, line);
        }
        int nextOrder = "offense".equals(s.battingSide()) ? wrap(s.currentBatterOrder(), s.lineup()) : s.currentBatterOrder();
        return new GameState(s.inning(), s.half(), s.battingSide(), outs, scoreUs, scoreOpp,
            moved, nextOrder, s.currentPitcherId(), s.lineup(), pp, line);
    }

    static GameState applySubstitution(GameState s, EventView ev) {
        List<LineupEntry> lu = new ArrayList<>(s.lineup());
        UUID pitcher = s.currentPitcherId();
        switch (ev.eventType()) {
            case "PITCHER_CHANGE" -> {
                pitcher = ev.subInPlayerId();
                replaceField(lu, ev, "P");
            }
            case "POSITION_CHANGE" -> replaceField(lu, ev, ev.subFieldPosition());
            case "PINCH_HIT", "PINCH_RUN" -> swapIn(lu, ev);
            case "RE_ENTRY" -> reenter(lu, ev);
            default -> {}
        }
        return new GameState(s.inning(), s.half(), s.battingSide(), s.outs(), s.scoreUs(), s.scoreOpp(),
            s.bases(), s.currentBatterOrder(), pitcher, lu, s.pitcherPitches(), s.lineScore());
    }

    // ── helpers ──
    private static String batterToken(EventView ev) {
        return ev.actorPlayerId() != null ? ev.actorPlayerId().toString()
            : (ev.guestBatterName() != null ? "OPP:" + ev.guestBatterName() : "OPP");
    }
    private static String flipSide(String side) { return "offense".equals(side) ? "defense" : "offense"; }
    private static int wrap(int order, List<LineupEntry> lu) {
        int n = (int) lu.stream().filter(e -> e.battingOrder() > 0).count();
        if (n == 0) return order;
        return order >= n ? 1 : order + 1;
    }
    private static int nextBatterOrderForHalf(GameState s, String nextSide) {
        return "offense".equals(nextSide) ? Math.max(1, s.currentBatterOrder()) : s.currentBatterOrder();
    }
    private static UUID nextPitcher(GameState s, String nextSide) {
        return "defense".equals(nextSide) ? s.currentPitcherId() : null;
    }
    private static List<int[]> addLineScore(GameState s, int runs) {
        List<int[]> line = new ArrayList<>();
        for (int[] row : s.lineScore()) line.add(row.clone());
        int idx = -1;
        for (int i = 0; i < line.size(); i++) if (line.get(i)[0] == s.inning()) { idx = i; break; }
        if (idx < 0) { line.add(new int[]{s.inning(), 0, 0}); idx = line.size() - 1; }
        if ("top".equals(s.half())) line.get(idx)[1] += runs; else line.get(idx)[2] += runs;
        return line;
    }
    private static void replaceField(List<LineupEntry> lu, EventView ev, String pos) {
        for (int i = 0; i < lu.size(); i++) {
            LineupEntry e = lu.get(i);
            if (matchesOut(e, ev)) lu.set(i, e.enter(ev.subInPlayerId(), ev.subInGuestName(), pos));
            else if (pos != null && pos.equals(e.fieldPosition()) && !matchesOut(e, ev)) lu.set(i, e.withField(null));
        }
    }
    private static void swapIn(List<LineupEntry> lu, EventView ev) {
        for (int i = 0; i < lu.size(); i++) {
            LineupEntry e = lu.get(i);
            if (matchesOut(e, ev)) {
                lu.set(i, e.leave());
                lu.set(i, lu.get(i).enter(ev.subInPlayerId(), ev.subInGuestName(), ev.subFieldPosition()));
            }
        }
    }
    private static void reenter(List<LineupEntry> lu, EventView ev) {
        for (int i = 0; i < lu.size(); i++) {
            LineupEntry e = lu.get(i);
            if (e.playerId() != null && e.playerId().equals(ev.subInPlayerId())) lu.set(i, e.reenter());
        }
    }
    private static boolean matchesOut(LineupEntry e, EventView ev) {
        return ev.subOutPlayerId() != null && ev.subOutPlayerId().equals(e.playerId());
    }
}
