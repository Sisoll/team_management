package com.baseball.record.player;

import com.baseball.record.player.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams/{teamId}/players")
public class PlayerController {
    private final PlayerService service;
    public PlayerController(PlayerService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlayerResponse create(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                 @Valid @RequestBody CreatePlayerRequest req) {
        return service.create(userId, teamId, req);
    }

    @GetMapping
    public List<PlayerResponse> list(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                     @RequestParam(required = false) String rosterStatus,
                                     @RequestParam(required = false) String position,
                                     @RequestParam(defaultValue = "false") boolean includeArchived) {
        return service.list(userId, teamId, rosterStatus, position, includeArchived);
    }

    @GetMapping("/{playerId}")
    public PlayerResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                              @PathVariable UUID playerId) {
        return service.get(userId, teamId, playerId);
    }

    @PatchMapping("/{playerId}")
    public PlayerResponse update(@AuthenticationPrincipal UUID userId,
                                 @PathVariable UUID teamId, @PathVariable UUID playerId,
                                 @Valid @RequestBody UpdatePlayerRequest req) {
        return service.update(userId, teamId, playerId, req);
    }

    @DeleteMapping("/{playerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UUID userId,
                       @PathVariable UUID teamId, @PathVariable UUID playerId) {
        service.softDelete(userId, teamId, playerId);
    }

    @GetMapping("/{playerId}/history")
    public List<PlayerHistoryResponse> history(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID teamId, @PathVariable UUID playerId) {
        return service.history(userId, teamId, playerId);
    }
}
