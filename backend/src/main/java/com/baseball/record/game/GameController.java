package com.baseball.record.game;

import com.baseball.record.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class GameController {
    private final GameService service;
    public GameController(GameService service) { this.service = service; }

    @PostMapping("/api/teams/{teamId}/games")
    @ResponseStatus(HttpStatus.CREATED)
    public GameResponse create(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                               @Valid @RequestBody CreateGameRequest req) {
        return service.create(userId, teamId, req);
    }

    @GetMapping("/api/teams/{teamId}/games")
    public List<GameResponse> list(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                   @RequestParam(required = false) String status) {
        return service.list(userId, teamId, status);
    }

    @GetMapping("/api/games/{gameId}")
    public GameResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.get(userId, gameId);
    }

    @PatchMapping("/api/games/{gameId}")
    public GameResponse update(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                               @Valid @RequestBody UpdateGameRequest req) {
        return service.update(userId, gameId, req);
    }

    @GetMapping("/api/teams/{teamId}/opponents")
    public List<OpponentSuggestion> opponents(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                              @RequestParam(required = false) String q) {
        return service.suggestOpponents(userId, teamId, q);
    }
}
