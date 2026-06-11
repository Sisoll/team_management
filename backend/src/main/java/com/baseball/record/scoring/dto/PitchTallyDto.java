package com.baseball.record.scoring.dto;

import jakarta.validation.constraints.Min;

public record PitchTallyDto(@Min(0) int pitches, @Min(0) int strikes, @Min(0) int balls,
                            @Min(0) int swinging, @Min(0) int looking) {}
