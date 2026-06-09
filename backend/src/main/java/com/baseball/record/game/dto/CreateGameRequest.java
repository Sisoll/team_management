package com.baseball.record.game.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record CreateGameRequest(
    @NotNull @Pattern(regexp = "baseball|softball_fast|softball_slow|teeball") String sportType,
    @NotNull @Pattern(regexp = "formal|friendly|intra_squad") String matchMode,
    String basePresetId,
    @NotNull Boolean dhEnabled,
    @NotNull Boolean epAllowed,
    @NotNull @Min(1) Integer rosterSize,
    @NotNull Boolean reEntryAllowed,
    @NotNull LocalDate gameDate,
    @NotNull @Pattern(regexp = "home|away") String homeAway,
    @Size(max = 120) String opponentName,
    @Size(max = 120) String venue,
    @Size(max = 40) String weather,
    @Min(-50) @Max(60) Integer temperatureC) {}
