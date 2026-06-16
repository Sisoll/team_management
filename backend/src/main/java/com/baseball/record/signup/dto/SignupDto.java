package com.baseball.record.signup.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SignupDto(UUID playerId, @Size(max = 120) String guestName,
                        @Pattern(regexp = "signed_up|present|late|absent|no_show") String status,
                        @Size(max = 200) String note, Integer sortIndex) {}
