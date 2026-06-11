package com.baseball.record.shared.eventfold;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * battingSide: "offense"(我隊打擊) / "defense"(我隊守備)，由 half + homeAway 推導。
 * us/opp 比分；lineScore 每局 {top,bottom}。lineup 為我隊打序狀態。
 * pitcherPitches: 我方各投手用球累計。currentBatterIndex 指向 lineup 的打序游標（offense 用）。
 */
public record GameState(
    int inning, String half, String battingSide,
    int outs, int scoreUs, int scoreOpp,
    BaseState bases,
    int currentBatterOrder,
    UUID currentPitcherId,
    List<LineupEntry> lineup,
    Map<UUID, PitchTally> pitcherPitches,
    List<int[]> lineScore) {}   // 每元素 = {inning, topRuns, bottomRuns}
