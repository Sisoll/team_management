package com.baseball.record.player;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "players")
public class Player {
    @Id @Column(name = "player_id") private UUID playerId = UUID.randomUUID();
    @Column(name = "team_id", nullable = false) private UUID teamId;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(name = "uniform_number") private String uniformNumber;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "primary_positions", columnDefinition = "text[]", nullable = false)
    private List<String> primaryPositions = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "secondary_positions", columnDefinition = "text[]", nullable = false)
    private List<String> secondaryPositions = new ArrayList<>();

    @Column(name = "roster_status", nullable = false) private String rosterStatus = "active";
    @Column(name = "availability", nullable = false) private String availability = "available";
    @Column(name = "linked_user_id") private UUID linkedUserId;
    @Column(name = "linked_membership_id") private UUID linkedMembershipId;
    @Column(name = "account_link_status", nullable = false) private String accountLinkStatus = "unlinked";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected Player() {}
    public Player(UUID teamId, String displayName) { this.teamId = teamId; this.displayName = displayName; }

    public UUID getPlayerId() { return playerId; }
    public UUID getTeamId() { return teamId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public String getUniformNumber() { return uniformNumber; }
    public void setUniformNumber(String v) { this.uniformNumber = v; }
    public List<String> getPrimaryPositions() { return primaryPositions; }
    public void setPrimaryPositions(List<String> v) { this.primaryPositions = new ArrayList<>(v); }
    public List<String> getSecondaryPositions() { return secondaryPositions; }
    public void setSecondaryPositions(List<String> v) { this.secondaryPositions = new ArrayList<>(v); }
    public String getRosterStatus() { return rosterStatus; }
    public void setRosterStatus(String v) { this.rosterStatus = v; }
    public String getAvailability() { return availability; }
    public void setAvailability(String v) { this.availability = v; }
    public String getAccountLinkStatus() { return accountLinkStatus; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}
