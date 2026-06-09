package com.baseball.record.game;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "games")
public class Game {
    @Id @Column(name = "game_id") private UUID gameId = UUID.randomUUID();
    @Column(name = "team_id", nullable = false) private UUID teamId;
    @Column(name = "sport_type", nullable = false) private String sportType;
    @Column(name = "match_mode", nullable = false) private String matchMode;
    @Column(name = "base_preset_id") private String basePresetId;
    @Column(name = "dh_enabled", nullable = false) private boolean dhEnabled;
    @Column(name = "ep_allowed", nullable = false) private boolean epAllowed;
    @Column(name = "roster_size", nullable = false) private int rosterSize;
    @Column(name = "re_entry_allowed", nullable = false) private boolean reEntryAllowed;
    @Column(name = "game_date", nullable = false) private LocalDate gameDate;
    @Column(name = "home_away", nullable = false) private String homeAway;
    @Column(name = "opponent_name") private String opponentName;
    @Column(name = "venue") private String venue;
    @Column(name = "weather") private String weather;
    @Column(name = "temperature_c") private Integer temperatureC;
    @Column(name = "game_status", nullable = false) private String gameStatus = "draft";
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected Game() {}
    public Game(UUID teamId, UUID createdBy) { this.teamId = teamId; this.createdBy = createdBy; }

    public UUID getGameId() { return gameId; }
    public UUID getTeamId() { return teamId; }
    public String getSportType() { return sportType; } public void setSportType(String v) { sportType = v; }
    public String getMatchMode() { return matchMode; } public void setMatchMode(String v) { matchMode = v; }
    public String getBasePresetId() { return basePresetId; } public void setBasePresetId(String v) { basePresetId = v; }
    public boolean isDhEnabled() { return dhEnabled; } public void setDhEnabled(boolean v) { dhEnabled = v; }
    public boolean isEpAllowed() { return epAllowed; } public void setEpAllowed(boolean v) { epAllowed = v; }
    public int getRosterSize() { return rosterSize; } public void setRosterSize(int v) { rosterSize = v; }
    public boolean isReEntryAllowed() { return reEntryAllowed; } public void setReEntryAllowed(boolean v) { reEntryAllowed = v; }
    public LocalDate getGameDate() { return gameDate; } public void setGameDate(LocalDate v) { gameDate = v; }
    public String getHomeAway() { return homeAway; } public void setHomeAway(String v) { homeAway = v; }
    public String getOpponentName() { return opponentName; } public void setOpponentName(String v) { opponentName = v; }
    public String getVenue() { return venue; } public void setVenue(String v) { venue = v; }
    public String getWeather() { return weather; } public void setWeather(String v) { weather = v; }
    public Integer getTemperatureC() { return temperatureC; } public void setTemperatureC(Integer v) { temperatureC = v; }
    public String getGameStatus() { return gameStatus; } public void setGameStatus(String v) { gameStatus = v; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}
