package com.baseball.record.shared.authorization;

import com.baseball.record.auth.UserAccount;
import com.baseball.record.auth.UserAccountRepository;
import com.baseball.record.support.IntegrationTest;
import com.baseball.record.team.Team;
import com.baseball.record.team.TeamMembership;
import com.baseball.record.team.TeamMembershipRepository;
import com.baseball.record.team.TeamRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TeamAccessPolicyIT extends IntegrationTest {
    @Autowired TeamRepository teams;
    @Autowired TeamMembershipRepository memberships;
    @Autowired TeamAccessPolicy policy;
    @Autowired UserAccountRepository users;

    private UUID newUser(String prefix) {
        return users.save(new UserAccount("U", prefix + UUID.randomUUID() + "@x.com", "hash")).getUserId();
    }

    @Test
    void owner_passes_member_and_role_checks() {
        UUID owner = newUser("owner_");
        Team t = teams.save(new Team("A", "baseball", owner));
        memberships.save(new TeamMembership(t.getTeamId(), owner, List.of("owner")));

        policy.requireMember(owner, t.getTeamId());           // no throw
        policy.requireRole(owner, t.getTeamId(), TeamRole.OWNER); // no throw
        assertThat(policy.myTeams(owner)).extracting(Team::getTeamId).contains(t.getTeamId());
    }

    @Test
    void non_member_gets_404() {
        UUID creator = newUser("creator_");
        Team t = teams.save(new Team("B", "baseball", creator));
        assertThatThrownBy(() -> policy.requireMember(UUID.randomUUID(), t.getTeamId()))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("404");
    }

    @Test
    void member_without_role_gets_403() {
        UUID owner = newUser("owner2_");
        UUID member = newUser("member_");
        Team t = teams.save(new Team("C", "baseball", owner));
        memberships.save(new TeamMembership(t.getTeamId(), member, List.of("member")));
        assertThatThrownBy(() -> policy.requireRole(member, t.getTeamId(), TeamRole.OWNER))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("403");
    }
}
