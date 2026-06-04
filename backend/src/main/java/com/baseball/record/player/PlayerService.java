package com.baseball.record.player;

import com.baseball.record.player.dto.*;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class PlayerService {
    private final PlayerRepository players;
    private final PlayerHistoryRepository history;
    private final TeamAccessPolicy policy;

    public PlayerService(PlayerRepository players, PlayerHistoryRepository history, TeamAccessPolicy policy) {
        this.players = players; this.history = history; this.policy = policy;
    }

    @Transactional
    public PlayerResponse create(UUID userId, UUID teamId, CreatePlayerRequest req) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        Player p = new Player(teamId, req.displayName());
        if (req.uniformNumber() != null) p.setUniformNumber(req.uniformNumber());
        if (req.primaryPositions() != null) p.setPrimaryPositions(req.primaryPositions());
        if (req.secondaryPositions() != null) p.setSecondaryPositions(req.secondaryPositions());
        if (req.rosterStatus() != null) p.setRosterStatus(req.rosterStatus());
        if (req.availability() != null) p.setAvailability(req.availability());
        return toResponse(players.save(p));
    }

    @Transactional(readOnly = true)
    public List<PlayerResponse> list(UUID userId, UUID teamId, String rosterStatus, String position, boolean includeArchived) {
        policy.requireMember(userId, teamId);
        return players.findByTeamId(teamId).stream()
            .filter(p -> includeArchived || !"archived".equals(p.getRosterStatus()))
            .filter(p -> rosterStatus == null || rosterStatus.equals(p.getRosterStatus()))
            .filter(p -> position == null
                || p.getPrimaryPositions().contains(position) || p.getSecondaryPositions().contains(position))
            .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PlayerResponse get(UUID userId, UUID teamId, UUID playerId) {
        policy.requireMember(userId, teamId);
        return toResponse(load(teamId, playerId));
    }

    @Transactional
    public PlayerResponse update(UUID userId, UUID teamId, UUID playerId, UpdatePlayerRequest req) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        Player p = load(teamId, playerId);

        if (req.displayName() != null) p.setDisplayName(req.displayName());
        if (req.availability() != null) p.setAvailability(req.availability());

        if (req.uniformNumber() != null && !req.uniformNumber().equals(nz(p.getUniformNumber()))) {
            track(playerId, userId, "uniform_number", nz(p.getUniformNumber()), req.uniformNumber());
            p.setUniformNumber(req.uniformNumber());
        }
        if (req.primaryPositions() != null && !norm(req.primaryPositions()).equals(norm(p.getPrimaryPositions()))) {
            track(playerId, userId, "primary_positions", norm(p.getPrimaryPositions()), norm(req.primaryPositions()));
            p.setPrimaryPositions(req.primaryPositions());
        }
        if (req.secondaryPositions() != null && !norm(req.secondaryPositions()).equals(norm(p.getSecondaryPositions()))) {
            track(playerId, userId, "secondary_positions", norm(p.getSecondaryPositions()), norm(req.secondaryPositions()));
            p.setSecondaryPositions(req.secondaryPositions());
        }
        if (req.rosterStatus() != null && !req.rosterStatus().equals(p.getRosterStatus())) {
            track(playerId, userId, "roster_status", p.getRosterStatus(), req.rosterStatus());
            p.setRosterStatus(req.rosterStatus());
        }
        p.touch();
        return toResponse(p);
    }

    @Transactional
    public void softDelete(UUID userId, UUID teamId, UUID playerId) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        Player p = load(teamId, playerId);
        if (!"archived".equals(p.getRosterStatus())) {
            track(playerId, userId, "roster_status", p.getRosterStatus(), "archived");
            p.setRosterStatus("archived");
            p.touch();
        }
    }

    @Transactional(readOnly = true)
    public List<PlayerHistoryResponse> history(UUID userId, UUID teamId, UUID playerId) {
        policy.requireMember(userId, teamId);
        load(teamId, playerId);
        return history.findByPlayerIdOrderByChangedAtDesc(playerId).stream()
            .map(h -> new PlayerHistoryResponse(
                h.getField(), h.getOldValue(), h.getNewValue(), h.getChangedAt())).toList();
    }

    Player load(UUID teamId, UUID playerId) {
        Player p = players.findById(playerId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "player not found"));
        if (!p.getTeamId().equals(teamId))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "player not found");
        return p;
    }

    PlayerResponse toResponse(Player p) {
        return new PlayerResponse(p.getPlayerId(), p.getTeamId(), p.getDisplayName(), p.getUniformNumber(),
            p.getPrimaryPositions(), p.getSecondaryPositions(), p.getRosterStatus(), p.getAvailability(),
            p.getAccountLinkStatus());
    }

    private void track(UUID playerId, UUID userId, String field, String oldV, String newV) {
        history.save(new PlayerHistory(playerId, field, oldV, newV, userId));
    }
    private static String nz(String s) { return s == null ? "" : s; }
    private static String norm(List<String> v) {
        return v == null ? "" : v.stream().sorted().reduce((a, b) -> a + "," + b).orElse("");
    }
}
