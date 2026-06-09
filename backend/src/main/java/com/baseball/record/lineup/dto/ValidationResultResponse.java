package com.baseball.record.lineup.dto;

import java.util.List;

public record ValidationResultResponse(boolean valid, List<ViolationDto> violations) {
    public record ViolationDto(String code, String message) {}
}
