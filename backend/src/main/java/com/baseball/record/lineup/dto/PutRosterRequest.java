package com.baseball.record.lineup.dto;

import jakarta.validation.Valid;
import java.util.List;

public record PutRosterRequest(@Valid List<LineupSlotDto> slots) {}
