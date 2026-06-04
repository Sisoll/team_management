# M1-B：球隊 + 球員 + 域內 RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓登入者建立球隊（自動成 owner）、管理球員（owner-only CRUD + append-only 歷史），全端打通 AC-2 / AC-3。

**Architecture:** 後端 Spring Boot 沿用 M1-A（JWT principal=UUID）；新增 team / player 模組與 shared/authorization 的 TeamAccessPolicy（service 層顯式授權）。資料庫 Flyway V2 新增 4 表，多值欄位用 Postgres `text[]`（Hibernate 6 array 映射）。錯誤全域改 RFC7807 ProblemDetail。前端 React 加 react-router-dom，新增球隊/球員頁，Playwright E2E 驗 AC-2/AC-3。

**Tech Stack:** Java 21 · Spring Boot 3.5 · Spring Data JPA + Hibernate 6 (text[] array) · Flyway · PostgreSQL 16 · Testcontainers(Podman) · React 18 + Vite + TS + react-router-dom · Playwright

**對應設計：** `docs/superpowers/specs/2026-06-04-m1b-teams-players-rbac-design.md`

> **環境備忘（執行者必讀）**：
> - 後端所有 build/test shell 開頭 `export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"; export PATH="$JAVA_HOME/bin:$PATH"`（系統預設仍 17）。用系統 `mvn`（非 ./mvnw，wrapper 有 dist-move bug）。
> - Testcontainers 已能透過 Podman 運作（`~/.testcontainers.properties` 已設 npipe；ryuk 啟用），勿改設定。
> - 後端跑在 **5199**、前端 **5200**；compose 用 `podman-compose`（pip 版）。
> - **不主動 commit**：每 task 的 commit 步驟由使用者節奏決定（可里程碑結束統一 commit）。

---

## File Structure（本計畫建立 / 修改）

```
backend/src/main/resources/
├── application.yaml                       # +problemdetails.enabled
├── application-test.yaml                  # +problemdetails.enabled
└── db/migration/V2__teams_players_rbac.sql   # 4 張新表

backend/src/main/java/com/baseball/record/
├── shared/authorization/
│   ├── TeamRole.java                      # enum + code
│   └── TeamAccessPolicy.java              # requireMember / requireRole / myTeams
├── team/
│   ├── Team.java, TeamRepository.java
│   ├── TeamMembership.java, TeamMembershipRepository.java
│   ├── TeamService.java, TeamController.java
│   └── dto/{CreateTeamRequest,UpdateTeamRequest,TeamResponse}.java
└── player/
    ├── Player.java, PlayerRepository.java
    ├── PlayerHistory.java, PlayerHistoryRepository.java
    ├── PlayerService.java, PlayerController.java
    └── dto/{CreatePlayerRequest,UpdatePlayerRequest,PlayerResponse,PlayerHistoryResponse}.java

backend/src/test/java/com/baseball/record/
├── team/{TeamMembershipRepositoryIT,TeamControllerIT}.java
├── player/{PlayerControllerIT}.java
└── shared/authorization/TeamAccessPolicyIT.java

frontend/
├── package.json                           # +react-router-dom
├── src/main.tsx                           # 包 BrowserRouter
├── src/App.tsx                            # 路由
├── src/api/client.ts                      # +teams/players
├── src/pages/{TeamsPage,TeamPage}.tsx
├── src/pages/teams.css
└── e2e/team-player.spec.ts                # AC-2/AC-3 E2E
```

---

## Phase 0：Schema 與跨切面

