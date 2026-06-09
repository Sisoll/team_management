package com.baseball.record.lineup.dto;

import java.util.List;
import java.util.UUID;

public record RosterResponse(UUID gameId, boolean confirmed, List<LineupSlotDto> slots) {}
