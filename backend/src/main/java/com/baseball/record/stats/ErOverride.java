package com.baseball.record.stats;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "er_override")
public class ErOverride {
    @Id @Column(name = "id") private UUID id = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "pitcher_id", nullable = false) private UUID pitcherId;
    @Column(name = "er", nullable = false) private int er;

    protected ErOverride() {}
    public ErOverride(UUID gameId, UUID pitcherId, int er) { this.gameId = gameId; this.pitcherId = pitcherId; this.er = er; }

    public UUID getGameId() { return gameId; }
    public UUID getPitcherId() { return pitcherId; }
    public int getEr() { return er; }
    public void setEr(int er) { this.er = er; }
}
