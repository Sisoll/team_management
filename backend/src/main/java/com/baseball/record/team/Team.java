package com.baseball.record.team;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "teams")
public class Team {
    @Id @Column(name = "team_id") private UUID teamId = UUID.randomUUID();
    @Column(name = "team_name", nullable = false) private String teamName;
    @Column(name = "sport_type", nullable = false) private String sportType;
    @Column(name = "team_status", nullable = false) private String teamStatus = "active";
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected Team() {}
    public Team(String teamName, String sportType, UUID createdBy) {
        this.teamName = teamName; this.sportType = sportType; this.createdBy = createdBy;
    }
    public UUID getTeamId() { return teamId; }
    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }
    public String getSportType() { return sportType; }
    public String getTeamStatus() { return teamStatus; }
    public UUID getCreatedBy() { return createdBy; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
