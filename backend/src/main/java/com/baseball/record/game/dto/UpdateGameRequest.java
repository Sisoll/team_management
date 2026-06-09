package com.baseball.record.game.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record UpdateGameRequest(
    @Pattern(regexp = "baseball|softball_fast|softball_slow|teeball") String sportType,
    @Pattern(regexp = "formal|friendly|intra_squad") String matchMode,
    String basePresetId,
    Boolean dhEnabled,
    Boolean epAllowed,
    @Min(1) Integer rosterSize,
    Boolean reEntryAllowed,
    LocalDate gameDate,
    @Pattern(regexp = "home|away") String homeAway,
    @Size(max = 120) String opponentName,
    @Size(max = 120) String venue,
    @Size(max = 40) String weather,
    @Min(-50) @Max(60) Integer temperatureC,
    @Pattern(regexp = "draft|scheduled|lineup_confirmed") String gameStatus) {}
