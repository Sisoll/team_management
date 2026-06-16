package com.baseball.record.signup.dto;

import java.util.List;
import java.util.UUID;

public record SignupsResponse(UUID gameId, List<SignupDto> signups) {}
