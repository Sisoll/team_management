package com.baseball.record.scoring;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.lineup.GameRoster;
import com.baseball.record.lineup.GameRosterRepository;
import com.baseball.record.lineup.LineupSlot;
import com.baseball.record.lineup.LineupSlotRepository;
import com.baseball.record.scoring.dto.*;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.eventfold.*;
import com.baseball.record.shared.ruleengine.SubstitutionAction;
import com.baseball.record.shared.ruleengine.SubstitutionValidator;
import com.baseball.record.shared.ruleengine.ValidationResult;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class ScoringService {
    private final GameRepository games;
    private final GameEventRepository events;
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final TeamAccessPolicy policy;
    private final org.springframework.context.ApplicationEventPublisher publisher;

    public ScoringService(GameRepository games, GameEventRepository events, GameRosterRepository rosters,
                          LineupSlotRepository slots, TeamAccessPolicy policy,
                          org.springframework.context.ApplicationEventPublisher publisher) {
        this.games = games; this.events = events; this.rosters = rosters; this.slots = slots; this.policy = policy;
        this.publisher = publisher;
    }

    @Transactional
    public EventResponse record(UUID userId, UUID gameId, RecordEventRequest req) {
        Game g = requireOwnerLiveGame(userId, gameId);
        List<GameEvent> existing = events.findByGameIdOrderBySequenceNoAsc(gameId);
        GameState state = fold(g, existing);

        if (EventApplier.isSubstitution(req.eventType()))
            validateSubstitution(g, state, req);

        int seq = existing.isEmpty() ? 1 : existing.get(existing.size() - 1).getSequenceNo() + 1;
        GameEvent ev = buildEntity(gameId, seq, req);
        GameState before = state;
        GameState after = EventApplier.apply(before, toView(ev));
        stampDerived(ev, before, after);
        events.save(ev);
        publisher.publishEvent(new ScoreboardChanged(gameId, after));
        return toResponse(ev);
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(UUID userId, UUID gameId) {
        Game g = requireMember(userId, gameId);
        return events.findByGameIdOrderBySequenceNoAsc(gameId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public GameStateResponse state(UUID userId, UUID gameId) {
        Game g = requireMember(userId, gameId);
        return new GameStateResponse(fold(g, events.findByGameIdOrderBySequenceNoAsc(gameId)));
    }

    @Transactional
    public GameStateResponse update(UUID userId, UUID gameId, UUID eventId, RecordEventRequest req) {
        Game g = requireOwnerLiveGame(userId, gameId);
        GameEvent ev = events.findById(eventId)
            .filter(e -> e.getGameId().equals(gameId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "event not found"));
        applyRequest(ev, req);          // 改 type/payload/actor（保留 sequenceNo）
        recompute(g, gameId);
        GameState now = fold(g, events.findByGameIdOrderBySequenceNoAsc(gameId));
        publisher.publishEvent(new ScoreboardChanged(gameId, now));
        return new GameStateResponse(now);
    }

    @Transactional
    public GameStateResponse delete(UUID userId, UUID gameId, UUID eventId) {
        Game g = requireOwnerLiveGame(userId, gameId);
        events.findById(eventId).filter(e -> e.getGameId().equals(gameId)).ifPresent(events::delete);
        recompute(g, gameId);
        GameState now = fold(g, events.findByGameIdOrderBySequenceNoAsc(gameId));
        publisher.publishEvent(new ScoreboardChanged(gameId, now));
        return new GameStateResponse(now);
    }

    // ── 重算：refold 全部，逐筆覆寫 snapshot/derived ──
    private void recompute(Game g, UUID gameId) {
        List<GameEvent> all = events.findByGameIdOrderBySequenceNoAsc(gameId);
        GameState s = InitialStateBuilder.initial(initialLineup(g));
        for (GameEvent e : all) {
            GameState before = s;
            s = EventApplier.apply(before, toView(e));
            stampDerived(e, before, s);
        }
        events.saveAll(all);
    }

    private GameState fold(Game g, List<GameEvent> evs) {
        return GameStateFolder.fold(initialLineup(g), evs.stream().map(this::toView).toList());
    }

    private void stampDerived(GameEvent ev, GameState before, GameState after) {
        ev.setInning(before.inning()); ev.setHalf(before.half());
        ev.setScoreDelta((after.scoreUs() + after.scoreOpp()) - (before.scoreUs() + before.scoreOpp()));
        ev.setOutsAfter(after.outs());
        ev.setBasesAfter(after.bases());
        ev.setSnapshotAfter(after);
    }

    // ── 名單 → 初始狀態 ──
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

    private void validateSubstitution(Game g, GameState state, RecordEventRequest req) {
        Map<String, Integer> posCounts = new HashMap<>();
        for (LineupEntry e : state.lineup())
            if (e.onField() && e.fieldPosition() != null) posCounts.merge(e.fieldPosition(), 1, Integer::sum);
        LineupEntry outE = find(state, req.subOutPlayerId());
        LineupEntry inE = find(state, req.subInPlayerId());
        SubstitutionAction a = new SubstitutionAction(
            req.eventType(), req.subOutPlayerId(), outE != null && outE.onField(),
            req.subInPlayerId(), inE != null && inE.starter(), inE != null && inE.reEntered(),
            inE != null && inE.exited(), req.subFieldPosition(), g.isReEntryAllowed(), posCounts);
        ValidationResult r = SubstitutionValidator.validate(a);
        if (!r.valid()) throw new EventInvalidException(r.violations());
    }

    private LineupEntry find(GameState s, UUID pid) {
        if (pid == null) return null;
        return s.lineup().stream().filter(e -> pid.equals(e.playerId())).findFirst().orElse(null);
    }

    // ── entity ↔ view 對映 ──
    private GameEvent buildEntity(UUID gameId, int seq, RecordEventRequest req) {
        GameEvent ev = new GameEvent(gameId, seq, req.eventType());
        applyRequest(ev, req);
        return ev;
    }
    private void applyRequest(GameEvent ev, RecordEventRequest req) {
        ev.setEventType(req.eventType());
        ev.setActorPlayerId(req.actorPlayerId());
        ev.setRelatedPlayers(req.relatedPlayers() == null ? List.of() : req.relatedPlayers());
        List<RunnerMove> moves = req.runnerMoves() == null ? List.of()
            : req.runnerMoves().stream().map(m -> new RunnerMove(m.from(), m.to())).toList();
        PitchTally pitches = req.pitches() == null ? null
            : new PitchTally(req.pitches().pitches(), req.pitches().strikes(), req.pitches().balls(),
                             req.pitches().swinging(), req.pitches().looking());
        ev.setPayload(new EventPayload(moves, pitches, req.fieldPosition(), req.guestBatterName(),
            req.subInPlayerId(), req.subInGuestName(), req.subOutPlayerId(), req.subBattingOrder(), req.subFieldPosition()));
    }
    private EventView toView(GameEvent e) {
        EventPayload p = e.getPayload();
        return new EventView(e.getSequenceNo(), e.getEventType(), e.getActorPlayerId(), e.getRelatedPlayers(),
            p.runnerMoves(), p.pitches(), null, p.fieldPosition(), p.guestBatterName(),
            p.subInPlayerId(), p.subInGuestName(), p.subOutPlayerId(), p.subBattingOrder(), p.subFieldPosition());
    }
    private EventResponse toResponse(GameEvent e) {
        return new EventResponse(e.getEventId(), e.getSequenceNo(), e.getInning(), e.getHalf(), e.getEventType(),
            e.getActorPlayerId(), e.getRelatedPlayers(), e.getPayload(), e.getScoreDelta(), e.getOutsAfter());
    }

    // ── 授權 ──
    private Game requireOwnerLiveGame(UUID userId, UUID gameId) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        if (!"live".equals(g.getGameStatus()) && !"paused".equals(g.getGameStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "game not live");
        return g;
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
