package com.baseball.record.player.dto;
import java.util.List;
import java.util.UUID;
public record PlayerResponse(UUID playerId, UUID teamId, String displayName, String uniformNumber,
                             List<String> primaryPositions, List<String> secondaryPositions,
                             String rosterStatus, String availability, String accountLinkStatus) {}
