package com.baseball.record.team.dto;
import jakarta.validation.constraints.*;
public record CreateTeamRequest(@NotBlank @Size(max = 120) String teamName,
                                @NotBlank @Pattern(regexp = "baseball|softball_fast|softball_slow|teeball") String sportType) {}
