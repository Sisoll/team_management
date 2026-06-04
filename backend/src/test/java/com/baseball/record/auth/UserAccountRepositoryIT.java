package com.baseball.record.auth;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class UserAccountRepositoryIT extends IntegrationTest {
    @Autowired UserAccountRepository repo;

    @Test
    void save_and_find_by_email() {
        UserAccount u = new UserAccount("Amy", "amy@example.com", "hash");
        repo.save(u);
        assertThat(repo.findByEmail("amy@example.com")).isPresent();
        assertThat(repo.existsByEmail("amy@example.com")).isTrue();
    }
}
