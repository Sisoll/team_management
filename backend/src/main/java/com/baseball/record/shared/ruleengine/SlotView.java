package com.baseball.record.shared.ruleengine;

import java.util.UUID;

/** eligible：註冊球員是否可出賽（屬隊且非 archived/unavailable）；路人恆 true。 */
public record SlotView(UUID playerId, String guestName, Integer battingOrder,
                       String fieldPosition, String lineupStatus, boolean eligible) {
    public boolean isStarter() { return "starter".equals(lineupStatus); }
}
