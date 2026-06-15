package com.baseball.record.stats.dto;

import java.util.List;

public record BoxScoreResponse(
    List<LineRow> lineScore, Totals team, Totals opponent,
    List<BatRow> batting, List<PitchRow> pitching) {

    public record LineRow(int inning, int top, int bottom) {}
    public record Totals(int runs, int hits) {}
    public record BatRow(String playerId, int order, String name, String position,
        int pa, int ab, int r, int h, int doubles, int triples, int hr,
        int rbi, int bb, int k, int sb, String avg) {}
    public record PitchRow(String playerId, String name, String ip,
        int h, int r, int er, boolean erOverridden, int bb, int k, int pitches) {}
}
