package com.baseball.record.team;

import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.team.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TeamService {
    private final TeamRepository teams;
    private final TeamMembershipRepository memberships;
    private final TeamAccessPolicy policy;

    public TeamService(TeamRepository teams, TeamMembershipRepository memberships, TeamAccessPolicy policy) {
        this.teams = teams; this.memberships = memberships; this.policy = policy;
    }

    @Transactional
    public TeamResponse create(UUID userId, CreateTeamRequest req) {
        Team t = teams.save(new Team(req.teamName(), req.sportType(), userId));
        memberships.save(new TeamMembership(t.getTeamId(), userId, List.of(TeamRole.OWNER.code())));
        return toResponse(t, List.of(TeamRole.OWNER.code()));
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> myTeams(UUID userId) {
        return policy.myTeams(userId).stream()
            .map(t -> toResponse(t, rolesOf(userId, t.getTeamId()))).toList();
    }

    @Transactional(readOnly = true)
    public TeamResponse get(UUID userId, UUID teamId) {
        var m = policy.requireMember(userId, teamId);
        return toResponse(teams.findById(teamId).orElseThrow(), m.getRoles());
    }

    @Transactional
    public TeamResponse rename(UUID userId, UUID teamId, UpdateTeamRequest req) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        Team t = teams.findById(teamId).orElseThrow();
        t.setTeamName(req.teamName());
        return toResponse(t, rolesOf(userId, teamId));
    }

    private List<String> rolesOf(UUID userId, UUID teamId) {
        return memberships.findByTeamIdAndUserId(teamId, userId).map(TeamMembership::getRoles).orElse(List.of());
    }
    private TeamResponse toResponse(Team t, List<String> roles) {
        return new TeamResponse(t.getTeamId(), t.getTeamName(), t.getSportType(), t.getTeamStatus(), roles);
    }
}
