package com.baseball.record.lineup;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.lineup.dto.*;
import com.baseball.record.lineup.dto.ValidationResultResponse.ViolationDto;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.ruleengine.PositionRules;
import com.baseball.record.shared.ruleengine.ValidationResult;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class LineupService {
    private final GameRepository games;
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final TeamAccessPolicy policy;
    private final RosterValidationService validation;

    public LineupService(GameRepository games, GameRosterRepository rosters, LineupSlotRepository slots,
                         TeamAccessPolicy policy, RosterValidationService validation) {
        this.games = games; this.rosters = rosters; this.slots = slots;
        this.policy = policy; this.validation = validation;
    }

    @Transactional(readOnly = true)
    public RosterResponse get(UUID userId, UUID gameId) {
        Game g = loadGame(gameId);
        policy.requireMember(userId, g.getTeamId());
        return toResponse(g);
    }

    @Transactional
    public RosterResponse put(UUID userId, UUID gameId, PutRosterRequest req) {
        Game g = loadGame(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        if ("lineup_confirmed".equals(g.getGameStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "lineup already confirmed; revert to scheduled first");

        List<String> validPos = PositionRules.validPositions(g.getSportType());
        if (req.slots() != null) for (LineupSlotDto s : req.slots()) {
            boolean hasPlayer = s.playerId() != null;
            boolean hasGuest = s.guestName() != null && !s.guestName().isBlank();
            if (hasPlayer == hasGuest)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "each slot needs exactly one of playerId/guestName");
            if (s.fieldPosition() != null && !validPos.contains(s.fieldPosition()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid fieldPosition: " + s.fieldPosition());
        }

        GameRoster roster = rosters.findByGameId(gameId).orElseGet(() -> rosters.save(new GameRoster(gameId)));
        slots.deleteByGameRosterId(roster.getGameRosterId());
        if (req.slots() != null) for (LineupSlotDto s : req.slots()) {
            LineupSlot ls = new LineupSlot(roster.getGameRosterId());
            ls.setPlayerId(s.playerId());
            ls.setGuestName(s.guestName());
            ls.setBattingOrder(s.battingOrder());
            ls.setFieldPosition(s.fieldPosition());
            ls.setLineupStatus(s.lineupStatus() == null ? "starter" : s.lineupStatus());
            slots.save(ls);
        }
        roster.touch();
        return toResponse(g);
    }

    @Transactional(readOnly = true)
    public ValidationResultResponse validate(UUID userId, UUID gameId) {
        Game g = loadGame(gameId);
        policy.requireMember(userId, g.getTeamId());
        ValidationResult r = validation.validate(g);
        return new ValidationResultResponse(r.valid(),
            r.violations().stream().map(v -> new ViolationDto(v.code(), v.message())).toList());
    }

    RosterResponse toResponse(Game g) {
        GameRoster roster = rosters.findByGameId(g.getGameId()).orElse(null);
        List<LineupSlotDto> slotDtos = roster == null ? List.of()
            : slots.findByGameRosterId(roster.getGameRosterId()).stream()
                .map(s -> new LineupSlotDto(s.getPlayerId(), s.getGuestName(), s.getBattingOrder(),
                    s.getFieldPosition(), s.getLineupStatus())).toList();
        boolean confirmed = roster != null && roster.getConfirmedAt() != null;
        return new RosterResponse(g.getGameId(), confirmed, slotDtos);
    }

    Game loadGame(UUID gameId) {
        return games.findById(gameId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
