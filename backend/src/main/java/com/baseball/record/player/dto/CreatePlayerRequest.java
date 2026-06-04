package com.baseball.record.player.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public record CreatePlayerRequest(
    @NotBlank @Size(max = 120) String displayName,
    @Size(max = 10) String uniformNumber,
    List<String> primaryPositions,
    List<String> secondaryPositions,
    @Pattern(regexp = "active|inactive|graduated|archived") String rosterStatus,
    @Pattern(regexp = "available|injured|unavailable") String availability) {}
