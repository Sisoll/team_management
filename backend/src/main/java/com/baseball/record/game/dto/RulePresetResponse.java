package com.baseball.record.game.dto;
public record RulePresetResponse(String presetId, String label, String sportType, String matchMode,
                                 boolean dhAllowed, boolean epAllowed, int defaultRosterSize,
                                 boolean reEntryAllowed, boolean rosterFlex) {}
