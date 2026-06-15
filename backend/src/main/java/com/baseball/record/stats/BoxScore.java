package com.baseball.record.stats;

import java.util.List;
import java.util.UUID;

/** StatsEngine 輸出。我隊 per-player（batting/pitching）；對手只到隊伍總計。球員名/AVG/IP/ER 於 service 層補。 */
public record BoxScore(
    List<int[]> lineScore,          // 每元素 {inning, topRuns, bottomRuns}
    TeamTotals team, TeamTotals opponent,
    List<BattingLine> batting, List<PitchingLine> pitching) {

    public record TeamTotals(int runs, int hits) {}

    public record BattingLine(UUID playerId, int order, String position,
        int pa, int ab, int r, int h, int doubles, int triples, int hr,
        int rbi, int bb, int k, int sb) {}

    public record PitchingLine(UUID playerId, int outs, int h, int r, int bb, int k, int pitches) {}
}
