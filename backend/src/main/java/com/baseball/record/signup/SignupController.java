package com.baseball.record.signup;

import com.baseball.record.signup.dto.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class SignupController {
    private final SignupService service;
    public SignupController(SignupService service) { this.service = service; }

    @GetMapping("/api/games/{gameId}/signups")
    public SignupsResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.get(userId, gameId);
    }

    @PutMapping("/api/games/{gameId}/signups")
    public SignupsResponse put(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                              @Valid @RequestBody PutSignupsRequest req) {
        return service.put(userId, gameId, req);
    }
}
