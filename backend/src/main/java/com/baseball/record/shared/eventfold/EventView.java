package com.baseball.record.shared.eventfold;

import java.util.List;
import java.util.UUID;

/**
 * fold 純輸入。runnerMoves 顯式描述本事件所有跑者去向（含打者 from="B"）。
 * pitcherId = 本事件當下投手（守備半局＝我方投手；offense 半局 = null）。
 * fieldPosition：L3 守位（出局守備位置，可 null）。guestBatterName：對手匿名打者顯示名（可 null）。
 * sub*：換人事件用（PINCH_HIT/PINCH_RUN/POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY）。
 */
public record EventView(
    int sequenceNo, String eventType,
    UUID actorPlayerId, List<UUID> relatedPlayers,
    List<RunnerMove> runnerMoves, PitchTally pitches,
    UUID pitcherId, String fieldPosition, String guestBatterName,
    UUID subInPlayerId, String subInGuestName, UUID subOutPlayerId,
    Integer subBattingOrder, String subFieldPosition) {}
