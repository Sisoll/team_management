package com.baseball.record.stats;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.lineup.GameRoster;
import com.baseball.record.lineup.GameRosterRepository;
import com.baseball.record.lineup.LineupSlot;
import com.baseball.record.lineup.LineupSlotRepository;
import com.baseball.record.player.Player;
import com.baseball.record.player.PlayerRepository;
import com.baseball.record.scoring.GameEvent;
import com.baseball.record.scoring.GameEventRepository;
import com.baseball.record.scoring.EventPayload;
import com.baseball.record.stats.dto.BoxScoreResponse;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.eventfold.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class StatsService {
    private final GameRepository games;
    private final GameEventRepository events;
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final PlayerRepository players;
    private final ErOverrideRepository erOverrides;
    private final TeamAccessPolicy policy;

    public StatsService(GameRepository games, GameEventRepository events, GameRosterRepository rosters,
                        LineupSlotRepository slots, PlayerRepository players,
                        ErOverrideRepository erOverrides, TeamAccessPolicy policy) {
        this.games = games; this.events = events; this.rosters = rosters; this.slots = slots;
        this.players = players; this.erOverrides = erOverrides; this.policy = policy;
    }

    @Transactional(readOnly = true)
    public BoxScoreResponse boxScore(UUID userId, UUID gameId) {
        Game g = requireMember(userId, gameId);
        List<EventView> views = events.findByGameIdOrderBySequenceNoAsc(gameId).stream().map(StatsService::toView).toList();
        BoxScore box = StatsEngine.fold(initialLineup(g), views);
        return toResponse(gameId, box);
    }

    @Transactional
    public BoxScoreResponse setEr(UUID userId, UUID gameId, UUID pitcherId, int er) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        ErOverride o = erOverrides.findByGameIdAndPitcherId(gameId, pitcherId)
            .orElseGet(() -> new ErOverride(gameId, pitcherId, er));
        o.setEr(er);
        erOverrides.save(o);
        return boxScore(userId, gameId);
    }

    private BoxScoreResponse toResponse(UUID gameId, BoxScore box) {
        Map<UUID, String> names = new HashMap<>();
        Set<UUID> ids = new HashSet<>();
        box.batting().forEach(b -> ids.add(b.playerId()));
        box.pitching().forEach(p -> ids.add(p.playerId()));
        players.findAllById(ids).forEach(p -> names.put(p.getPlayerId(), p.getDisplayName()));
        Map<UUID, Integer> erMap = new HashMap<>();
        erOverrides.findByGameId(gameId).forEach(o -> erMap.put(o.getPitcherId(), o.getEr()));

        List<BoxScoreResponse.LineRow> line = box.lineScore().stream()
            .map(r -> new BoxScoreResponse.LineRow(r[0], r[1], r[2])).toList();
        List<BoxScoreResponse.BatRow> batting = box.batting().stream()
            .map(b -> new BoxScoreResponse.BatRow(b.playerId().toString(), b.order(),
                names.getOrDefault(b.playerId(), "球員"), b.position(),
                b.pa(), b.ab(), b.r(), b.h(), b.doubles(), b.triples(), b.hr(),
                b.rbi(), b.bb(), b.k(), b.sb(), avg(b.h(), b.ab()))).toList();
        List<BoxScoreResponse.PitchRow> pitching = box.pitching().stream()
            .map(p -> {
                boolean overridden = erMap.containsKey(p.playerId());
                int er = overridden ? erMap.get(p.playerId()) : p.r();
                return new BoxScoreResponse.PitchRow(p.playerId().toString(),
                    names.getOrDefault(p.playerId(), "球員"), ip(p.outs()),
                    p.h(), p.r(), er, overridden, p.bb(), p.k(), p.pitches());
            }).toList();
        return new BoxScoreResponse(line,
            new BoxScoreResponse.Totals(box.team().runs(), box.team().hits()),
            new BoxScoreResponse.Totals(box.opponent().runs(), box.opponent().hits()),
            batting, pitching);
    }

    private static String ip(int outs) { return (outs / 3) + "." + (outs % 3); }
    private static String avg(int h, int ab) {
        if (ab == 0) return ".000";
        String s = String.format("%.3f", (double) h / ab);
        return s.startsWith("0") ? s.substring(1) : s;     // 0.333 → .333；1.000 維持
    }

    // ── 與 ScoringService 等價的小工具（刻意複製，避免動 M3a） ──
    private InitialStateBuilder.InitialLineup initialLineup(Game g) {
        GameRoster roster = rosters.findByGameId(g.getGameId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "roster not confirmed"));
        List<LineupSlot> rows = slots.findByGameRosterId(roster.getGameRosterId());
        List<LineupEntry> lineup = new ArrayList<>();
        UUID startingPitcher = null;
        for (LineupSlot s : rows) {
            if (!"starter".equals(s.getLineupStatus())) continue;
            int order = s.getBattingOrder() == null ? 0 : s.getBattingOrder();
            lineup.add(new LineupEntry(order, s.getPlayerId(), s.getGuestName(), s.getFieldPosition(),
                true, true, false, false));
            if ("P".equals(s.getFieldPosition())) startingPitcher = s.getPlayerId();
        }
        lineup.sort(Comparator.comparingInt(LineupEntry::battingOrder));
        return new InitialStateBuilder.InitialLineup(g.getHomeAway(), lineup, startingPitcher);
    }
    private static EventView toView(GameEvent e) {
        EventPayload p = e.getPayload();
        return new EventView(e.getSequenceNo(), e.getEventType(), e.getActorPlayerId(), e.getRelatedPlayers(),
            p.runnerMoves(), p.pitches(), null, p.fieldPosition(), p.guestBatterName(),
            p.subInPlayerId(), p.subInGuestName(), p.subOutPlayerId(), p.subBattingOrder(), p.subFieldPosition());
    }

    private Game requireMember(UUID userId, UUID gameId) {
        Game g = load(gameId);
        policy.requireMember(userId, g.getTeamId());
        return g;
    }
    private Game load(UUID gameId) {
        return games.findById(gameId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
