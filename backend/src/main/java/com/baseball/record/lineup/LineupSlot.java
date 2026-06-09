package com.baseball.record.lineup;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "lineup_slot")
public class LineupSlot {
    @Id @Column(name = "slot_id") private UUID slotId = UUID.randomUUID();
    @Column(name = "game_roster_id", nullable = false) private UUID gameRosterId;
    @Column(name = "player_id") private UUID playerId;
    @Column(name = "guest_name") private String guestName;
    @Column(name = "batting_order") private Integer battingOrder;
    @Column(name = "field_position") private String fieldPosition;
    @Column(name = "lineup_status", nullable = false) private String lineupStatus = "starter";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected LineupSlot() {}
    public LineupSlot(UUID gameRosterId) { this.gameRosterId = gameRosterId; }
    public UUID getSlotId() { return slotId; }
    public UUID getGameRosterId() { return gameRosterId; }
    public UUID getPlayerId() { return playerId; } public void setPlayerId(UUID v) { playerId = v; }
    public String getGuestName() { return guestName; } public void setGuestName(String v) { guestName = v; }
    public Integer getBattingOrder() { return battingOrder; } public void setBattingOrder(Integer v) { battingOrder = v; }
    public String getFieldPosition() { return fieldPosition; } public void setFieldPosition(String v) { fieldPosition = v; }
    public String getLineupStatus() { return lineupStatus; } public void setLineupStatus(String v) { lineupStatus = v; }
}
