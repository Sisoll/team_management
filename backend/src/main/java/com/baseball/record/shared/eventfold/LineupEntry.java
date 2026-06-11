package com.baseball.record.shared.eventfold;

import java.util.UUID;

public record LineupEntry(int battingOrder, UUID playerId, String guestName, String fieldPosition,
                          boolean onField, boolean starter, boolean exited, boolean reEntered) {
    public LineupEntry withField(String pos)      { return new LineupEntry(battingOrder, playerId, guestName, pos, onField, starter, exited, reEntered); }
    public LineupEntry leave()                    { return new LineupEntry(battingOrder, playerId, guestName, fieldPosition, false, starter, true, reEntered); }
    public LineupEntry enter(UUID pid, String gn, String pos) { return new LineupEntry(battingOrder, pid, gn, pos, true, starter, false, reEntered); }
    public LineupEntry reenter()                  { return new LineupEntry(battingOrder, playerId, guestName, fieldPosition, true, starter, false, true); }
}
