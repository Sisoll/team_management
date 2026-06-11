package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class ScoringController {
    private final ScoringService service;
    public ScoringController(ScoringService service) { this.service = service; }

    @PostMapping("/api/games/{gameId}/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse record(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                @Valid @RequestBody RecordEventRequest req) {
        return service.record(userId, gameId, req);
    }

    @GetMapping("/api/games/{gameId}/events")
    public List<EventResponse> list(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.list(userId, gameId);
    }

    @GetMapping("/api/games/{gameId}/state")
    public GameStateResponse state(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.state(userId, gameId);
    }

    @PatchMapping("/api/games/{gameId}/events/{eventId}")
    public GameStateResponse update(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                    @PathVariable UUID eventId, @Valid @RequestBody RecordEventRequest req) {
        return service.update(userId, gameId, eventId, req);
    }

    @DeleteMapping("/api/games/{gameId}/events/{eventId}")
    public GameStateResponse delete(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                    @PathVariable UUID eventId) {
        return service.delete(userId, gameId, eventId);
    }
}
