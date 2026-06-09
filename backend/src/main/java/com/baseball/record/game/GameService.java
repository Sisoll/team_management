package com.baseball.record.game;

import com.baseball.record.game.dto.*;
import com.baseball.record.lineup.GameRoster;
import com.baseball.record.lineup.GameRosterRepository;
import com.baseball.record.lineup.LineupInvalidException;
import com.baseball.record.lineup.RosterValidationService;
import com.baseball.record.lineup.dto.ValidationResultResponse.ViolationDto;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.ruleengine.ValidationResult;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class GameService {
    private final GameRepository games;
    private final TeamAccessPolicy policy;
    private final RosterValidationService validation;
    private final GameRosterRepository rosters;

    public GameService(GameRepository games, TeamAccessPolicy policy,
                       RosterValidationService validation, GameRosterRepository rosters) {
        this.games = games; this.policy = policy; this.validation = validation; this.rosters = rosters;
    }

    @Transactional
    public GameResponse create(UUID userId, UUID teamId, CreateGameRequest req) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        requireOpponentUnlessIntra(req.matchMode(), req.opponentName());
        Game g = new Game(teamId, userId);
        g.setSportType(req.sportType());
        g.setMatchMode(req.matchMode());
        g.setBasePresetId(req.basePresetId());
        g.setDhEnabled(req.dhEnabled());
        g.setEpAllowed(req.epAllowed());
        g.setRosterSize(req.rosterSize());
        g.setReEntryAllowed(req.reEntryAllowed());
        g.setGameDate(req.gameDate());
        g.setHomeAway(req.homeAway());
        g.setOpponentName(req.opponentName());
        g.setVenue(req.venue());
        g.setWeather(req.weather());
        g.setTemperatureC(req.temperatureC());
        g.setGameStatus("scheduled"); // AC-4：建立即進 scheduled
        return toResponse(games.save(g));
    }

    @Transactional(readOnly = true)
    public List<GameResponse> list(UUID userId, UUID teamId, String status) {
        policy.requireMember(userId, teamId);
        List<Game> rows = status == null
            ? games.findByTeamIdOrderByGameDateDesc(teamId)
            : games.findByTeamIdAndGameStatusOrderByGameDateDesc(teamId, status);
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public GameResponse get(UUID userId, UUID gameId) {
        Game g = load(gameId);
        policy.requireMember(userId, g.getTeamId());
        return toResponse(g);
    }

    @Transactional(readOnly = true)
    public List<OpponentSuggestion> suggestOpponents(UUID userId, UUID teamId, String q) {
        policy.requireMember(userId, teamId);
        if (q == null || q.isBlank()) return List.of();
        return games.suggestOpponents(teamId, q).stream().limit(10).map(OpponentSuggestion::new).toList();
    }

    @Transactional
    public GameResponse update(UUID userId, UUID gameId, UpdateGameRequest req) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        applyFields(g, req);
        if (req.gameStatus() != null) transition(g, req.gameStatus());
        g.touch();
        return toResponse(g);
    }

    protected void transition(Game g, String target) {
        if (target.equals(g.getGameStatus())) return;
        switch (g.getGameStatus() + "->" + target) {
            case "draft->scheduled", "scheduled->draft" -> g.setGameStatus(target);
            case "scheduled->lineup_confirmed" -> confirmLineup(g);
            case "lineup_confirmed->scheduled" -> {
                rosters.findByGameId(g.getGameId()).ifPresent(r -> { r.setConfirmedAt(null); r.touch(); });
                g.setGameStatus("scheduled");
            }
            default -> throw new ResponseStatusException(HttpStatus.CONFLICT,
                "illegal status transition " + g.getGameStatus() + " -> " + target);
        }
    }

    private void confirmLineup(Game g) {
        ValidationResult r = validation.validate(g);
        if (!r.valid())
            throw new LineupInvalidException(
                r.violations().stream().map(v -> new ViolationDto(v.code(), v.message())).toList());
        GameRoster roster = rosters.findByGameId(g.getGameId())
            .orElseGet(() -> rosters.save(new GameRoster(g.getGameId())));
        roster.setConfirmedAt(OffsetDateTime.now());
        roster.touch();
        g.setGameStatus("lineup_confirmed");
    }

    void applyFields(Game g, UpdateGameRequest req) {
        if (req.sportType() != null) g.setSportType(req.sportType());
        if (req.matchMode() != null) g.setMatchMode(req.matchMode());
        if (req.basePresetId() != null) g.setBasePresetId(req.basePresetId());
        if (req.dhEnabled() != null) g.setDhEnabled(req.dhEnabled());
        if (req.epAllowed() != null) g.setEpAllowed(req.epAllowed());
        if (req.rosterSize() != null) g.setRosterSize(req.rosterSize());
        if (req.reEntryAllowed() != null) g.setReEntryAllowed(req.reEntryAllowed());
        if (req.gameDate() != null) g.setGameDate(req.gameDate());
        if (req.homeAway() != null) g.setHomeAway(req.homeAway());
        if (req.opponentName() != null) g.setOpponentName(req.opponentName());
        if (req.venue() != null) g.setVenue(req.venue());
        if (req.weather() != null) g.setWeather(req.weather());
        if (req.temperatureC() != null) g.setTemperatureC(req.temperatureC());
        requireOpponentUnlessIntra(g.getMatchMode(), g.getOpponentName());
    }

    private static void requireOpponentUnlessIntra(String matchMode, String opponentName) {
        if (!"intra_squad".equals(matchMode) && (opponentName == null || opponentName.isBlank()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "opponentName required for " + matchMode);
    }

    Game load(UUID gameId) {
        return games.findById(gameId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }

    GameResponse toResponse(Game g) {
        return new GameResponse(g.getGameId(), g.getTeamId(), g.getSportType(), g.getMatchMode(),
            g.getBasePresetId(), g.isDhEnabled(), g.isEpAllowed(), g.getRosterSize(), g.isReEntryAllowed(),
            g.getGameDate(), g.getHomeAway(), g.getOpponentName(), g.getVenue(), g.getWeather(),
            g.getTemperatureC(), g.getGameStatus());
    }
}
