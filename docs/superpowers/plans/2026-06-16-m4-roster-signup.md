# M4 出賽名單管理（報名清單＋拖拉打序/守備）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把賽前名單拆成「報名清單（寬鬆候補池，不驗證）」與「出賽名單（拖拉排打序/守位，會驗證）」，並記錄每場每人的報名/到場/遲到/請假/放鴿子狀態。

**Architecture:** 新增 `signup` 後端模組與 `game_signup` 表（候補池），沿用 `lineup_slot` 與 `LineupValidator` 零改動；前端把 `LineupTab` 從單表改成 `@dnd-kit` 兩欄拖拉看板，報名與出賽各自整批 PUT。

**Tech Stack:** Java 21 / Spring Boot 3.5 / JPA / PostgreSQL（Testcontainers）；React + TS + Vite；`@dnd-kit/core` + `@dnd-kit/sortable`；Playwright E2E。

**設計來源：** [`docs/superpowers/specs/2026-06-16-roster-signup-lineup-design.md`](../specs/2026-06-16-roster-signup-lineup-design.md)

**環境提醒（每個 backend shell 開頭）：**
```bash
export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
export TESTCONTAINERS_RYUK_DISABLED=true
```
驗證指令一律 offline：`mvn -o ...`（見 user CLAUDE.md fast-mode）。

---

## File Structure

**後端（新增）— `backend/src/main/java/com/baseball/record/signup/`**
- `GameSignup.java` — JPA entity（對 `game_signup`）
- `GameSignupRepository.java` — `findByGameIdOrderBySortIndexAsc` + bulk delete
- `SignupService.java` — get / put（整批覆寫＋驗證＋權限）
- `SignupController.java` — `GET/PUT /api/games/{id}/signups`
- `dto/SignupDto.java` · `dto/PutSignupsRequest.java` · `dto/SignupsResponse.java`

**後端（新增 migration）**
- `backend/src/main/resources/db/migration/V6__game_signup.sql`

**後端（新增測試）**
- `backend/src/test/java/com/baseball/record/signup/SignupControllerIT.java`

**前端（改寫 / 新增）**
- `frontend/package.json` — 加 `@dnd-kit/*` 依賴
- `frontend/src/api/client.ts` — 加 `api.signups`
- `frontend/src/pages/game/LineupTab.tsx` — 單表 → 兩欄拖拉看板（整檔改寫）
- `frontend/src/pages/games.css` — 看板版面樣式（append）
- `frontend/e2e/m4-roster-signup.spec.ts` — E2E（新增）

**不動：** `lineup_slot` schema、`LineupService`、`RosterValidationService`、`LineupValidator`、所有 M3a/M3b。

---

## Task 1: `game_signup` migration + entity + repository

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__game_signup.sql`
- Create: `backend/src/main/java/com/baseball/record/signup/GameSignup.java`
- Create: `backend/src/main/java/com/baseball/record/signup/GameSignupRepository.java`

- [ ] **Step 1: 寫 migration**

`V6__game_signup.sql`：
```sql
CREATE TABLE game_signup (
    signup_id   UUID PRIMARY KEY,
    game_id     UUID         NOT NULL REFERENCES games(game_id),
    player_id   UUID         REFERENCES players(player_id),
    guest_name  VARCHAR(120),
    status      VARCHAR(20)  NOT NULL DEFAULT 'signed_up',
    note        VARCHAR(200),
    sort_index  INT          NOT NULL DEFAULT 0,
    created_by  UUID         NOT NULL REFERENCES users(user_id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_signup_source CHECK ((player_id IS NOT NULL) <> (guest_name IS NOT NULL))
);
CREATE UNIQUE INDEX uq_signup_game_player ON game_signup (game_id, player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_signup_game ON game_signup (game_id);
```

- [ ] **Step 2: 寫 entity `GameSignup.java`**

```java
package com.baseball.record.signup;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "game_signup")
public class GameSignup {
    @Id @Column(name = "signup_id") private UUID signupId = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "player_id") private UUID playerId;
    @Column(name = "guest_name") private String guestName;
    @Column(name = "status", nullable = false) private String status = "signed_up";
    @Column(name = "note") private String note;
    @Column(name = "sort_index", nullable = false) private int sortIndex = 0;
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected GameSignup() {}
    public GameSignup(UUID gameId, UUID createdBy) { this.gameId = gameId; this.createdBy = createdBy; }

    public UUID getSignupId() { return signupId; }
    public UUID getGameId() { return gameId; }
    public UUID getPlayerId() { return playerId; } public void setPlayerId(UUID v) { playerId = v; }
    public String getGuestName() { return guestName; } public void setGuestName(String v) { guestName = v; }
    public String getStatus() { return status; } public void setStatus(String v) { status = v; }
    public String getNote() { return note; } public void setNote(String v) { note = v; }
    public int getSortIndex() { return sortIndex; } public void setSortIndex(int v) { sortIndex = v; }
    public UUID getCreatedBy() { return createdBy; }
}
```

- [ ] **Step 3: 寫 repository `GameSignupRepository.java`**

```java
package com.baseball.record.signup;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface GameSignupRepository extends JpaRepository<GameSignup, UUID> {
    List<GameSignup> findByGameIdOrderBySortIndexAsc(UUID gameId);

    @Modifying
    @Query("delete from GameSignup s where s.gameId = :gameId")
    void deleteByGameId(@Param("gameId") UUID gameId);
}
```
> 用 `@Modifying` bulk delete（立即執行 DML），確保「先刪後插」順序正確，不會撞 `uq_signup_game_player`。

- [ ] **Step 4: 編譯確認（controller 集中跑）**

Run: `cd backend && mvn -o test-compile`
Expected: BUILD SUCCESS（entity/repo 編得過；尚無測試）。

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/resources/db/migration/V6__game_signup.sql backend/src/main/java/com/baseball/record/signup/
git commit -m "feat(m4): game_signup 表 + entity + repository"
```