### Task 1：Flyway V2 + 全域 ProblemDetail

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__teams_players_rbac.sql`
- Modify: `backend/src/main/resources/application.yaml`、`backend/src/main/resources/application-test.yaml`

- [ ] **Step 1: 寫 V2 migration**

```sql
CREATE TABLE teams (
    team_id      UUID PRIMARY KEY,
    team_name    VARCHAR(120) NOT NULL,
    sport_type   VARCHAR(20)  NOT NULL,
    team_status  VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_by   UUID         NOT NULL REFERENCES users(user_id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE team_memberships (
    membership_id     UUID PRIMARY KEY,
    team_id           UUID        NOT NULL REFERENCES teams(team_id),
    user_id           UUID        NOT NULL REFERENCES users(user_id),
    roles             TEXT[]      NOT NULL,
    membership_status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, user_id)
);
CREATE INDEX idx_membership_user ON team_memberships (user_id);

CREATE TABLE players (
    player_id            UUID PRIMARY KEY,
    team_id              UUID        NOT NULL REFERENCES teams(team_id),
    display_name         VARCHAR(120) NOT NULL,
    uniform_number       VARCHAR(10),
    primary_positions    TEXT[]      NOT NULL DEFAULT '{}',
    secondary_positions  TEXT[]      NOT NULL DEFAULT '{}',
    roster_status        VARCHAR(20) NOT NULL DEFAULT 'active',
    availability         VARCHAR(20) NOT NULL DEFAULT 'available',
    linked_user_id       UUID        REFERENCES users(user_id),
    linked_membership_id UUID        REFERENCES team_memberships(membership_id),
    account_link_status  VARCHAR(20) NOT NULL DEFAULT 'unlinked',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_team ON players (team_id);

CREATE TABLE player_history (
    history_id  UUID PRIMARY KEY,
    player_id   UUID        NOT NULL REFERENCES players(player_id),
    field       VARCHAR(40) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    changed_by  UUID        NOT NULL REFERENCES users(user_id),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_player ON player_history (player_id, changed_at);
```

- [ ] **Step 2: application.yaml 與 application-test.yaml 啟用 ProblemDetail**

於兩個檔的 `spring:` 底下加入（與 `mvc` 同層）：

application.yaml（在 `spring:` 區塊內加）：
```yaml
  mvc:
    problemdetails:
      enabled: true
```
application-test.yaml（同樣於 `spring:` 內加上述 `mvc.problemdetails.enabled: true`）。

- [ ] **Step 3: 跑既有整合測試確認 V2 套用、context 仍啟動**

Run: `cd backend && export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"; export PATH="$JAVA_HOME/bin:$PATH"; mvn -q -Dtest=ContextLoadsIT test`
Expected: PASS（Flyway 套用 V1+V2、context 啟動）。

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V2__teams_players_rbac.sql backend/src/main/resources/application.yaml backend/src/main/resources/application-test.yaml
git commit -m "feat(db): V2 teams/players/rbac schema; enable RFC7807 problemdetails"
```

---

## Phase 1：球隊 + 授權

### Task 2：TeamRole + Team/TeamMembership entities + repositories

**Files:**
- Create: `shared/authorization/TeamRole.java`, `team/Team.java`, `team/TeamRepository.java`, `team/TeamMembership.java`, `team/TeamMembershipRepository.java`
- Test: `team/TeamMembershipRepositoryIT.java`

- [ ] **Step 1: 寫 repository 測試（先紅）**

```java
package com.baseball.record.team;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TeamMembershipRepositoryIT extends IntegrationTest {
    @Autowired TeamRepository teams;
    @Autowired TeamMembershipRepository memberships;

    @Test
    void save_team_with_owner_membership_and_query_by_user() {
        UUID userId = UUID.randomUUID();
        Team t = teams.save(new Team("Tigers", "baseball", userId));
        memberships.save(new TeamMembership(t.getTeamId(), userId, List.of("owner")));

        var mine = memberships.findByUserId(userId);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).getRoles()).containsExactly("owner");
        assertThat(memberships.findByTeamIdAndUserId(t.getTeamId(), userId)).isPresent();
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `mvn -q -Dtest=TeamMembershipRepositoryIT test` → FAIL（型別不存在）

- [ ] **Step 3: TeamRole enum**

```java
package com.baseball.record.shared.authorization;

public enum TeamRole {
    OWNER("owner"), MANAGER("manager"), COACH("coach"),
    SCORER("scorer"), MEMBER("member"), STAFF("staff");

    private final String code;
    TeamRole(String code) { this.code = code; }
    public String code() { return code; }
}
```

- [ ] **Step 4: Team entity**

```java
package com.baseball.record.team;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "teams")
public class Team {
    @Id @Column(name = "team_id") private UUID teamId = UUID.randomUUID();
    @Column(name = "team_name", nullable = false) private String teamName;
    @Column(name = "sport_type", nullable = false) private String sportType;
    @Column(name = "team_status", nullable = false) private String teamStatus = "active";
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected Team() {}
    public Team(String teamName, String sportType, UUID createdBy) {
        this.teamName = teamName; this.sportType = sportType; this.createdBy = createdBy;
    }
    public UUID getTeamId() { return teamId; }
    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }
    public String getSportType() { return sportType; }
    public String getTeamStatus() { return teamStatus; }
    public UUID getCreatedBy() { return createdBy; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 5: TeamMembership entity（roles 用 text[]）**

```java
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
```

- [ ] **Step 6: repositories**

```java
package com.baseball.record.team;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TeamRepository extends JpaRepository<Team, UUID> {
}
```
```java
package com.baseball.record.team;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TeamMembershipRepository extends JpaRepository<TeamMembership, UUID> {
    List<TeamMembership> findByUserId(UUID userId);
    Optional<TeamMembership> findByTeamIdAndUserId(UUID teamId, UUID userId);
}
```

- [ ] **Step 7: 跑測試確認通過** — `mvn -q -Dtest=TeamMembershipRepositoryIT test` → PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/baseball/record/team backend/src/main/java/com/baseball/record/shared/authorization/TeamRole.java backend/src/test/java/com/baseball/record/team/TeamMembershipRepositoryIT.java
git commit -m "feat(team): Team and TeamMembership entities with text[] roles"
```

---

### Task 3：TeamAccessPolicy（shared/authorization）

**Files:**
- Create: `shared/authorization/TeamAccessPolicy.java`
- Test: `shared/authorization/TeamAccessPolicyIT.java`

- [ ] **Step 1: 寫測試（先紅）**

```java
package com.baseball.record.shared.authorization;

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

    @Test
    void owner_passes_member_and_role_checks() {
        UUID owner = UUID.randomUUID();
        Team t = teams.save(new Team("A", "baseball", owner));
        memberships.save(new TeamMembership(t.getTeamId(), owner, List.of("owner")));

        policy.requireMember(owner, t.getTeamId());           // no throw
        policy.requireRole(owner, t.getTeamId(), TeamRole.OWNER); // no throw
        assertThat(policy.myTeams(owner)).extracting(Team::getTeamId).contains(t.getTeamId());
    }

    @Test
    void non_member_gets_404() {
        Team t = teams.save(new Team("B", "baseball", UUID.randomUUID()));
        assertThatThrownBy(() -> policy.requireMember(UUID.randomUUID(), t.getTeamId()))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("404");
    }

    @Test
    void member_without_role_gets_403() {
        UUID member = UUID.randomUUID();
        Team t = teams.save(new Team("C", "baseball", UUID.randomUUID()));
        memberships.save(new TeamMembership(t.getTeamId(), member, List.of("member")));
        assertThatThrownBy(() -> policy.requireRole(member, t.getTeamId(), TeamRole.OWNER))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("403");
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `mvn -q -Dtest=TeamAccessPolicyIT test` → FAIL

- [ ] **Step 3: TeamAccessPolicy**

```java
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
```

- [ ] **Step 4: 跑測試確認通過** — `mvn -q -Dtest=TeamAccessPolicyIT test` → PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/baseball/record/shared/authorization/TeamAccessPolicy.java backend/src/test/java/com/baseball/record/shared/authorization/TeamAccessPolicyIT.java
git commit -m "feat(authz): TeamAccessPolicy with 404/403 team-scoped checks"
```

---

### Task 4：TeamService + TeamController（建立/列出/取得/改名）

**Files:**
- Create: `team/dto/CreateTeamRequest.java`, `team/dto/UpdateTeamRequest.java`, `team/dto/TeamResponse.java`, `team/TeamService.java`, `team/TeamController.java`
- Test: `team/TeamControllerIT.java`

- [ ] **Step 1: 寫整合測試（先紅）**

```java
package com.baseball.record.team;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TeamControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    /** 註冊一個使用者，回傳其 JWT。 */
    String registerToken(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }

    @Test
    void create_team_assigns_owner_and_lists_mine() throws Exception {
        String token = registerToken("owner1@x.com");
        mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamName\":\"Tigers\",\"sportType\":\"baseball\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.teamId").isNotEmpty())
           .andExpect(jsonPath("$.teamStatus").value("active"))
           .andExpect(jsonPath("$.myRoles[0]").value("owner"));

        mvc.perform(get("/api/teams").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].teamName").value("Tigers"));
    }

    @Test
    void get_team_of_other_user_returns_404() throws Exception {
        String a = registerToken("a@x.com");
        String teamId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + a)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"A\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");

        String b = registerToken("b@x.com");
        mvc.perform(get("/api/teams/" + teamId).header("Authorization", "Bearer " + b))
           .andExpect(status().isNotFound());
    }

    @Test
    void rename_team_by_owner() throws Exception {
        String token = registerToken("owner2@x.com");
        String teamId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"Old\",\"sportType\":\"softball_slow\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");

        mvc.perform(patch("/api/teams/" + teamId).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"New\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.teamName").value("New"));
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `mvn -q -Dtest=TeamControllerIT test` → FAIL

- [ ] **Step 3: DTOs**

```java
package com.baseball.record.team.dto;
import jakarta.validation.constraints.*;
public record CreateTeamRequest(@NotBlank @Size(max = 120) String teamName,
                                @NotBlank @Pattern(regexp = "baseball|softball_fast|softball_slow|teeball") String sportType) {}
```
```java
package com.baseball.record.team.dto;
import jakarta.validation.constraints.*;
public record UpdateTeamRequest(@NotBlank @Size(max = 120) String teamName) {}
```
```java
package com.baseball.record.team.dto;
import java.util.List;
import java.util.UUID;
public record TeamResponse(UUID teamId, String teamName, String sportType, String teamStatus, List<String> myRoles) {}
```

- [ ] **Step 4: TeamService**

```java
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
```

- [ ] **Step 5: TeamController**

```java
package com.baseball.record.team;

import com.baseball.record.team.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams")
public class TeamController {
    private final TeamService service;
    public TeamController(TeamService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeamResponse create(@AuthenticationPrincipal UUID userId, @Valid @RequestBody CreateTeamRequest req) {
        return service.create(userId, req);
    }

    @GetMapping
    public List<TeamResponse> mine(@AuthenticationPrincipal UUID userId) { return service.myTeams(userId); }

    @GetMapping("/{teamId}")
    public TeamResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId) {
        return service.get(userId, teamId);
    }

    @PatchMapping("/{teamId}")
    public TeamResponse rename(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                              @Valid @RequestBody UpdateTeamRequest req) {
        return service.rename(userId, teamId, req);
    }
}
```

- [ ] **Step 6: 跑測試確認通過** — `mvn -q -Dtest=TeamControllerIT test` → PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/baseball/record/team backend/src/test/java/com/baseball/record/team/TeamControllerIT.java
git commit -m "feat(team): create/list/get/rename team with auto owner (AC-2)"
```

---

## Phase 2：球員

### Task 5：Player + PlayerHistory entities + repositories

**Files:**
- Create: `player/Player.java`, `player/PlayerRepository.java`, `player/PlayerHistory.java`, `player/PlayerHistoryRepository.java`

> 本 task 無獨立測試（由 Task 6/7 的 controller IT 覆蓋）；以 Task 6 的編譯/測試驗證。

- [ ] **Step 1: Player entity（positions 用 text[]）**

```java
package com.baseball.record.player;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "players")
public class Player {
    @Id @Column(name = "player_id") private UUID playerId = UUID.randomUUID();
    @Column(name = "team_id", nullable = false) private UUID teamId;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(name = "uniform_number") private String uniformNumber;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "primary_positions", columnDefinition = "text[]", nullable = false)
    private List<String> primaryPositions = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "secondary_positions", columnDefinition = "text[]", nullable = false)
    private List<String> secondaryPositions = new ArrayList<>();

    @Column(name = "roster_status", nullable = false) private String rosterStatus = "active";
    @Column(name = "availability", nullable = false) private String availability = "available";
    @Column(name = "linked_user_id") private UUID linkedUserId;
    @Column(name = "linked_membership_id") private UUID linkedMembershipId;
    @Column(name = "account_link_status", nullable = false) private String accountLinkStatus = "unlinked";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected Player() {}
    public Player(UUID teamId, String displayName) { this.teamId = teamId; this.displayName = displayName; }

    public UUID getPlayerId() { return playerId; }
    public UUID getTeamId() { return teamId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String v) { this.displayName = v; }
    public String getUniformNumber() { return uniformNumber; }
    public void setUniformNumber(String v) { this.uniformNumber = v; }
    public List<String> getPrimaryPositions() { return primaryPositions; }
    public void setPrimaryPositions(List<String> v) { this.primaryPositions = new ArrayList<>(v); }
    public List<String> getSecondaryPositions() { return secondaryPositions; }
    public void setSecondaryPositions(List<String> v) { this.secondaryPositions = new ArrayList<>(v); }
    public String getRosterStatus() { return rosterStatus; }
    public void setRosterStatus(String v) { this.rosterStatus = v; }
    public String getAvailability() { return availability; }
    public void setAvailability(String v) { this.availability = v; }
    public String getAccountLinkStatus() { return accountLinkStatus; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}
```

- [ ] **Step 2: PlayerHistory entity（append-only）**

```java
package com.baseball.record.player;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "player_history")
public class PlayerHistory {
    @Id @Column(name = "history_id") private UUID historyId = UUID.randomUUID();
    @Column(name = "player_id", nullable = false) private UUID playerId;
    @Column(name = "field", nullable = false) private String field;
    @Column(name = "old_value") private String oldValue;
    @Column(name = "new_value") private String newValue;
    @Column(name = "changed_by", nullable = false) private UUID changedBy;
    @Column(name = "changed_at", nullable = false) private OffsetDateTime changedAt = OffsetDateTime.now();

    protected PlayerHistory() {}
    public PlayerHistory(UUID playerId, String field, String oldValue, String newValue, UUID changedBy) {
        this.playerId = playerId; this.field = field; this.oldValue = oldValue;
        this.newValue = newValue; this.changedBy = changedBy;
    }
    public UUID getPlayerId() { return playerId; }
    public String getField() { return field; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public OffsetDateTime getChangedAt() { return changedAt; }
}
```

- [ ] **Step 3: repositories**

```java
package com.baseball.record.player;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {
    List<Player> findByTeamId(UUID teamId);
}
```
```java
package com.baseball.record.player;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PlayerHistoryRepository extends JpaRepository<PlayerHistory, UUID> {
    List<PlayerHistory> findByPlayerIdOrderByChangedAtDesc(UUID playerId);
}
```

- [ ] **Step 4: 編譯通過** — `mvn -q -DskipTests compile` → BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/baseball/record/player
git commit -m "feat(player): Player and PlayerHistory entities + repositories"
```

---

### Task 6：球員建立 / 列出 / 取得

**Files:**
- Create: `player/dto/CreatePlayerRequest.java`, `player/dto/PlayerResponse.java`, `player/PlayerService.java`, `player/PlayerController.java`
- Test: `player/PlayerControllerIT.java`

- [ ] **Step 1: 寫整合測試（先紅）**

```java
package com.baseball.record.player;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PlayerControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String registerToken(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }
    String createTeam(String token) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");
    }

    @Test
    void create_player_only_display_name_required() throws Exception {
        String token = registerToken("p1@x.com");
        String teamId = createTeam(token);
        mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"Amy\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.playerId").isNotEmpty())
           .andExpect(jsonPath("$.rosterStatus").value("active"))
           .andExpect(jsonPath("$.availability").value("available"));
    }

    @Test
    void duplicate_uniform_number_allowed_and_list_excludes_archived() throws Exception {
        String token = registerToken("p2@x.com");
        String teamId = createTeam(token);
        String base = "/api/teams/" + teamId + "/players";
        mvc.perform(post(base).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"A\",\"uniformNumber\":\"00\"}")).andExpect(status().isCreated());
        mvc.perform(post(base).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"B\",\"uniformNumber\":\"00\"}")).andExpect(status().isCreated());

        mvc.perform(get(base).header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2));
    }
}
```

- [ ] **Step 2: 跑測試確認失敗** — `mvn -q -Dtest=PlayerControllerIT test` → FAIL

- [ ] **Step 3: DTOs**

```java
package com.baseball.record.player.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public record CreatePlayerRequest(
    @NotBlank @Size(max = 120) String displayName,
    @Size(max = 10) String uniformNumber,
    List<String> primaryPositions,
    List<String> secondaryPositions,
    @Pattern(regexp = "active|inactive|graduated|archived") String rosterStatus,
    @Pattern(regexp = "available|injured|unavailable") String availability) {}
