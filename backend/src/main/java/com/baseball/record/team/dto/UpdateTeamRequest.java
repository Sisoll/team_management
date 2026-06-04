package com.baseball.record.team.dto;
import jakarta.validation.constraints.*;
public record UpdateTeamRequest(@NotBlank @Size(max = 120) String teamName) {}
