package com.baseball.record.team;

import com.baseball.record.auth.UserAccount;
import com.baseball.record.auth.UserAccountRepository;
import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TeamMembershipRepositoryIT extends IntegrationTest {
    @Autowired TeamRepository teams;
    @Autowired TeamMembershipRepository memberships;
    @Autowired UserAccountRepository users;

    @Test
    void save_team_with_owner_membership_and_query_by_user() {
        UserAccount user = users.save(new UserAccount("Test", "tmrit_" + UUID.randomUUID() + "@x.com", "hash"));
        UUID userId = user.getUserId();
        Team t = teams.save(new Team("Tigers", "baseball", userId));
        memberships.save(new TeamMembership(t.getTeamId(), userId, List.of("owner")));

        var mine = memberships.findByUserId(userId);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).getRoles()).containsExactly("owner");
        assertThat(memberships.findByTeamIdAndUserId(t.getTeamId(), userId)).isPresent();
    }
}