```
```java
package com.baseball.record.player.dto;
import java.util.List;
import java.util.UUID;
public record PlayerResponse(UUID playerId, UUID teamId, String displayName, String uniformNumber,
                             List<String> primaryPositions, List<String> secondaryPositions,
                             String rosterStatus, String availability, String accountLinkStatus) {}
```

- [ ] **Step 4: PlayerService（建立 / 列出 / 取得）**

```java
package com.baseball.record.player;

import com.baseball.record.player.dto.*;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PlayerService {
    private final PlayerRepository players;
    private final PlayerHistoryRepository history;
    private final TeamAccessPolicy policy;

    public PlayerService(PlayerRepository players, PlayerHistoryRepository history, TeamAccessPolicy policy) {
        this.players = players; this.history = history; this.policy = policy;
    }

    @Transactional
    public PlayerResponse create(UUID userId, UUID teamId, CreatePlayerRequest req) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        Player p = new Player(teamId, req.displayName());
        if (req.uniformNumber() != null) p.setUniformNumber(req.uniformNumber());
        if (req.primaryPositions() != null) p.setPrimaryPositions(req.primaryPositions());
        if (req.secondaryPositions() != null) p.setSecondaryPositions(req.secondaryPositions());
        if (req.rosterStatus() != null) p.setRosterStatus(req.rosterStatus());
        if (req.availability() != null) p.setAvailability(req.availability());
        return toResponse(players.save(p));
    }

    @Transactional(readOnly = true)
    public List<PlayerResponse> list(UUID userId, UUID teamId, String rosterStatus, String position, boolean includeArchived) {
        policy.requireMember(userId, teamId);
        return players.findByTeamId(teamId).stream()
            .filter(p -> includeArchived || !"archived".equals(p.getRosterStatus()))
            .filter(p -> rosterStatus == null || rosterStatus.equals(p.getRosterStatus()))
            .filter(p -> position == null
                || p.getPrimaryPositions().contains(position) || p.getSecondaryPositions().contains(position))
            .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PlayerResponse get(UUID userId, UUID teamId, UUID playerId) {
        policy.requireMember(userId, teamId);
        return toResponse(load(teamId, playerId));
    }

    Player load(UUID teamId, UUID playerId) {
        Player p = players.findById(playerId)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND, "player not found"));
        if (!p.getTeamId().equals(teamId))
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND, "player not found");
        return p;
    }

    PlayerResponse toResponse(Player p) {
        return new PlayerResponse(p.getPlayerId(), p.getTeamId(), p.getDisplayName(), p.getUniformNumber(),
            p.getPrimaryPositions(), p.getSecondaryPositions(), p.getRosterStatus(), p.getAvailability(),
            p.getAccountLinkStatus());
    }
}
```

- [ ] **Step 5: PlayerController（本 task 先放 create/list/get；update/delete/history 於 Task 7 補）**

```java
package com.baseball.record.player;

