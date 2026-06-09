package com.baseball.record.game.dto;

import java.time.LocalDate;
import java.util.UUID;

public record GameResponse(UUID gameId, UUID teamId, String sportType, String matchMode, String basePresetId,
                           boolean dhEnabled, boolean epAllowed, int rosterSize, boolean reEntryAllowed,
                           LocalDate gameDate, String homeAway, String opponentName, String venue,
                           String weather, Integer temperatureC, String gameStatus) {}
