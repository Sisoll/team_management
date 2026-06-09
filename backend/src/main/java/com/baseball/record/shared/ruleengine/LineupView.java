package com.baseball.record.shared.ruleengine;

import java.util.List;

/** flex：matchMode != formal（friendly/intra_squad 放寬人數與守位齊全）。 */
public record LineupView(String sportType, boolean dhEnabled, boolean epAllowed,
                         int rosterSize, boolean flex, List<SlotView> slots) {}
