package com.baseball.record.scoring;

import com.baseball.record.shared.eventfold.BaseState;
import com.baseball.record.shared.eventfold.GameState;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "game_event")
public class GameEvent {
    @Id @Column(name = "event_id") private UUID eventId = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "inning", nullable = false) private int inning;
    @Column(name = "half", nullable = false) private String half;
    @Column(name = "sequence_no", nullable = false) private int sequenceNo;
    @Column(name = "event_type", nullable = false) private String eventType;
    @Column(name = "actor_player_id") private UUID actorPlayerId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "related_players", columnDefinition = "uuid[]", nullable = false)
    private List<UUID> relatedPlayers = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb", nullable = false)
    private EventPayload payload = new EventPayload(List.of(), null, null, null, null, null, null, null, null);

    @Column(name = "score_delta", nullable = false) private int scoreDelta;
    @Column(name = "outs_after", nullable = false) private int outsAfter;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "bases_after", columnDefinition = "jsonb", nullable = false)
    private BaseState basesAfter = BaseState.empty();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot_after", columnDefinition = "jsonb", nullable = false)
    private GameState snapshotAfter;

    @Column(name = "capture_source", nullable = false) private String captureSource = "manual";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected GameEvent() {}
    public GameEvent(UUID gameId, int sequenceNo, String eventType) {
        this.gameId = gameId; this.sequenceNo = sequenceNo; this.eventType = eventType;
    }

    public UUID getEventId() { return eventId; }
    public UUID getGameId() { return gameId; }
    public int getInning() { return inning; } public void setInning(int v) { inning = v; }
    public String getHalf() { return half; } public void setHalf(String v) { half = v; }
    public int getSequenceNo() { return sequenceNo; } public void setSequenceNo(int v) { sequenceNo = v; }
    public String getEventType() { return eventType; } public void setEventType(String v) { eventType = v; }
    public UUID getActorPlayerId() { return actorPlayerId; } public void setActorPlayerId(UUID v) { actorPlayerId = v; }
    public List<UUID> getRelatedPlayers() { return relatedPlayers; } public void setRelatedPlayers(List<UUID> v) { relatedPlayers = new ArrayList<>(v); }
    public EventPayload getPayload() { return payload; } public void setPayload(EventPayload v) { payload = v; }
    public int getScoreDelta() { return scoreDelta; } public void setScoreDelta(int v) { scoreDelta = v; }
    public int getOutsAfter() { return outsAfter; } public void setOutsAfter(int v) { outsAfter = v; }
    public BaseState getBasesAfter() { return basesAfter; } public void setBasesAfter(BaseState v) { basesAfter = v; }
    public GameState getSnapshotAfter() { return snapshotAfter; } public void setSnapshotAfter(GameState v) { snapshotAfter = v; }
    public String getCaptureSource() { return captureSource; } public void setCaptureSource(String v) { captureSource = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
