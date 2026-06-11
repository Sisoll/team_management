package com.baseball.record.scoring.dto;

import jakarta.validation.constraints.Pattern;

public record RunnerMoveDto(
    @Pattern(regexp = "B|1|2|3") String from,
    @Pattern(regexp = "1|2|3|H|OUT") String to) {}
