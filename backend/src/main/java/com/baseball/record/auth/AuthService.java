package com.baseball.record.auth;

import com.baseball.record.auth.dto.*;
import com.baseball.record.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class AuthService {
    private final UserAccountRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserAccountRepository repo, PasswordEncoder encoder, JwtService jwt) {
        this.repo = repo; this.encoder = encoder; this.jwt = jwt;
    }

    public AuthResponse register(RegisterRequest req) {
        if (repo.existsByEmail(req.email()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        UserAccount u = new UserAccount(req.displayName(), req.email(), encoder.encode(req.password()));
        repo.save(u);
        return new AuthResponse(jwt.issue(u.getUserId()));
    }

    public AuthResponse login(LoginRequest req) {
        UserAccount u = repo.findByEmail(req.email())
            .filter(x -> encoder.matches(req.password(), x.getPasswordHash()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials"));
        return new AuthResponse(jwt.issue(u.getUserId()));
    }

    public MeResponse me(UUID userId) {
        UserAccount u = repo.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unknown user"));
        return new MeResponse(u.getUserId(), u.getDisplayName(), u.getEmail());
    }
}
