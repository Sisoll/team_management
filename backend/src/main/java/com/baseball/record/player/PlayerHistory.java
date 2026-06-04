package com.baseball.record.player;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "player_history")
public class PlayerHistory {
    @Id @Column(name = "history_id") private UUID historyId = UUID.randomUUID();
    @Column(name = "player_id", nullable = false) private UUID playerId;
    @Column(name = "field", nullable = false) private String field;
    @Column(name = "old_value") private String oldValue;
    @Column(name = "new_value") private String newValue;
    @Column(name = "changed_by", nullable = false) private UUID changedBy;
    @Column(name = "changed_at", nullable = false) private OffsetDateTime changedAt = OffsetDateTime.now();

    protected PlayerHistory() {}
    public PlayerHistory(UUID playerId, String field, String oldValue, String newValue, UUID changedBy) {
        this.playerId = playerId; this.field = field; this.oldValue = oldValue;
        this.newValue = newValue; this.changedBy = changedBy;
    }
    public UUID getPlayerId() { return playerId; }
    public String getField() { return field; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public OffsetDateTime getChangedAt() { return changedAt; }
}