---

## Task 2: Signup DTOs + Service + Controller（GET/PUT）＋ IT

**Files:**
- Create: `backend/src/main/java/com/baseball/record/signup/dto/SignupDto.java`
- Create: `backend/src/main/java/com/baseball/record/signup/dto/PutSignupsRequest.java`
- Create: `backend/src/main/java/com/baseball/record/signup/dto/SignupsResponse.java`
- Create: `backend/src/main/java/com/baseball/record/signup/SignupService.java`
- Create: `backend/src/main/java/com/baseball/record/signup/SignupController.java`
- Test: `backend/src/test/java/com/baseball/record/signup/SignupControllerIT.java`

- [ ] **Step 1: 寫 DTOs**

`dto/SignupDto.java`：
```java
package com.baseball.record.signup.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SignupDto(UUID playerId, @Size(max = 120) String guestName,
                        @Pattern(regexp = "signed_up|present|late|absent|no_show") String status,
                        @Size(max = 200) String note, Integer sortIndex) {}
```

`dto/PutSignupsRequest.java`：
```java
package com.baseball.record.signup.dto;

import jakarta.validation.Valid;
import java.util.List;

public record PutSignupsRequest(@Valid List<SignupDto> signups) {}
```

`dto/SignupsResponse.java`：
```java
package com.baseball.record.signup.dto;

import java.util.List;
import java.util.UUID;

public record SignupsResponse(UUID gameId, List<SignupDto> signups) {}
```

- [ ] **Step 2: 寫失敗測試 `SignupControllerIT.java`**

