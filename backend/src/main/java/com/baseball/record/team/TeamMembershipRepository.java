package com.baseball.record.team;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamMembershipRepository extends JpaRepository<TeamMembership, UUID> {
    List<TeamMembership> findByUserId(UUID userId);
    Optional<TeamMembership> findByTeamIdAndUserId(UUID teamId, UUID userId);
}
