package com.baseball.record.stats.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ErRequest(@NotNull @PositiveOrZero Integer er) {}
