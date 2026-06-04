package com.baseball.record.auth.dto;

import jakarta.validation.constraints.*;

public record RegisterRequest(@NotBlank String displayName, @Email @NotBlank String email,
                              @Size(min = 6) String password) {}
