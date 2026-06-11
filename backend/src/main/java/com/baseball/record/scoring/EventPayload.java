package com.baseball.record.scoring;

import com.baseball.record.shared.eventfold.PitchTally;
import com.baseball.record.shared.eventfold.RunnerMove;

import java.util.List;
import java.util.UUID;

/** game_event.payload(JSONB) 的內容；換人欄位於非換人事件為 null。 */
public record EventPayload(
    List<RunnerMove> runnerMoves, PitchTally pitches,
    String fieldPosition, String guestBatterName,
    UUID subInPlayerId, String subInGuestName, UUID subOutPlayerId,
    Integer subBattingOrder, String subFieldPosition) {}
