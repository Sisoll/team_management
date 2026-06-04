package com.baseball.record.team;

import com.baseball.record.team.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams")
public class TeamController {
    private final TeamService service;
    public TeamController(TeamService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeamResponse create(@AuthenticationPrincipal UUID userId, @Valid @RequestBody CreateTeamRequest req) {
        return service.create(userId, req);
    }

    @GetMapping
    public List<TeamResponse> mine(@AuthenticationPrincipal UUID userId) { return service.myTeams(userId); }

    @GetMapping("/{teamId}")
    public TeamResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId) {
        return service.get(userId, teamId);
    }

    @PatchMapping("/{teamId}")
    public TeamResponse rename(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                              @Valid @RequestBody UpdateTeamRequest req) {
        return service.rename(userId, teamId, req);
    }
}