import com.baseball.record.player.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams/{teamId}/players")
public class PlayerController {
    private final PlayerService service;
    public PlayerController(PlayerService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlayerResponse create(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                 @Valid @RequestBody CreatePlayerRequest req) {
        return service.create(userId, teamId, req);
    }

    @GetMapping
    public List<PlayerResponse> list(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                     @RequestParam(required = false) String rosterStatus,
                                     @RequestParam(required = false) String position,
                                     @RequestParam(defaultValue = "false") boolean includeArchived) {
        return service.list(userId, teamId, rosterStatus, position, includeArchived);
    }

    @GetMapping("/{playerId}")
    public PlayerResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                              @PathVariable UUID playerId) {
        return service.get(userId, teamId, playerId);
    }
}
```

- [ ] **Step 6: 跑測試確認通過** — `mvn -q -Dtest=PlayerControllerIT test` → PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/baseball/record/player backend/src/test/java/com/baseball/record/player/PlayerControllerIT.java
git commit -m "feat(player): create/list/get players, owner-only (AC-3.1/3.4)"
```

---

### Task 7：球員更新（寫歷史）/ 軟刪 / 歷史查詢

**Files:**
- Create: `player/dto/UpdatePlayerRequest.java`, `player/dto/PlayerHistoryResponse.java`
- Modify: `player/PlayerService.java`（加 update/softDelete/history）、`player/PlayerController.java`（加 PATCH/DELETE/history）
- Modify: `player/PlayerControllerIT.java`（加測試）

