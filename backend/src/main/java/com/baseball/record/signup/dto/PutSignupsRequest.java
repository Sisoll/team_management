package com.baseball.record.signup.dto;

import jakarta.validation.Valid;
import java.util.List;

public record PutSignupsRequest(@Valid List<SignupDto> signups) {}
