package com.baseball.record.auth.dto;

import java.util.UUID;

public record MeResponse(UUID userId, String displayName, String email) {}
