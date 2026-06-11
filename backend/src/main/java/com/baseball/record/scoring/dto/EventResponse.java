package com.baseball.record.scoring.dto;

import com.baseball.record.scoring.EventPayload;

import java.util.List;
import java.util.UUID;

public record EventResponse(UUID eventId, int sequenceNo, int inning, String half, String eventType,
                            UUID actorPlayerId, List<UUID> relatedPlayers, EventPayload payload,
                            int scoreDelta, int outsAfter) {}
