package com.baseball.record.scoring.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;
import java.util.UUID;

/** 記一筆事件。PA：actorPlayerId + runnerMoves(+pitches)。換人：sub* 欄位。 */
public record RecordEventRequest(
    @NotNull @Pattern(regexp = "SINGLE|DOUBLE|TRIPLE|HOME_RUN|WALK|HIT_BY_PITCH|STRIKEOUT|GROUND_OUT|FLY_OUT|FIELDERS_CHOICE|SAC_FLY|SAC_BUNT|REACH_ON_ERROR|PINCH_HIT|PINCH_RUN|POSITION_CHANGE|PITCHER_CHANGE|RE_ENTRY|BASE_RUNNING")
    String eventType,
    UUID actorPlayerId,
    List<UUID> relatedPlayers,
    List<RunnerMoveDto> runnerMoves,
    PitchTallyDto pitches,
    String fieldPosition,
    String guestBatterName,
    UUID subInPlayerId, String subInGuestName, UUID subOutPlayerId,
    Integer subBattingOrder, String subFieldPosition) {}
