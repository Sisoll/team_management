package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.GameStateResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;

@RestController
public class StreamController {
    private final ScoringService scoring;
    private final GameStreamRegistry registry;
    public StreamController(ScoringService scoring, GameStreamRegistry registry) {
        this.scoring = scoring; this.registry = registry;
    }

    @GetMapping(value = "/api/games/{gameId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        GameStateResponse current = scoring.state(userId, gameId);   // 含 requireMember 驗權；非成員 → 404
        SseEmitter emitter = registry.subscribe(gameId);
        try { emitter.send(SseEmitter.event().name("state").data(current)); }
        catch (IOException e) { emitter.completeWithError(e); }
        return emitter;
    }
}
