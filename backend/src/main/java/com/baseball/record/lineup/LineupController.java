package com.baseball.record.lineup;

import com.baseball.record.lineup.dto.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class LineupController {
    private final LineupService service;
    public LineupController(LineupService service) { this.service = service; }

    @GetMapping("/api/games/{gameId}/roster")
    public RosterResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.get(userId, gameId);
    }

    @PutMapping("/api/games/{gameId}/roster")
    public RosterResponse put(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                              @Valid @RequestBody PutRosterRequest req) {
        return service.put(userId, gameId, req);
    }

    @PostMapping("/api/games/{gameId}/roster:validate")
    public ValidationResultResponse validate(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.validate(userId, gameId);
    }
}
