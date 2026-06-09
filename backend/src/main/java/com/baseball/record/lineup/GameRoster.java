package com.baseball.record.lineup;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "game_roster")
public class GameRoster {
    @Id @Column(name = "game_roster_id") private UUID gameRosterId = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "confirmed_at") private OffsetDateTime confirmedAt;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected GameRoster() {}
    public GameRoster(UUID gameId) { this.gameId = gameId; }
    public UUID getGameRosterId() { return gameRosterId; }
    public UUID getGameId() { return gameId; }
    public OffsetDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(OffsetDateTime v) { confirmedAt = v; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}
