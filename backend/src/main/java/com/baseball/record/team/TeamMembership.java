package com.baseball.record.team;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "team_memberships")
public class TeamMembership {
    @Id @Column(name = "membership_id") private UUID membershipId = UUID.randomUUID();
    @Column(name = "team_id", nullable = false) private UUID teamId;
    @Column(name = "user_id", nullable = false) private UUID userId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "roles", columnDefinition = "text[]", nullable = false)
    private List<String> roles = new ArrayList<>();

    @Column(name = "membership_status", nullable = false) private String membershipStatus = "active";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected TeamMembership() {}
    public TeamMembership(UUID teamId, UUID userId, List<String> roles) {
        this.teamId = teamId; this.userId = userId; this.roles = new ArrayList<>(roles);
    }
    public UUID getMembershipId() { return membershipId; }
    public UUID getTeamId() { return teamId; }
    public UUID getUserId() { return userId; }
    public List<String> getRoles() { return roles; }
}
