package com.baseball.record.auth;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id @Column(name = "user_id") private UUID userId = UUID.randomUUID();
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(nullable = false, unique = true) private String email;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "account_status", nullable = false) private String accountStatus = "active";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected UserAccount() {}
    public UserAccount(String displayName, String email, String passwordHash) {
        this.displayName = displayName; this.email = email; this.passwordHash = passwordHash;
    }
    public UUID getUserId() { return userId; }
    public String getDisplayName() { return displayName; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
}
