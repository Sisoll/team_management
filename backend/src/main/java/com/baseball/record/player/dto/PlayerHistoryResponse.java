package com.baseball.record.player.dto;
import java.time.OffsetDateTime;
public record PlayerHistoryResponse(String field, String oldValue, String newValue, OffsetDateTime changedAt) {}
