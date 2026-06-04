package com.baseball.record.security;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {
    private final JwtService jwt =
        new JwtService("unit-secret-unit-secret-unit-secret-32min", 60);

    @Test
    void issue_then_parse_returns_subject() {
        UUID uid = UUID.randomUUID();
        String token = jwt.issue(uid);
        assertThat(jwt.parseUserId(token)).isEqualTo(uid);
    }

    @Test
    void tampered_token_is_rejected() {
        String token = jwt.issue(UUID.randomUUID());
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class,
            () -> jwt.parseUserId(token + "x"));
    }
}