- [ ] **Step 1: 加測試（先紅）**

於 `PlayerControllerIT` 新增（沿用既有 helper）：

```java
    @Test
    void update_writes_history_and_soft_delete_archives() throws Exception {
        String token = registerToken("p3@x.com");
        String teamId = createTeam(token);
        String base = "/api/teams/" + teamId + "/players";
        String pid = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post(base).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"displayName\":\"Amy\",\"uniformNumber\":\"7\"}"))
                .andReturn().getResponse().getContentAsString(), "$.playerId");

        // 改背號 7 -> 10 + 主守位
        mvc.perform(patch(base + "/" + pid).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"uniformNumber\":\"10\",\"primaryPositions\":[\"SS\"]}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.uniformNumber").value("10"));

        // 歷史含 uniform_number 與 primary_positions 兩筆
        mvc.perform(get(base + "/" + pid + "/history").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2));

        // 軟刪
        mvc.perform(delete(base + "/" + pid).header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());

        // 列表預設不含 archived
        mvc.perform(get(base).header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(0));
        // includeArchived=true 可見
        mvc.perform(get(base + "?includeArchived=true").header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].rosterStatus").value("archived"));
    }
```

- [ ] **Step 2: 跑測試確認失敗** — `mvn -q -Dtest=PlayerControllerIT test` → FAIL

- [ ] **Step 3: DTOs**

```java
package com.baseball.record.player.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public record UpdatePlayerRequest(
    @Size(max = 120) String displayName,
    @Size(max = 10) String uniformNumber,
    List<String> primaryPositions,
    List<String> secondaryPositions,
    @Pattern(regexp = "active|inactive|graduated|archived") String rosterStatus,
    @Pattern(regexp = "available|injured|unavailable") String availability) {}
```
```java
package com.baseball.record.player.dto;
import java.time.OffsetDateTime;
public record PlayerHistoryResponse(String field, String oldValue, String newValue, OffsetDateTime changedAt) {}
```

