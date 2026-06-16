package com.baseball.record.signup;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "game_signup")
public class GameSignup {
    @Id @Column(name = "signup_id") private UUID signupId = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "player_id") private UUID playerId;
    @Column(name = "guest_name") private String guestName;
    @Column(name = "status", nullable = false) private String status = "signed_up";
    @Column(name = "note") private String note;
    @Column(name = "sort_index", nullable = false) private int sortIndex = 0;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected GameSignup() {}
    public GameSignup(UUID gameId, UUID createdBy) { this.gameId = gameId; this.createdBy = createdBy; }

    public UUID getSignupId() { return signupId; }
    public UUID getGameId() { return gameId; }
    public UUID getPlayerId() { return playerId; } public void setPlayerId(UUID v) { playerId = v; }
    public String getGuestName() { return guestName; } public void setGuestName(String v) { guestName = v; }
    public String getStatus() { return status; } public void setStatus(String v) { status = v; }
    public String getNote() { return note; } public void setNote(String v) { note = v; }
    public int getSortIndex() { return sortIndex; } public void setSortIndex(int v) { sortIndex = v; }
    public UUID getCreatedBy() { return createdBy; }
}
