package com.baseball.record.shared.authorization;

import com.baseball.record.team.Team;
import com.baseball.record.team.TeamMembership;
import com.baseball.record.team.TeamMembershipRepository;
import com.baseball.record.team.TeamRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Component
public class TeamAccessPolicy {
    private final TeamMembershipRepository memberships;
    private final TeamRepository teams;

    public TeamAccessPolicy(TeamMembershipRepository memberships, TeamRepository teams) {
        this.memberships = memberships; this.teams = teams;
    }

    public TeamMembership requireMember(UUID userId, UUID teamId) {
        return memberships.findByTeamIdAndUserId(teamId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "team not found"));
    }

    public void requireRole(UUID userId, UUID teamId, TeamRole role) {
        TeamMembership m = requireMember(userId, teamId);
        if (!m.getRoles().contains(role.code()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "requires role " + role.code());
    }

    public List<Team> myTeams(UUID userId) {
        List<UUID> teamIds = memberships.findByUserId(userId).stream().map(TeamMembership::getTeamId).toList();
        return teams.findAllById(teamIds);
    }
}