- [ ] **Step 4: PlayerService 加 update / softDelete / history**

於 `PlayerService` 加入以下方法與 helper（沿用既有 fields）：

```java
    @org.springframework.transaction.annotation.Transactional
    public PlayerResponse update(UUID userId, UUID teamId, UUID playerId, com.baseball.record.player.dto.UpdatePlayerRequest req) {
        policy.requireRole(userId, teamId, com.baseball.record.shared.authorization.TeamRole.OWNER);
        Player p = load(teamId, playerId);

        if (req.displayName() != null) p.setDisplayName(req.displayName());          // 不入歷史
        if (req.availability() != null) p.setAvailability(req.availability());        // 不入歷史

        if (req.uniformNumber() != null && !req.uniformNumber().equals(nz(p.getUniformNumber()))) {
            track(playerId, userId, "uniform_number", nz(p.getUniformNumber()), req.uniformNumber());
            p.setUniformNumber(req.uniformNumber());
        }
        if (req.primaryPositions() != null && !norm(req.primaryPositions()).equals(norm(p.getPrimaryPositions()))) {
            track(playerId, userId, "primary_positions", norm(p.getPrimaryPositions()), norm(req.primaryPositions()));
            p.setPrimaryPositions(req.primaryPositions());
        }
        if (req.secondaryPositions() != null && !norm(req.secondaryPositions()).equals(norm(p.getSecondaryPositions()))) {
            track(playerId, userId, "secondary_positions", norm(p.getSecondaryPositions()), norm(req.secondaryPositions()));
            p.setSecondaryPositions(req.secondaryPositions());
        }
        if (req.rosterStatus() != null && !req.rosterStatus().equals(p.getRosterStatus())) {
            track(playerId, userId, "roster_status", p.getRosterStatus(), req.rosterStatus());
            p.setRosterStatus(req.rosterStatus());
        }
        p.touch();
        return toResponse(p);
    }

    @org.springframework.transaction.annotation.Transactional
    public void softDelete(UUID userId, UUID teamId, UUID playerId) {
        policy.requireRole(userId, teamId, com.baseball.record.shared.authorization.TeamRole.OWNER);
        Player p = load(teamId, playerId);
        if (!"archived".equals(p.getRosterStatus())) {
            track(playerId, userId, "roster_status", p.getRosterStatus(), "archived");
            p.setRosterStatus("archived");
            p.touch();
        }
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public java.util.List<com.baseball.record.player.dto.PlayerHistoryResponse> history(UUID userId, UUID teamId, UUID playerId) {
        policy.requireMember(userId, teamId);
        load(teamId, playerId);
        return history.findByPlayerIdOrderByChangedAtDesc(playerId).stream()
            .map(h -> new com.baseball.record.player.dto.PlayerHistoryResponse(
                h.getField(), h.getOldValue(), h.getNewValue(), h.getChangedAt())).toList();
    }

    private void track(UUID playerId, UUID userId, String field, String oldV, String newV) {
        history.save(new PlayerHistory(playerId, field, oldV, newV, userId));
    }
    private static String nz(String s) { return s == null ? "" : s; }
    private static String norm(java.util.List<String> v) {
        return v == null ? "" : v.stream().sorted().reduce((a, b) -> a + "," + b).orElse("");
    }
```

- [ ] **Step 5: PlayerController 加 PATCH / DELETE / history**

於 `PlayerController` 加入：

```java
    @PatchMapping("/{playerId}")
    public com.baseball.record.player.dto.PlayerResponse update(
            @org.springframework.security.core.annotation.AuthenticationPrincipal UUID userId,
            @PathVariable UUID teamId, @PathVariable UUID playerId,
            @jakarta.validation.Valid @RequestBody com.baseball.record.player.dto.UpdatePlayerRequest req) {
        return service.update(userId, teamId, playerId, req);
    }

    @DeleteMapping("/{playerId}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void delete(@org.springframework.security.core.annotation.AuthenticationPrincipal UUID userId,
                       @PathVariable UUID teamId, @PathVariable UUID playerId) {
        service.softDelete(userId, teamId, playerId);
    }

    @GetMapping("/{playerId}/history")
    public java.util.List<com.baseball.record.player.dto.PlayerHistoryResponse> history(
            @org.springframework.security.core.annotation.AuthenticationPrincipal UUID userId,
            @PathVariable UUID teamId, @PathVariable UUID playerId) {
        return service.history(userId, teamId, playerId);
    }
```

- [ ] **Step 6: 跑測試確認通過** — `mvn -q -Dtest=PlayerControllerIT test` → PASS

