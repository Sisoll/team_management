package com.baseball.record.signup;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.signup.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class SignupService {
    private final GameRepository games;
    private final GameSignupRepository signups;
    private final TeamAccessPolicy policy;

    public SignupService(GameRepository games, GameSignupRepository signups, TeamAccessPolicy policy) {
        this.games = games; this.signups = signups; this.policy = policy;
    }

    @Transactional(readOnly = true)
    public SignupsResponse get(UUID userId, UUID gameId) {
        Game g = loadGame(gameId);
        policy.requireMember(userId, g.getTeamId());
        return toResponse(g);
    }

    @Transactional
    public SignupsResponse put(UUID userId, UUID gameId, PutSignupsRequest req) {
        Game g = loadGame(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);

        List<SignupDto> rows = req.signups() == null ? List.of() : req.signups();
        Set<UUID> seenPlayers = new HashSet<>();
        for (SignupDto s : rows) {
            boolean hasPlayer = s.playerId() != null;
            boolean hasGuest = s.guestName() != null && !s.guestName().isBlank();
            if (hasPlayer == hasGuest)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "each signup needs exactly one of playerId/guestName");
            if (hasPlayer && !seenPlayers.add(s.playerId()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "duplicate player signup");
        }

        signups.deleteByGameId(gameId);
        int idx = 0;
        for (SignupDto s : rows) {
            GameSignup gs = new GameSignup(gameId, userId);
            gs.setPlayerId(s.playerId());
            gs.setGuestName(s.playerId() != null ? null : s.guestName());
            gs.setStatus(s.status() == null ? "signed_up" : s.status());
            gs.setNote(s.note());
            gs.setSortIndex(s.sortIndex() != null ? s.sortIndex() : idx);
            signups.save(gs);
            idx++;
        }
        return toResponse(g);
    }

    SignupsResponse toResponse(Game g) {
        List<SignupDto> dtos = signups.findByGameIdOrderBySortIndexAsc(g.getGameId()).stream()
            .map(s -> new SignupDto(s.getPlayerId(), s.getGuestName(), s.getStatus(), s.getNote(), s.getSortIndex()))
            .toList();
        return new SignupsResponse(g.getGameId(), dtos);
    }

    Game loadGame(UUID gameId) {
        return games.findById(gameId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
