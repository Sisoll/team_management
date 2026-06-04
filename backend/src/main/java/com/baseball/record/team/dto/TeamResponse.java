package com.baseball.record.team.dto;
import java.util.List;
import java.util.UUID;
public record TeamResponse(UUID teamId, String teamName, String sportType, String teamStatus, List<String> myRoles) {}
