package com.baseball.record.lineup;

import com.baseball.record.game.Game;
import com.baseball.record.player.Player;
import com.baseball.record.player.PlayerRepository;
import com.baseball.record.shared.ruleengine.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RosterValidationService {
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final PlayerRepository players;

    public RosterValidationService(GameRosterRepository rosters, LineupSlotRepository slots, PlayerRepository players) {
        this.rosters = rosters; this.slots = slots; this.players = players;
    }

    @Transactional(readOnly = true)
    public ValidationResult validate(Game game) {
        List<SlotView> slotViews = buildSlotViews(game);
        boolean flex = !"formal".equals(game.getMatchMode());
        LineupView view = new LineupView(game.getSportType(), game.isDhEnabled(), game.isEpAllowed(),
            game.getRosterSize(), flex, slotViews);
        return LineupValidator.validate(view);
    }

    List<SlotView> buildSlotViews(Game game) {
        GameRoster roster = rosters.findByGameId(game.getGameId()).orElse(null);
        if (roster == null) return List.of();
        List<LineupSlot> rows = slots.findByGameRosterId(roster.getGameRosterId());
        List<UUID> playerIds = rows.stream().map(LineupSlot::getPlayerId).filter(id -> id != null).toList();
        Map<UUID, Player> byId = players.findAllById(playerIds).stream()
            .collect(Collectors.toMap(Player::getPlayerId, p -> p));
        return rows.stream().map(s -> new SlotView(
            s.getPlayerId(), s.getGuestName(), s.getBattingOrder(), s.getFieldPosition(),
            s.getLineupStatus(), eligible(s, byId, game.getTeamId()))).toList();
    }

    private boolean eligible(LineupSlot s, Map<UUID, Player> byId, UUID teamId) {
        if (s.getPlayerId() == null) return true; // 路人
        Player p = byId.get(s.getPlayerId());
        return p != null && teamId.equals(p.getTeamId())
            && !"archived".equals(p.getRosterStatus()) && !"unavailable".equals(p.getAvailability());
    }
}
