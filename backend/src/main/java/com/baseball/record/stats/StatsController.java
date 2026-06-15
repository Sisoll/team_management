package com.baseball.record.stats;

import com.baseball.record.stats.dto.BoxScoreResponse;
import com.baseball.record.stats.dto.ErRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class StatsController {
    private final StatsService service;
    public StatsController(StatsService service) { this.service = service; }

    @GetMapping("/api/games/{gameId}/box-score")
    public BoxScoreResponse boxScore(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.boxScore(userId, gameId);
    }

    @PutMapping("/api/games/{gameId}/pitchers/{playerId}/er")
    public BoxScoreResponse setEr(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                  @PathVariable UUID playerId, @Valid @RequestBody ErRequest req) {
        return service.setEr(userId, gameId, playerId, req.er());
    }
}