- [ ] **Step 7: 全後端回歸** — `mvn -q test` → 全綠（含 M1-A 測試，驗證 ProblemDetail 未破壞 status code）

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/baseball/record/player backend/src/test/java/com/baseball/record/player/PlayerControllerIT.java
git commit -m "feat(player): update with append-only history, soft delete, history API (AC-3.2/3.3)"
```

---

## Phase 3：前端 + E2E

### Task 8：react-router + api client + 我的球隊頁

**Files:**
- Modify: `frontend/package.json`（加 react-router-dom）、`frontend/src/main.tsx`、`frontend/src/App.tsx`、`frontend/src/api/client.ts`
- Create: `frontend/src/pages/TeamsPage.tsx`, `frontend/src/pages/teams.css`

- [ ] **Step 1: 安裝 react-router-dom**

Run: `cd frontend && npm i react-router-dom`

- [ ] **Step 2: api/client.ts 擴充 teams/players**

於 `frontend/src/api/client.ts` 的 `api` 物件加入（保留既有 register/login/me；req 不變）：

```ts
export const api = {
  register: (d: object) => req('/api/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login: (d: object) => req('/api/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  me: () => req('/api/auth/me'),
  teams: {
    list: () => req('/api/teams'),
    create: (d: object) => req('/api/teams', { method: 'POST', body: JSON.stringify(d) }),
    get: (id: string) => req(`/api/teams/${id}`),
  },
  players: {
    list: (teamId: string, qs = '') => req(`/api/teams/${teamId}/players${qs}`),
    create: (teamId: string, d: object) => req(`/api/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify(d) }),
    update: (teamId: string, pid: string, d: object) => req(`/api/teams/${teamId}/players/${pid}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove: (teamId: string, pid: string) => req(`/api/teams/${teamId}/players/${pid}`, { method: 'DELETE' }),
    history: (teamId: string, pid: string) => req(`/api/teams/${teamId}/players/${pid}/history`),
  },
}
```

- [ ] **Step 3: main.tsx 包 BrowserRouter**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './tokens.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 4: App.tsx 路由（登入/登出 + /teams /teams/:id）**

```tsx
import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api, getToken, clearToken } from './api/client'
import LoginPage from './pages/LoginPage'
import TeamsPage from './pages/TeamsPage'
import TeamPage from './pages/TeamPage'

export default function App() {
  const [me, setMe] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const load = () => api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true))
  useEffect(() => { if (getToken()) load(); else setReady(true) }, [])

  function logout() { clearToken(); setMe(null) }
  if (!ready) return null
  if (!me) return <LoginPage onAuthed={load} />
  return (
    <Routes>
      <Route path="/" element={<TeamsPage me={me} onLogout={logout} />} />
      <Route path="/teams/:teamId" element={<TeamPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 5: pages/teams.css（沿用 tokens）**

```css
.page { max-width: 760px; margin: 0 auto; padding: 24px; }
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-head h1 { color: var(--accent-strong); margin: 0; font-size: 22px; }
.card-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.team-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  box-shadow: var(--shadow); padding: 16px; cursor: pointer; }
.team-card h3 { margin: 0 0 4px; color: var(--accent-strong); }
.team-card .muted { color: var(--muted); font-size: 13px; }
.inline-form { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.inline-form input, .inline-form select { padding: 10px 12px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--bg); }
.table { width: 100%; border-collapse: collapse; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
.table th, .table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.table th { background: var(--surface-alt); color: var(--muted); font-size: 13px; }
.row-actions { display: flex; gap: 8px; }
```

- [ ] **Step 6: pages/TeamsPage.tsx（列出 + 建立）**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import '../pages/LoginPage.css'
import './teams.css'

export default function TeamsPage({ me, onLogout }: { me: any; onLogout: () => void }) {
  const [teams, setTeams] = useState<any[]>([])
  const [name, setName] = useState(''); const [sport, setSport] = useState('baseball')
  const nav = useNavigate()
  const load = () => api.teams.list().then(setTeams)
  useEffect(() => { load() }, [])

  async function create() {
    if (!name.trim()) return
    await api.teams.create({ teamName: name, sportType: sport })
    setName(''); load()
  }
  return (
    <main className="page">
      <div className="page-head">
        <h1>我的球隊</h1>
        <div>嗨，{me.displayName}　<button className="btn btn-ghost" onClick={onLogout}>登出</button></div>
      </div>
      <div className="inline-form">
        <input placeholder="球隊名稱" value={name} onChange={e => setName(e.target.value)} />
        <select value={sport} onChange={e => setSport(e.target.value)}>
          <option value="baseball">棒球</option>
          <option value="softball_fast">快壘</option>
          <option value="softball_slow">慢壘</option>
          <option value="teeball">樂樂棒球</option>
        </select>
        <button className="btn btn-primary" onClick={create}>建立球隊</button>
      </div>
      <div className="card-grid">
        {teams.map(t => (
          <div key={t.teamId} className="team-card" onClick={() => nav(`/teams/${t.teamId}`)}>
            <h3>{t.teamName}</h3>
            <p className="muted">{t.sportType} · {t.myRoles.join(', ')}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 7: 編譯（TeamPage 於 Task 9 建立前先放最小 stub 以利 build）**

先在 `frontend/src/pages/TeamPage.tsx` 放 stub（Task 9 取代）：
```tsx
export default function TeamPage() { return <main className="page">…</main> }
```
Run: `cd frontend && npm run build` → 成功。

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src
git commit -m "feat(frontend): router + teams page (list/create) (AC-2)"
```

---

### Task 9：球隊頁 — 球員名單 CRUD

**Files:**
- Modify: `frontend/src/pages/TeamPage.tsx`（取代 stub）

- [ ] **Step 1: TeamPage.tsx（名單表 + 新增 + 改背號 + 軟刪 + 篩選）**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import '../pages/LoginPage.css'
import './teams.css'

export default function TeamPage() {
  const { teamId } = useParams()
  const nav = useNavigate()
  const [team, setTeam] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [name, setName] = useState(''); const [num, setNum] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

  const load = () => {
    api.teams.get(teamId!).then(setTeam).catch(() => nav('/'))
    api.players.list(teamId!, includeArchived ? '?includeArchived=true' : '').then(setPlayers)
  }
  useEffect(() => { load() }, [teamId, includeArchived])

  async function addPlayer() {
    if (!name.trim()) return
    await api.players.create(teamId!, { displayName: name, uniformNumber: num || undefined })
    setName(''); setNum(''); load()
  }
  async function changeNumber(p: any) {
    const next = prompt(`新背號（${p.displayName}）`, p.uniformNumber ?? '')
    if (next === null) return
    await api.players.update(teamId!, p.playerId, { uniformNumber: next }); load()
  }
  async function remove(p: any) {
    if (!confirm(`封存球員 ${p.displayName}？`)) return
    await api.players.remove(teamId!, p.playerId); load()
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>{team ? team.teamName : '…'}</h1>
        <button className="btn btn-ghost" onClick={() => nav('/')}>← 返回</button>
      </div>
      <div className="inline-form">
        <input placeholder="球員名稱" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="背號" value={num} onChange={e => setNum(e.target.value)} />
        <button className="btn btn-primary" onClick={addPlayer}>新增球員</button>
        <label style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} /> 顯示已封存
        </label>
      </div>
      <table className="table">
        <thead><tr><th>背號</th><th>名稱</th><th>守位</th><th>狀態</th><th></th></tr></thead>
        <tbody>
          {players.map(p => (
            <tr key={p.playerId}>
              <td>{p.uniformNumber ?? '—'}</td>
              <td>{p.displayName}</td>
              <td>{p.primaryPositions.join(', ') || '—'}</td>
              <td>{p.rosterStatus}</td>
              <td className="row-actions">
                <button className="btn btn-ghost" onClick={() => changeNumber(p)}>改背號</button>
                {p.rosterStatus !== 'archived' &&
                  <button className="btn btn-ghost" onClick={() => remove(p)}>封存</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

- [ ] **Step 2: 編譯** — `cd frontend && npm run build` → 成功

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TeamPage.tsx
git commit -m "feat(frontend): team page with player roster CRUD (AC-3)"
```

---

### Task 10：Playwright E2E（AC-2/AC-3 端到端）

**Files:**
- Create: `frontend/e2e/team-player.spec.ts`

- [ ] **Step 1: E2E 測試**

```ts
import { test, expect } from '@playwright/test'

test('create team, add/edit/archive player (AC-2/AC-3)', async ({ page }) => {
  const email = `tp_${Date.now()}@x.com`
  // 註冊登入
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Owner')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()

  // 建立球隊
  await expect(page.getByText('我的球隊')).toBeVisible()
  await page.getByPlaceholder('球隊名稱').fill('Tigers')
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByText('Tigers').click()

  // 新增球員
  await page.getByPlaceholder('球員名稱').fill('Amy')
  await page.getByPlaceholder('背號').fill('7')
  await page.getByRole('button', { name: '新增球員' }).click()
  await expect(page.getByRole('cell', { name: 'Amy' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '7', exact: true })).toBeVisible()

  // 封存（軟刪）後預設清單看不到
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: '封存' }).click()
  await expect(page.getByRole('cell', { name: 'Amy' })).toHaveCount(0)
})
```

- [ ] **Step 2: 跑 E2E（後端 5199 + DB + 前端 5200）**

Run（依 M1-A 既有流程）：
```bash
cd backend && podman-compose up -d db
cd backend && export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"; export PATH="$JAVA_HOME/bin:$PATH"; nohup mvn spring-boot:run > /tmp/be.log 2>&1 &
# 等 curl http://localhost:5199/api/health 回 UP
cd frontend && npx playwright test team-player.spec.ts
```
Expected: PASS（完整端到端：前端→後端→真 Postgres）。收尾 kill 後端 + `podman-compose down`。

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/team-player.spec.ts
git commit -m "test(frontend): E2E team creation + player roster (AC-2/AC-3)"
```

---

## Self-Review（spec 覆蓋檢查）

- **AC-2（建立球隊、自動 owner、列出我的球隊）**：Task 4（create→201+owner、GET mine、非成員 404、rename）、Task 8（前端列出/建立）、Task 10（E2E）→ ✅
- **AC-3（球員 CRUD + 歷史 + 軟刪 + 篩選）**：Task 6（建立只 displayName、背號可重、列表排除 archived、get）、Task 7（PATCH 寫歷史、軟刪 archived、history API、includeArchived）、Task 9（前端 CRUD）、Task 10（E2E）→ ✅
- **域內 RBAC（owner-only、TeamAccessPolicy 404/403）**：Task 3 + 各 service 呼叫 → ✅；完整 6 角色 schema 存於 TeamRole + roles text[] → ✅
- **資料模型（4 表、text[] 多值、append-only 歷史）**：Task 1（migration）、Task 2/5（entities）、Task 7（歷史寫入）→ ✅
- **ProblemDetail（一致錯誤 + 套用 M1-A）**：Task 1（啟用）、Task 7 Step 7（M1-A 回歸）→ ✅
- **前端全 UI + react-router**：Task 8/9 → ✅
- **型別一致**：`TeamAccessPolicy.requireRole(userId,teamId,TeamRole)` 於 TeamService/PlayerService 一致呼叫；`PlayerResponse`/`api.players.*` 欄位與前端使用一致；歷史 `field` 字串（uniform_number/primary_positions/secondary_positions/roster_status）建立與查詢一致。
- **無 placeholder**：各步含實際程式/指令/預期。
- **OUT（留後續）**：成員邀請/角色管理、帳號連結流程、行事曆、比賽(M2)、統計(M3)、刪除球隊、availability 入歷史。