```java
package com.baseball.record.signup;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SignupControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    record Ctx(String token, String teamId, String gameId) {}
    String read(String json, String path) { return com.jayway.jsonpath.JsonPath.read(json, path).toString(); }

    String token(String p) throws Exception {
        String email = p + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return read(body, "$.token");
    }
    String addPlayer(String token, String teamId, String name) throws Exception {
        String res = mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"" + name + "\",\"primaryPositions\":[\"P\"]}"))
            .andReturn().getResponse().getContentAsString();
        return read(res, "$.playerId");
    }
    Ctx baseballGame(String prefix) throws Exception {
        String t = token(prefix);
        String teamId = read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"home\",\"opponentName\":\"Lions\"}";
        String gameId = read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn().getResponse().getContentAsString(), "$.gameId");
        return new Ctx(t, teamId, gameId);
    }

    @Test
    void put_then_get_returns_signups() throws Exception {
        Ctx c = baseballGame("s1_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        String body = "{\"signups\":[{\"playerId\":\"" + pid + "\",\"status\":\"signed_up\",\"sortIndex\":0},"
            + "{\"guestName\":\"路人B\",\"status\":\"late\",\"note\":\"五點到\",\"sortIndex\":1}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.signups.length()").value(2));
        mvc.perform(get("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.signups.length()").value(2))
           .andExpect(jsonPath("$.signups[1].guestName").value("路人B"))
           .andExpect(jsonPath("$.signups[1].status").value("late"));
    }

    @Test
    void put_replaces_previous() throws Exception {
        Ctx c = baseballGame("s2_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"playerId\":\"" + pid + "\",\"status\":\"signed_up\"}]}")).andExpect(status().isOk());
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"signups\":[]}")).andExpect(status().isOk());
        mvc.perform(get("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token()))
           .andExpect(jsonPath("$.signups.length()").value(0));
    }

    @Test
    void signup_with_both_sources_is_400() throws Exception {
        Ctx c = baseballGame("s3_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"playerId\":\"" + pid + "\",\"guestName\":\"X\"}]}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void duplicate_player_signup_is_409() throws Exception {
        Ctx c = baseballGame("s4_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"playerId\":\"" + pid + "\"},{\"playerId\":\"" + pid + "\"}]}"))
           .andExpect(status().isConflict());
    }

    @Test
    void invalid_status_is_400() throws Exception {
        Ctx c = baseballGame("s5_");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"guestName\":\"X\",\"status\":\"banana\"}]}"))
           .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 3: 跑測試確認 FAIL**

Run: `cd backend && mvn -o -Dtest=SignupControllerIT test`
Expected: 編譯失敗 / 404（`SignupController` 尚未存在）。

- [ ] **Step 4: 寫 `SignupService.java`**

```java
package com.baseball.record.signup;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.signup.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class SignupService {
    private final GameRepository games;
    private final GameSignupRepository signups;
    private final TeamAccessPolicy policy;

    public SignupService(GameRepository games, GameSignupRepository signups, TeamAccessPolicy policy) {
        this.games = games; this.signups = signups; this.policy = policy;
    }

    @Transactional(readOnly = true)
    public SignupsResponse get(UUID userId, UUID gameId) {
        Game g = loadGame(gameId);
        policy.requireMember(userId, g.getTeamId());
        return toResponse(g);
    }

    @Transactional
    public SignupsResponse put(UUID userId, UUID gameId, PutSignupsRequest req) {
        Game g = loadGame(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);

        List<SignupDto> rows = req.signups() == null ? List.of() : req.signups();
        Set<UUID> seenPlayers = new HashSet<>();
        for (SignupDto s : rows) {
            boolean hasPlayer = s.playerId() != null;
            boolean hasGuest = s.guestName() != null && !s.guestName().isBlank();
            if (hasPlayer == hasGuest)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "each signup needs exactly one of playerId/guestName");
            if (hasPlayer && !seenPlayers.add(s.playerId()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "duplicate player signup");
        }

        signups.deleteByGameId(gameId);
        int idx = 0;
        for (SignupDto s : rows) {
            GameSignup gs = new GameSignup(gameId, userId);
            gs.setPlayerId(s.playerId());
            gs.setGuestName(s.playerId() != null ? null : s.guestName());
            gs.setStatus(s.status() == null ? "signed_up" : s.status());
            gs.setNote(s.note());
            gs.setSortIndex(s.sortIndex() != null ? s.sortIndex() : idx);
            signups.save(gs);
            idx++;
        }
        return toResponse(g);
    }

    SignupsResponse toResponse(Game g) {
        List<SignupDto> dtos = signups.findByGameIdOrderBySortIndexAsc(g.getGameId()).stream()
            .map(s -> new SignupDto(s.getPlayerId(), s.getGuestName(), s.getStatus(), s.getNote(), s.getSortIndex()))
            .toList();
        return new SignupsResponse(g.getGameId(), dtos);
    }

    Game loadGame(UUID gameId) {
        return games.findById(gameId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
```

- [ ] **Step 5: 寫 `SignupController.java`**

```java
package com.baseball.record.signup;

import com.baseball.record.signup.dto.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class SignupController {
    private final SignupService service;
    public SignupController(SignupService service) { this.service = service; }

    @GetMapping("/api/games/{gameId}/signups")
    public SignupsResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.get(userId, gameId);
    }

    @PutMapping("/api/games/{gameId}/signups")
    public SignupsResponse put(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                              @Valid @RequestBody PutSignupsRequest req) {
        return service.put(userId, gameId, req);
    }
}
```

- [ ] **Step 6: 跑測試確認 PASS**

Run: `cd backend && mvn -o -Dtest=SignupControllerIT test`
Expected: Tests run: 5, Failures: 0。

- [ ] **Step 7: 回歸既有 lineup 驗證沒被污染**

Run: `cd backend && mvn -o -Dtest=LineupControllerIT test`
Expected: 全綠（先發驗證邏輯未動）。

- [ ] **Step 8: Commit**
```bash
git add backend/src/main/java/com/baseball/record/signup/ backend/src/test/java/com/baseball/record/signup/
git commit -m "feat(m4): signup GET/PUT API + IT（AC-A/F）"
```

---

## Task 3: 前端依賴 + api client

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/api/client.ts:55-59`

- [ ] **Step 1: 安裝 @dnd-kit**

Run:
```bash
cd frontend && npm install @dnd-kit/core@^6 @dnd-kit/sortable@^8 @dnd-kit/utilities@^3
```
Expected: `package.json` dependencies 多三個 `@dnd-kit/*`。

- [ ] **Step 2: 加 `api.signups`（接在 `roster` 區塊後）**

在 `frontend/src/api/client.ts` 的 `roster: { ... },` 之後加：
```ts
  signups: {
    get: (gameId: string) => req(`/api/games/${gameId}/signups`),
    put: (gameId: string, d: object) => req(`/api/games/${gameId}/signups`, { method: 'PUT', body: JSON.stringify(d) }),
  },
```

- [ ] **Step 3: build 確認**

Run: `cd frontend && npm run build`
Expected: 綠（tsc + vite build 過）。

- [ ] **Step 4: Commit**
```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/client.ts
git commit -m "feat(m4): 前端加 @dnd-kit 依賴 + api.signups"
```

---

## Task 4: `LineupTab` 改兩欄拖拉看板

**Files:**
- Modify（整檔改寫）: `frontend/src/pages/game/LineupTab.tsx`
- Modify（append 樣式）: `frontend/src/pages/games.css`

> 互動雙軌：**拖拉**（滑鼠/觸控，@dnd-kit）為主；每張卡另附**移動按鈕**（→先發 / →替補 / ↩退回報名 / 移除）作為鍵盤/無障礙路徑與 E2E 穩定操作點（滿足 AC-G）。打序＝先發欄內順序自動 `1..N`。

- [ ] **Step 1: 整檔改寫 `LineupTab.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { api } from '../../api/client'
import { Button, useToast } from '../../ui'
import '../teams.css'
import '../games.css'

const POSITIONS: Record<string, string[]> = {
  baseball: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  softball_fast: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
  softball_slow: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SF'],
  teeball: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
}
const STATUS_LABELS: Record<string, string> = {
  signed_up: '報名', present: '到場', late: '遲到', absent: '請假', no_show: '放鴿子',
}
const STATUS_KEYS = Object.keys(STATUS_LABELS)

type Container = 'signup' | 'starter' | 'bench'
type Item = { uid: string; playerId?: string; guestName?: string; status: string; note?: string; fieldPosition?: string }
type Board = Record<Container, Item[]>

let _seq = 0
const uid = () => `it-${_seq++}`
const keyOf = (x: { playerId?: string; guestName?: string }) => x.playerId ? `p:${x.playerId}` : `g:${x.guestName}`

export default function LineupTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [players, setPlayers] = useState<any[]>([])
  const [board, setBoard] = useState<Board>({ signup: [], starter: [], bench: [] })
  const [result, setResult] = useState<{ valid: boolean; violations: { code: string; message: string }[] } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!game) return
    let cancelled = false
    ;(async () => {
      const ps = await api.players.list(game.teamId).catch(() => [])
      const r = await api.roster.get(gameId!).catch(() => ({ slots: [] }))
      const su = await api.signups.get(gameId!).catch(() => ({ signups: [] }))
      if (cancelled) return
      const slots = (r.slots ?? [])
      const starter = slots.filter((s: any) => s.lineupStatus === 'starter')
        .sort((a: any, b: any) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0))
        .map((s: any) => ({ uid: uid(), playerId: s.playerId, guestName: s.guestName, status: 'present', fieldPosition: s.fieldPosition } as Item))
      const bench = slots.filter((s: any) => s.lineupStatus !== 'starter')
        .map((s: any) => ({ uid: uid(), playerId: s.playerId, guestName: s.guestName, status: 'present' } as Item))
      const inLineup = new Set([...starter, ...bench].map(keyOf))
      const signup = (su.signups ?? []).filter((s: any) => !inLineup.has(keyOf(s)))
        .map((s: any) => ({ uid: uid(), playerId: s.playerId, guestName: s.guestName, status: s.status ?? 'signed_up', note: s.note } as Item))
      setPlayers(ps); setBoard({ signup, starter, bench }); setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [gameId])

  const positions = game ? (POSITIONS[game.sportType] ?? POSITIONS.baseball) : []

  function findContainer(id: string): Container | null {
    if (id === 'signup' || id === 'starter' || id === 'bench') return id
    for (const c of ['signup', 'starter', 'bench'] as Container[])
      if (board[c].some(it => it.uid === id)) return c
    return null
  }

  function move(uidStr: string, to: Container, toIndex?: number) {
    setBoard(prev => {
      const from = (['signup', 'starter', 'bench'] as Container[]).find(c => prev[c].some(it => it.uid === uidStr))
      if (!from) return prev
      const item = prev[from].find(it => it.uid === uidStr)!
      const next: Board = { signup: [...prev.signup], starter: [...prev.starter], bench: [...prev.bench] }
      next[from] = next[from].filter(it => it.uid !== uidStr)
      const idx = toIndex == null ? next[to].length : toIndex
      next[to] = [...next[to].slice(0, idx), item, ...next[to].slice(idx)]
      return next
    })
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const from = findContainer(active.id as string)
    const to = findContainer(over.id as string)
    if (!from || !to) return
    if (from === to) {
      setBoard(prev => {
        const items = prev[to]
        const oldIdx = items.findIndex(it => it.uid === active.id)
        const newIdx = over.id === to ? items.length - 1 : items.findIndex(it => it.uid === over.id)
        if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return prev
        return { ...prev, [to]: arrayMove(items, oldIdx, newIdx) }
      })
    } else {
      const overIdx = over.id === to ? undefined : board[to].findIndex(it => it.uid === over.id)
      move(active.id as string, to, overIdx)
    }
  }

  function update(uidStr: string, patch: Partial<Item>) {
    setBoard(prev => {
      const next: Board = { signup: [...prev.signup], starter: [...prev.starter], bench: [...prev.bench] }
      for (const c of ['signup', 'starter', 'bench'] as Container[])
        next[c] = next[c].map(it => it.uid === uidStr ? { ...it, ...patch } : it)
      return next
    })
  }
  function remove(uidStr: string) {
    setBoard(prev => ({
      signup: prev.signup.filter(it => it.uid !== uidStr),
      starter: prev.starter.filter(it => it.uid !== uidStr),
      bench: prev.bench.filter(it => it.uid !== uidStr),
    }))
  }
  function addSignup() {
    setBoard(prev => ({ ...prev, signup: [...prev.signup, { uid: uid(), guestName: '', status: 'signed_up' }] }))
  }
  function addDirect(to: Container) {
    setBoard(prev => ({ ...prev, [to]: [...prev[to], { uid: uid(), guestName: '', status: 'present' }] }))
  }

  function buildBodies() {
    const slots = [
      ...board.starter.map((it, i) => ({
        playerId: it.playerId || undefined,
        guestName: it.playerId ? undefined : (it.guestName || undefined),
        battingOrder: i + 1, fieldPosition: it.fieldPosition || undefined, lineupStatus: 'starter',
      })),
      ...board.bench.map(it => ({
        playerId: it.playerId || undefined,
        guestName: it.playerId ? undefined : (it.guestName || undefined),
        lineupStatus: 'bench',
      })),
    ]
    const placed = [...board.starter, ...board.bench]
    const signups = [
      ...board.signup.map((it, i) => ({
        playerId: it.playerId || undefined,
        guestName: it.playerId ? undefined : (it.guestName || undefined),
        status: it.status, note: it.note || undefined, sortIndex: i,
      })),
      ...placed.map((it, i) => ({
        playerId: it.playerId || undefined,
        guestName: it.playerId ? undefined : (it.guestName || undefined),
        status: 'present', sortIndex: 1000 + i,
      })),
    ]
    return { rosterBody: { slots }, signupBody: { signups } }
  }

  async function save() {
    const { rosterBody, signupBody } = buildBodies()
    try {
      await api.signups.put(gameId!, signupBody)
      await api.roster.put(gameId!, rosterBody)
      toast.show('已儲存（草稿）'); setResult(null)
    } catch { toast.show('儲存失敗：每張卡需選一名球員或填一位路人。', 'error') }
  }
  async function validate() { await save(); setResult(await api.roster.validate(gameId!)) }
  async function confirm() {
    await save()
    try {
      await api.games.update(gameId!, { gameStatus: 'lineup_confirmed' })
      setResult({ valid: true, violations: [] }); toast.show('名單已確認'); reload()
    } catch (e: any) {
      if (e.status === 422 && e.body?.violations) setResult({ valid: false, violations: e.body.violations })
      else toast.show('確認失敗', 'error')
    }
  }

  if (!game) return null
  const starters = board.starter

  return (
    <section>
      {!loaded && <p role="status">載入中…</p>}
      {loaded && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="roster-board">
            {/* 報名清單 */}
            <Column id="signup" title="報名清單" hint="不驗證 · 候補池" items={board.signup}>
              {board.signup.map(it => (
                <Card key={it.uid} item={it} players={players} onPlayer={(pid) => update(it.uid, { playerId: pid, guestName: pid ? undefined : '' })}
                      onGuest={(n) => update(it.uid, { guestName: n })}>
                  <select aria-label="狀態" value={it.status} onChange={e => update(it.uid, { status: e.target.value })}>
                    {STATUS_KEYS.map(k => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
                  </select>
                  <Button variant="ghost" onClick={() => move(it.uid, 'starter')}>→先發</Button>
                  <Button variant="ghost" onClick={() => move(it.uid, 'bench')}>→替補</Button>
                  <Button variant="ghost" onClick={() => remove(it.uid)}>移除</Button>
                </Card>
              ))}
              <Button variant="ghost" onClick={addSignup}>＋ 報名 / 加候補</Button>
            </Column>

            {/* 出賽名單 */}
            <div className="roster-lineup">
              <Column id="starter" title="先發" hint="欄內上下拖改打序" items={board.starter}>
                {board.starter.map((it, i) => (
                  <Card key={it.uid} item={it} players={players} order={i + 1}
                        onPlayer={(pid) => update(it.uid, { playerId: pid, guestName: pid ? undefined : '' })}
                        onGuest={(n) => update(it.uid, { guestName: n })}>
                    <select aria-label="守位" value={it.fieldPosition ?? ''} onChange={e => update(it.uid, { fieldPosition: e.target.value || undefined })}>
                      <option value="">（守位）</option>
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Button variant="ghost" onClick={() => move(it.uid, 'bench')}>→替補</Button>
                    <Button variant="ghost" onClick={() => move(it.uid, 'signup')}>↩退回報名</Button>
                  </Card>
                ))}
                <Button variant="ghost" onClick={() => addDirect('starter')}>＋ 直接加入先發</Button>
              </Column>

              <Column id="bench" title="替補" hint="已到、待命" items={board.bench}>
                {board.bench.map(it => (
                  <Card key={it.uid} item={it} players={players}
                        onPlayer={(pid) => update(it.uid, { playerId: pid, guestName: pid ? undefined : '' })}
                        onGuest={(n) => update(it.uid, { guestName: n })}>
                    <Button variant="ghost" onClick={() => move(it.uid, 'starter')}>→先發</Button>
                    <Button variant="ghost" onClick={() => move(it.uid, 'signup')}>↩退回報名</Button>
                    <Button variant="ghost" onClick={() => remove(it.uid)}>移除</Button>
                  </Card>
                ))}
                <Button variant="ghost" onClick={() => addDirect('bench')}>＋ 直接加入替補</Button>
              </Column>
            </div>
          </div>

          <div className="inline-form" style={{ marginTop: 12 }}>
            <span role="status" className="muted">出賽 {starters.length + board.bench.length} 人（先發 {starters.length} / 替補 {board.bench.length}）</span>
            <Button variant="ghost" onClick={save}>儲存草稿</Button>
            <Button variant="ghost" onClick={validate}>驗證名單</Button>
            <Button onClick={confirm}>確認名單</Button>
          </div>

          {result && (
            <div style={{ marginTop: 16 }}>
              {result.valid
                ? <p role="status" className="ok">✓ 名單合法</p>
                : <div role="alert"><strong>名單不合法：</strong>
                    <ul>{result.violations.map((v, i) => <li key={i}>{v.message}</li>)}</ul>
                  </div>}
            </div>
          )}
        </DndContext>
      )}
    </section>
  )
}

function Column({ id, title, hint, items, children }:
  { id: Container; title: string; hint: string; items: Item[]; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div className="roster-col" ref={setNodeRef} data-col={id}>
      <div className="roster-col-head"><b>{title}</b><span className="muted">{hint}</span></div>
      <SortableContext items={items.map(it => it.uid)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  )
}

function Card({ item, players, order, onPlayer, onGuest, children }:
  { item: Item; players: any[]; order?: number; onPlayer: (pid?: string) => void; onGuest: (n: string) => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.uid })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="roster-card" data-card={keyOf(item)}>
      <span className="drag-handle" {...attributes} {...listeners} aria-label="拖拉" title="拖拉">⠿</span>
      {order != null && <b className="bo">{order}</b>}
      <select aria-label="球員" value={item.playerId ?? '__guest'}
              onChange={e => onPlayer(e.target.value === '__guest' ? undefined : e.target.value)}>
        <option value="__guest">路人…</option>
        {players.map(p => <option key={p.playerId} value={p.playerId}>{p.displayName}{p.uniformNumber ? ` #${p.uniformNumber}` : ''}</option>)}
      </select>
      {!item.playerId && <input placeholder="路人名稱" value={item.guestName ?? ''} onChange={e => onGuest(e.target.value)} />}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: append 看板樣式到 `games.css`**

```css
/* M4 出賽名單看板 */
.roster-board { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 14px; align-items: start; }
.roster-lineup { display: grid; grid-template-rows: auto auto; gap: 14px; }
.roster-col { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px; }
.roster-col[data-col="signup"] { border-style: dashed; }
.roster-col-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.roster-card { display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  background: var(--surface-alt); border-radius: var(--radius-sm); padding: 6px 8px; margin-bottom: 6px; }
.roster-card .bo { min-width: 1.2em; text-align: center; }
.drag-handle { cursor: grab; color: var(--muted); touch-action: none; user-select: none; }
@media (max-width: 720px) { .roster-board { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: build 確認**

Run: `cd frontend && npm run build`
Expected: 綠（tsc 無型別錯、vite build 過）。

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/game/LineupTab.tsx frontend/src/pages/games.css
git commit -m "feat(m4): LineupTab 兩欄拖拉看板（報名→出賽）（AC-B/C/D/G）"
```

---

## Task 5: E2E `m4-roster-signup.spec.ts`

**Files:**
- Create: `frontend/e2e/m4-roster-signup.spec.ts`

> 拖拉在 E2E 不穩，故主要用每張卡的移動按鈕（→先發/→替補/↩退回/移除）與下拉操作（這也是 AC-G 的鍵盤/無障礙路徑），驗證 AC-A~E 的資料面行為。

- [ ] **Step 1: 看既有 E2E 的登入/建隊/建賽 helper**

Read: `frontend/e2e/m3b-scoreboard-stats.spec.ts`（重用其 `register / 建隊 / 建球員 / 建賽 / 進 LineupTab` 的選擇器與流程；m4 spec 沿用同 helper 風格）。

- [ ] **Step 2: 寫 spec（沿用既有 helper 命名，補 m4 場景）**

```ts
import { test, expect } from '@playwright/test'

const email = (p: string) => `${p}_${Date.now()}@x.com`

async function setup(page: any) {
  // 沿用 m3b spec 的 register→建隊→建球員→建賽→進 LineupTab 流程
  // （實作時對齊 m3b-scoreboard-stats.spec.ts 既有 helper；此處列出 m4 專屬斷言）
}

test('報名清單不驗證、可拖入先發排打序、確認名單（AC-A/B/D/E）', async ({ page }) => {
  await setup(page)
  // AC-A：在報名清單加一名球員，設狀態，確認沒有彈出任何驗證錯誤
  await page.getByRole('button', { name: '＋ 報名 / 加候補' }).click()
  // 選球員（report 卡第一個 select）、設 status=遲到
  // ...（對齊既有 select 操作）
  await page.getByRole('button', { name: '儲存草稿' }).click()
  await expect(page.getByText('已儲存')).toBeVisible()

  // AC-B/D：把報名者「→先發」，設守位，驗證列出人數不足但不擋
  await page.getByRole('button', { name: '→先發' }).first().click()
  await page.getByRole('button', { name: '驗證名單' }).click()
  await expect(page.getByText('名單不合法')).toBeVisible() // 只有 1 人 → 人數不足等 violations

  // AC-E：補滿 9 名先發後確認 → lineup_confirmed
  // ...（重複「＋報名→→先發→設守位」補到合法）
  // await page.getByRole('button', { name: '確認名單' }).click()
  // await expect(page.getByText('名單已確認')).toBeVisible()
})

test('替補進出與退回報名（AC-C）', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: '＋ 直接加入替補' }).click()
  await expect(page.locator('.roster-col[data-col="bench"] .roster-card')).toHaveCount(1)
  await page.locator('.roster-col[data-col="bench"]').getByRole('button', { name: '→先發' }).click()
  await expect(page.locator('.roster-col[data-col="starter"] .roster-card')).toHaveCount(1)
  await page.locator('.roster-col[data-col="starter"]').getByRole('button', { name: '↩退回報名' }).click()
  await expect(page.locator('.roster-col[data-col="signup"] .roster-card')).toHaveCount(1)
})
```
> 實作時：`setup()` 直接複製 m3b spec 既有的 register→建賽→進 LineupTab helper；把上面 `...` 處對齊既有 select/option 操作補滿（含「補到 9 名合法先發再確認」的迴圈）。

- [ ] **Step 3: 跑 E2E（controller 集中跑；需後端+DB 已起）**

Run: `cd frontend && npx playwright test m4-roster-signup`
Expected: 2 passed（Playwright 自動起 vite :5200；後端 :5199 與 DB 需先活）。

- [ ] **Step 4: 全 E2E 回歸**

Run: `cd frontend && npx playwright test`
Expected: 既有 9 + m4 新增全綠（確認沒打壞 m2/m3 名單流程）。

- [ ] **Step 5: Commit**
```bash
git add frontend/e2e/m4-roster-signup.spec.ts
git commit -m "test(m4): E2E 報名清單→拖拉出賽名單（AC-A~E/G）"
```

---

## Task 6: 全量回歸 + 收尾

- [ ] **Step 1: 後端全測**
Run: `cd backend && mvn -o test`
Expected: 既有 90 + 新增 SignupControllerIT 全綠。

- [ ] **Step 2: 前端 build + 全 E2E**
Run: `cd frontend && npm run build && npx playwright test`
Expected: build 綠、E2E 全綠。

- [ ] **Step 3: 收尾**
交給 `superpowers:finishing-a-development-branch`（慣例＝ff 併 `main` + 刪 feature branch + 不 push）。

---

## Self-Review（對 spec 逐項）

- **AC-A**（報名加人/設狀態、不驗證）→ Task 2 `put_then_get_returns_signups`（狀態值域）＋ Task 5 場景一。✅
- **AC-B**（拖入先發、打序 1..N）→ Task 4 `onDragEnd`/`move` + `buildBodies` battingOrder=index+1；Task 5「→先發」。✅
- **AC-C**（替補進出、退回池、直接加入）→ Task 4 move/addDirect；Task 5 場景二。✅
- **AC-D**（守位＋驗證人數不足不擋存）→ Task 4 守位 select + `validate()` 走既有 `roster:validate`；`LineupValidator` 不改（Task 2 Step 7 回歸）。✅
- **AC-E**（確認→lineup_confirmed、可 revert 補遲到）→ Task 4 `confirm()` 走既有 `PATCH games`；revert 為既有行為。✅
- **AC-F**（資料分離＋created_by/no_show）→ Task 1 schema + Task 2 service（`created_by=userId`、status 含 `no_show`）。✅
- **AC-G**（touch/鍵盤）→ Task 4 PointerSensor(touch)+KeyboardSensor＋移動按鈕作鍵盤路徑；`touch-action:none` on handle。✅

**Placeholder scan：** Task 5 的 `setup()` 與補滿迴圈標為「對齊 m3b 既有 helper」——這是刻意重用既有測試骨架，非邏輯缺口；實作者照 m3b spec 複製即可。其餘步驟均有完整 code。

**Type consistency：** `SignupDto`(playerId/guestName/status/note/sortIndex) 在 entity/service/IT/前端 `buildBodies` 一致；`lineupStatus` starter|bench、`battingOrder` index+1 與後端既有 `LineupSlotDto` 對齊。
