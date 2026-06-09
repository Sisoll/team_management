package com.baseball.record.lineup.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record LineupSlotDto(UUID playerId, @Size(max = 120) String guestName,
                            @Min(1) Integer battingOrder, @Size(max = 10) String fieldPosition,
                            @Pattern(regexp = "starter|bench") String lineupStatus) {}
