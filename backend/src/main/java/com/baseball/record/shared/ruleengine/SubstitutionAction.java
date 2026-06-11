package com.baseball.record.shared.ruleengine;

import java.util.UUID;

/**
 * 換人動作純輸入（service 由 GameState.lineup 解析後傳入）。
 * type: PINCH_HIT/PINCH_RUN/POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY。
 * outOnField: 被換者目前是否在場；inAlreadyStarter: 接手者是否為「曾先發、已下場」（再上場對象）。
 * inHasReEntered: 接手者是否已用過再上場。targetPosition: 換上後守位（POSITION_CHANGE/PITCHER_CHANGE）。
 */
public record SubstitutionAction(
    String type, UUID outPlayerId, boolean outOnField,
    UUID inPlayerId, boolean inAlreadyStarter, boolean inHasReEntered, boolean inExited,
    String targetPosition, boolean reEntryAllowed,
    java.util.Map<String, Integer> currentPositionCounts) {}
