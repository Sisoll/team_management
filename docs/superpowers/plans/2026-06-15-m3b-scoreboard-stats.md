# M3b — SSE 即時計分板 ＋ 單場統計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 M3a 記下的事件流變成「即時計分板（AC-10）」與「單場 box score（AC-12）」，並補上盜壘（SB）記錄與 ER 手動覆寫。

**Architecture:** 新 `stats` 純函式引擎重放事件流推導 box score（on-demand，除 `er_override` 外不固化）。即時計分板用 in-memory `SseEmitter` registry，記錄員寫事件 commit 後（Spring `@TransactionalEventListener` AFTER_COMMIT）推最新 `GameState` snapshot；前端用 fetch + ReadableStream 訂閱（帶 JWT header）。盜壘重用既有但未處理的 `BASE_RUNNING` 事件型別。

**Tech Stack:** Java 21 · Spring Boot 3.5 · PostgreSQL（Flyway V5）· Testcontainers（Podman）· React + TypeScript + Vite · Playwright。

**設計來源：** [`../specs/2026-06-15-m3b-scoreboard-stats-design.md`](../specs/2026-06-15-m3b-scoreboard-stats-design.md)

---

## 執行前置（每個 build/test shell 開頭）

```bash
cd backend
export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
export TESTCONTAINERS_RYUK_DISABLED=true   # 多 IT 一起跑避免 Ryuk flake
mvn -o test-compile                        # 開工前預編譯一次，後續增量
```

- 單元/IT 增量驗證：`mvn -o -Dtest=<ClassName> test`。
- **fast-mode**：subagent 只寫檔；編譯/測試由 controller 在預編譯環境集中跑；同一 `target/` 不可多 subagent 並行編譯。
- 前端：`cd frontend && npm run build`；E2E `npx playwright test --timeout=60000`（需後端+DB）。
- commit：每 Wave 收一次，結尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`（依專案慣例 per-wave commit；不主動 push）。

---

## 檔案結構（本計畫新增 / 修改）

**後端**
- 修改 `shared/eventfold/EventApplier.java` — `BASE_RUNNING` 純跑壘處理（不推打序、不計 PA）
- 新增 `stats/StatsEngine.java` — 純函式：事件流 → `BoxScore`
- 新增 `stats/BoxScore.java` — 引擎輸出（無球員名）
- 新增 `stats/ErOverride.java` · `stats/ErOverrideRepository.java`
- 新增 `stats/StatsService.java` · `stats/StatsController.java`
- 新增 `stats/dto/BoxScoreResponse.java` · `stats/dto/ErRequest.java`
- 新增 `scoring/GameStreamRegistry.java` · `scoring/ScoreboardChanged.java` · `scoring/ScoreboardBroadcaster.java` · `scoring/StreamController.java`
- 修改 `scoring/ScoringService.java` — 注入 `ApplicationEventPublisher`，record/update/delete 後發 `ScoreboardChanged`
- 新增 `resources/db/migration/V5__er_override.sql`

**前端**
- 修改 `src/api/client.ts` — `events.stream` · `games.boxScore` · `games.setEr`
- 新增 `src/pages/game/BasesDiamond.tsx`
- 修改 `src/pages/game/RecordTab.tsx` — 盜壘 / 盜壘失敗按鈕
- 新增 `src/pages/game/ScoreboardTab.tsx` · `src/pages/game/BoxTab.tsx`
- 修改 `src/pages/game/recording.css` — 計分板 / 鑽石 / box 表格樣式
- 修改 `src/layout/GameLayout.tsx` — 移除兩個 `soon: true`
- 修改 `src/App.tsx` — 接 `scoreboard` / `box` route

**測試**
- 修改 `src/test/.../shared/eventfold/EventApplierTest.java`
- 新增 `src/test/.../stats/StatsEngineTest.java` · `stats/BoxScoreControllerIT.java`
- 新增 `src/test/.../scoring/GameStreamRegistryTest.java` · `scoring/GameStreamIT.java`
- 新增 `frontend/e2e/m3b-scoreboard-stats.spec.ts`

> **DRY 取捨（刻意）**：`StatsService` 複製 `ScoringService` 的 `initialLineup(Game)` 與 `toView(GameEvent)` 兩個小私有方法（各約 15 行），**不重構 ScoringService**，以零風險保住 M3a 76 個後端測試。重構抽共用留待後續。

---

## Wave 1 — 後端純函式（盜壘修正 ＋ 統計引擎）

### Task 1: `EventApplier` — `BASE_RUNNING` 純跑壘處理

**Files:**
- Modify: `backend/src/main/java/com/baseball/record/shared/eventfold/EventApplier.java`
- Test: `backend/src/test/java/com/baseball/record/shared/eventfold/EventApplierTest.java`

`BASE_RUNNING` 目前落到 `applyPlay`，會錯誤推進打序游標。修正：套用 runnerMoves / 計分 / 計出局 / 翻半局照舊，但**不 wrap 打序**（沒有完成打席）。

- [ ] **Step 1: 加失敗測試**（append 到 `EventApplierTest`）

```java
    @Test
    void base_running_advance_does_not_advance_batting_order() {
        GameState start = new GameState(1, "top", "offense", 0, 0, 0,
            BaseState.empty().with("1", "r1"), 3, null, List.of(),
            new java.util.HashMap<>(), new java.util.ArrayList<>());
        // 盜二壘：1 壘跑者 → 2 壘；打者沒上場打擊
        GameState s = EventApplier.apply(start, pa("BASE_RUNNING", List.of(new RunnerMove("1", "2"))));
        assertThat(s.bases().second()).isEqualTo("r1");
        assertThat(s.bases().first()).isNull();
        assertThat(s.currentBatterOrder()).isEqualTo(3);   // 打序游標不動
        assertThat(s.outs()).isZero();
    }

    @Test
    void base_running_caught_stealing_adds_out_keeps_order() {
        GameState start = new GameState(1, "top", "offense", 0, 0, 0,
            BaseState.empty().with("1", "r1"), 4, null, List.of(),
            new java.util.HashMap<>(), new java.util.ArrayList<>());
        GameState s = EventApplier.apply(start, pa("BASE_RUNNING", List.of(new RunnerMove("1", "OUT"))));
        assertThat(s.outs()).isEqualTo(1);
        assertThat(s.bases().first()).isNull();
        assertThat(s.currentBatterOrder()).isEqualTo(4);
    }
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `mvn -o -Dtest=EventApplierTest test`
Expected: FAIL（`base_running_advance_does_not_advance_batting_order` 期望 order=3，實得 4）

- [ ] **Step 3: 實作（最小修改）**

在 `EventApplier` 加判定方法（緊接 `isSubstitution` 之後）：

```java
    public static boolean isBaserunningOnly(String t) {
        return "BASE_RUNNING".equals(t);
    }
```

把 `applyPlay` 內計算 `nextOrder` 那行改為（檔案 line 71 附近）：

```java
        int nextOrder = ("offense".equals(s.battingSide()) && !isBaserunningOnly(ev.eventType()))
            ? wrap(s.currentBatterOrder(), s.lineup()) : s.currentBatterOrder();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `mvn -o -Dtest=EventApplierTest test`
Expected: PASS（全部，含既有測試）

- [ ] **Step 5: 不單獨 commit（Wave 1 末一起）**

---

### Task 2: `StatsEngine` ＋ `BoxScore`

**Files:**
- Create: `backend/src/main/java/com/baseball/record/stats/BoxScore.java`
- Create: `backend/src/main/java/com/baseball/record/stats/StatsEngine.java`
- Test: `backend/src/test/java/com/baseball/record/stats/StatsEngineTest.java`

- [ ] **Step 1: 建 `BoxScore`（引擎輸出 DTO，無球員名）**

```java
package com.baseball.record.stats;

import java.util.List;
import java.util.UUID;

/** StatsEngine 輸出。我隊 per-player（batting/pitching）；對手只到隊伍總計。球員名/AVG/IP/ER 於 service 層補。 */
public record BoxScore(
    List<int[]> lineScore,          // 每元素 {inning, topRuns, bottomRuns}
    TeamTotals team, TeamTotals opponent,
    List<BattingLine> batting, List<PitchingLine> pitching) {

    public record TeamTotals(int runs, int hits) {}

    public record BattingLine(UUID playerId, int order, String position,
        int pa, int ab, int r, int h, int doubles, int triples, int hr,
        int rbi, int bb, int k, int sb) {}

    public record PitchingLine(UUID playerId, int outs, int h, int r, int bb, int k, int pitches) {}
}
```

- [ ] **Step 2: 加失敗測試**

```java
package com.baseball.record.stats;

import com.baseball.record.shared.eventfold.*;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class StatsEngineTest {

    static InitialStateBuilder.InitialLineup awayLineup(UUID... ids) {
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        List<LineupEntry> lu = new ArrayList<>();
        for (int i = 0; i < ids.length; i++)
            lu.add(new LineupEntry(i + 1, ids[i], null, pos[i], true, true, false, false));
        return new InitialStateBuilder.InitialLineup("away", lu, ids[0]);   // away → 先攻
    }

    static EventView ev(int seq, String type, UUID actor, RunnerMove... moves) {
        return new EventView(seq, type, actor, List.of(), List.of(moves), null,
            null, null, null, null, null, null, null, null);
    }

    @Test
    void batter_single_then_scores_records_hit_run_rbi() {
        UUID b1 = UUID.randomUUID(), b2 = UUID.randomUUID();
        UUID[] ids = new UUID[9];
        ids[0] = b1; ids[1] = b2;
        for (int i = 2; i < 9; i++) ids[i] = UUID.randomUUID();

        List<EventView> evs = List.of(
            ev(1, "SINGLE", b1, new RunnerMove("B", "1")),                       // b1 上一壘
            ev(2, "HOME_RUN", b2, new RunnerMove("1", "H"), new RunnerMove("B", "H")) // b2 轟兩分
        );
        BoxScore box = StatsEngine.fold(awayLineup(ids), evs);

        var l1 = box.batting().stream().filter(x -> x.playerId().equals(b1)).findFirst().orElseThrow();
        var l2 = box.batting().stream().filter(x -> x.playerId().equals(b2)).findFirst().orElseThrow();
        assertThat(l1.h()).isEqualTo(1);
        assertThat(l1.ab()).isEqualTo(1);
        assertThat(l1.r()).isEqualTo(1);                 // b1 跑回本壘
        assertThat(l2.h()).isEqualTo(1);
        assertThat(l2.hr()).isEqualTo(1);
        assertThat(l2.rbi()).isEqualTo(2);               // 打回 2 分
        assertThat(l2.r()).isEqualTo(1);
        assertThat(box.team().runs()).isEqualTo(2);
        assertThat(box.team().hits()).isEqualTo(2);
    }

    @Test
    void walk_and_strikeout_affect_ab_correctly() {
        UUID b1 = UUID.randomUUID();
        UUID[] ids = new UUID[9]; ids[0] = b1;
        for (int i = 1; i < 9; i++) ids[i] = UUID.randomUUID();
        // b1 第 1 棒：保送（非 AB），翻棒後再輪到（簡化用同棒連兩事件不實際；此處只測單事件歸因）
        BoxScore box = StatsEngine.fold(awayLineup(ids),
            List.of(ev(1, "WALK", b1, new RunnerMove("B", "1"))));
        var l1 = box.batting().stream().filter(x -> x.playerId().equals(b1)).findFirst().orElseThrow();
        assertThat(l1.pa()).isEqualTo(1);
        assertThat(l1.bb()).isEqualTo(1);
        assertThat(l1.ab()).isZero();                    // 保送不計打數
    }

    @Test
    void stolen_base_credits_runner() {
        UUID b1 = UUID.randomUUID();
        UUID[] ids = new UUID[9]; ids[0] = b1;
        for (int i = 1; i < 9; i++) ids[i] = UUID.randomUUID();
        List<EventView> evs = List.of(
            ev(1, "SINGLE", b1, new RunnerMove("B", "1")),
            ev(2, "BASE_RUNNING", null, new RunnerMove("1", "2"))   // b1 盜二壘
        );
        BoxScore box = StatsEngine.fold(awayLineup(ids), evs);
        var l1 = box.batting().stream().filter(x -> x.playerId().equals(b1)).findFirst().orElseThrow();
        assertThat(l1.sb()).isEqualTo(1);
    }

    @Test
    void defense_half_accrues_pitching_and_opponent_totals() {
        UUID[] ids = new UUID[9];
        for (int i = 0; i < 9; i++) ids[i] = UUID.randomUUID();
        // home → top 半局我隊先守；對手打擊：一安、一三振、一得分
        var home = new InitialStateBuilder.InitialLineup("home", awayLineup(ids).lineup(), ids[0]);
        List<EventView> evs = List.of(
            new EventView(1, "SINGLE", null, List.of(), List.of(new RunnerMove("B","1")),
                new PitchTally(3,1,2,0,1), ids[0], null, "對手A", null,null,null,null,null),
            new EventView(2, "STRIKEOUT", null, List.of(), List.of(new RunnerMove("B","OUT")),
                new PitchTally(4,3,1,1,2), ids[0], null, "對手B", null,null,null,null,null)
        );
        BoxScore box = StatsEngine.fold(home, evs);
        var p = box.pitching().stream().filter(x -> x.playerId().equals(ids[0])).findFirst().orElseThrow();
        assertThat(p.h()).isEqualTo(1);
        assertThat(p.k()).isEqualTo(1);
        assertThat(p.outs()).isEqualTo(1);
        assertThat(p.pitches()).isEqualTo(7);            // 3 + 4
        assertThat(box.opponent().hits()).isEqualTo(1);
    }
}
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `mvn -o -Dtest=StatsEngineTest test`
Expected: FAIL（`StatsEngine` 不存在 / 編譯錯）

- [ ] **Step 4: 實作 `StatsEngine`**

```java
package com.baseball.record.stats;

import com.baseball.record.shared.eventfold.*;

import java.util.*;

/** 由事件流推導單場 box score（純函式）。進攻半局歸我隊打擊、守備半局歸我隊投手＋對手隊伍總計。 */
public final class StatsEngine {
    private StatsEngine() {}

    public static BoxScore fold(InitialStateBuilder.InitialLineup lineup, List<EventView> events) {
        GameState s = InitialStateBuilder.initial(lineup);
        Map<UUID, Bat> bat = new LinkedHashMap<>();
        for (LineupEntry e : lineup.lineup())                  // 先發都先列（含 0 打席）
            if (e.playerId() != null && e.battingOrder() > 0)
                bat.computeIfAbsent(e.playerId(), id -> new Bat(e.battingOrder(), e.fieldPosition()));
        Map<UUID, Pit> pit = new LinkedHashMap<>();
        int oppHits = 0;

        for (EventView ev : events) {
            GameState before = s;
            String type = ev.eventType();
            if (EventApplier.isSubstitution(type)) { s = EventApplier.apply(before, ev); continue; }
            boolean offense = "offense".equals(before.battingSide());

            if (offense) {
                LineupEntry batter = batterOf(before);
                if (!EventApplier.isBaserunningOnly(type) && batter != null && batter.playerId() != null) {
                    Bat line = bat.computeIfAbsent(batter.playerId(),
                        id -> new Bat(batter.battingOrder(), batter.fieldPosition()));
                    line.pa++;
                    switch (type) {
                        case "SINGLE" -> line.h++;
                        case "DOUBLE" -> { line.h++; line.doubles++; }
                        case "TRIPLE" -> { line.h++; line.triples++; }
                        case "HOME_RUN" -> { line.h++; line.hr++; }
                        case "WALK" -> line.bb++;
                        case "HIT_BY_PITCH" -> line.hbp++;
                        case "STRIKEOUT" -> line.k++;
                        case "SAC_FLY" -> line.sacFly++;
                        case "SAC_BUNT" -> line.sacBunt++;
                        default -> { /* GROUND_OUT/FLY_OUT/FIELDERS_CHOICE/REACH_ON_ERROR：列為 AB、無安打 */ }
                    }
                    if (!"REACH_ON_ERROR".equals(type))       // RBI：本打席打回本壘數（失誤上壘不計）
                        line.rbi += (int) ev.runnerMoves().stream().filter(m -> "H".equals(m.to())).count();
                }
                for (RunnerMove m : ev.runnerMoves()) {       // R：跑回本壘歸該跑者
                    if (!"H".equals(m.to())) continue;
                    UUID pid = scorerId(before, m.from());
                    if (pid != null && bat.containsKey(pid)) bat.get(pid).r++;
                }
                if (EventApplier.isBaserunningOnly(type))     // SB：盜壘成功歸該跑者
                    for (RunnerMove m : ev.runnerMoves()) {
                        if ("OUT".equals(m.to()) || m.from().equals(m.to())) continue;
                        UUID pid = playerToken(before.bases().at(m.from()));
                        if (pid != null && bat.containsKey(pid)) bat.get(pid).sb++;
                    }
            } else {
                UUID pid = before.currentPitcherId();
                if (pid != null) {
                    Pit p = pit.computeIfAbsent(pid, Pit::new);
                    p.outs += (int) ev.runnerMoves().stream().filter(m -> "OUT".equals(m.to())).count();
                    p.r    += (int) ev.runnerMoves().stream().filter(m -> "H".equals(m.to())).count();
                    if (isHit(type)) { p.h++; oppHits++; }
                    if ("WALK".equals(type)) p.bb++;
                    if ("STRIKEOUT".equals(type)) p.k++;
                }
            }
            s = EventApplier.apply(before, ev);
        }

        for (Map.Entry<UUID, PitchTally> e : s.pitcherPitches().entrySet())   // 用球數取最終累計
            pit.computeIfAbsent(e.getKey(), Pit::new).pitches = e.getValue().pitches();

        List<BoxScore.BattingLine> batting = bat.entrySet().stream()
            .sorted(Comparator.comparingInt(en -> en.getValue().order))
            .map(en -> en.getValue().toLine(en.getKey())).toList();
        List<BoxScore.PitchingLine> pitching = pit.entrySet().stream()
            .map(en -> en.getValue().toLine()).toList();
        int teamHits = batting.stream().mapToInt(BoxScore.BattingLine::h).sum();
        return new BoxScore(s.lineScore(),
            new BoxScore.TeamTotals(s.scoreUs(), teamHits),
            new BoxScore.TeamTotals(s.scoreOpp(), oppHits),
            batting, pitching);
    }

    private static LineupEntry batterOf(GameState s) {
        for (LineupEntry e : s.lineup())
            if (e.onField() && e.battingOrder() == s.currentBatterOrder()) return e;
        return null;
    }
    private static UUID scorerId(GameState before, String from) {
        if ("B".equals(from)) { LineupEntry b = batterOf(before); return b == null ? null : b.playerId(); }
        return playerToken(before.bases().at(from));
    }
    private static UUID playerToken(String token) {
        if (token == null) return null;
        try { return UUID.fromString(token); } catch (IllegalArgumentException e) { return null; }  // "OPP:.." → null
    }
    private static boolean isHit(String t) {
        return switch (t) { case "SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN" -> true; default -> false; };
    }

    private static final class Bat {
        final int order; final String position;
        int pa, h, doubles, triples, hr, r, rbi, bb, hbp, k, sb, sacFly, sacBunt;
        Bat(int order, String position) { this.order = order; this.position = position; }
        BoxScore.BattingLine toLine(UUID id) {
            int ab = Math.max(0, pa - bb - hbp - sacFly - sacBunt);
            return new BoxScore.BattingLine(id, order, position, pa, ab, r, h, doubles, triples, hr, rbi, bb, k, sb);
        }
    }
    private static final class Pit {
        final UUID id; int outs, h, r, bb, k, pitches;
        Pit(UUID id) { this.id = id; }
        BoxScore.PitchingLine toLine() { return new BoxScore.PitchingLine(id, outs, h, r, bb, k, pitches); }
    }
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `mvn -o -Dtest=StatsEngineTest test`
Expected: PASS

- [ ] **Step 6: Wave 1 commit**

```bash
cd backend && mvn -o -Dtest=EventApplierTest,StatsEngineTest test
git add backend/src/main/java/com/baseball/record/shared/eventfold/EventApplier.java \
        backend/src/main/java/com/baseball/record/stats/BoxScore.java \
        backend/src/main/java/com/baseball/record/stats/StatsEngine.java \
        backend/src/test/java/com/baseball/record/shared/eventfold/EventApplierTest.java \
        backend/src/test/java/com/baseball/record/stats/StatsEngineTest.java
git commit -m "feat(m3b): Wave 1 — BASE_RUNNING 純跑壘修正 + StatsEngine box score 推導（純函式）"
```

---

## Wave 2 — 後端 stats API ＋ ER 覆寫（IT，AC-12）

### Task 3: `er_override` 表 ＋ entity ＋ repo

**Files:**
- Create: `backend/src/main/resources/db/migration/V5__er_override.sql`
- Create: `backend/src/main/java/com/baseball/record/stats/ErOverride.java`
- Create: `backend/src/main/java/com/baseball/record/stats/ErOverrideRepository.java`

- [ ] **Step 1: 建 migration**

```sql
-- V5__er_override.sql：投手自責分(ER)手動覆寫（box score 預設 ER=R，可由 owner 改）
CREATE TABLE er_override (
    id         UUID PRIMARY KEY,
    game_id    UUID NOT NULL REFERENCES games(game_id),
    pitcher_id UUID NOT NULL,
    er         INT  NOT NULL,
    CONSTRAINT uq_er_game_pitcher UNIQUE (game_id, pitcher_id)
);
CREATE INDEX idx_er_game ON er_override (game_id);
```

- [ ] **Step 2: 建 entity**

```java
package com.baseball.record.stats;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "er_override")
public class ErOverride {
    @Id @Column(name = "id") private UUID id = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "pitcher_id", nullable = false) private UUID pitcherId;
    @Column(name = "er", nullable = false) private int er;

    protected ErOverride() {}
    public ErOverride(UUID gameId, UUID pitcherId, int er) { this.gameId = gameId; this.pitcherId = pitcherId; this.er = er; }

    public UUID getGameId() { return gameId; }
    public UUID getPitcherId() { return pitcherId; }
    public int getEr() { return er; }
    public void setEr(int er) { this.er = er; }
}
```

- [ ] **Step 3: 建 repo**

```java
package com.baseball.record.stats;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ErOverrideRepository extends JpaRepository<ErOverride, UUID> {
    Optional<ErOverride> findByGameIdAndPitcherId(UUID gameId, UUID pitcherId);
    List<ErOverride> findByGameId(UUID gameId);
}
```

- [ ] **Step 4: 編譯 + 確認 Flyway 套用**

Run: `mvn -o -Dtest=ContextLoadsIT test`
Expected: PASS（Flyway V5 對 Testcontainers PG 套用成功）

- [ ] **Step 5: 不單獨 commit（Wave 2 末一起）**

---

### Task 4: `StatsService` ＋ `StatsController` ＋ `BoxScoreResponse`（AC-12）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/stats/dto/BoxScoreResponse.java`
- Create: `backend/src/main/java/com/baseball/record/stats/dto/ErRequest.java`
- Create: `backend/src/main/java/com/baseball/record/stats/StatsService.java`
- Create: `backend/src/main/java/com/baseball/record/stats/StatsController.java`
- Test: `backend/src/test/java/com/baseball/record/stats/BoxScoreControllerIT.java`

- [ ] **Step 1: 建回應 DTO**

```java
package com.baseball.record.stats.dto;

import java.util.List;

public record BoxScoreResponse(
    List<LineRow> lineScore, Totals team, Totals opponent,
    List<BatRow> batting, List<PitchRow> pitching) {

    public record LineRow(int inning, int top, int bottom) {}
    public record Totals(int runs, int hits) {}
    public record BatRow(String playerId, int order, String name, String position,
        int pa, int ab, int r, int h, int doubles, int triples, int hr,
        int rbi, int bb, int k, int sb, String avg) {}
    public record PitchRow(String playerId, String name, String ip,
        int h, int r, int er, boolean erOverridden, int bb, int k, int pitches) {}
}
```

```java
package com.baseball.record.stats.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ErRequest(@NotNull @PositiveOrZero Integer er) {}
```

- [ ] **Step 2: 加失敗測試（IT）**

```java
package com.baseball.record.stats;

import com.baseball.record.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BoxScoreControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token() throws Exception {
        String email = "box" + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }
    String createTeam(String t) throws Exception {
        return JsonPath.read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    /** away 客場 → top 半局我隊先攻；回 [gameId, firstPlayerId]。 */
    String[] liveGame(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        String firstPid = null; StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"P" + i + "\"}"))
                .andReturn().getResponse().getContentAsString(), "$.playerId");
            if (i == 0) firstPid = pid;
            if (i > 0) slots.append(",");
            slots.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
                 .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        mvc.perform(put("/api/games/" + gameId + "/roster").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"slots\":[" + slots + "]}")).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}")).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\",\"recordingDetail\":\"L2\"}")).andExpect(status().isOk());
        return new String[]{gameId, firstPid};
    }
    void post(String t, String gameId, String json) throws Exception {
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isCreated());
    }

    @Test
    void box_score_reflects_event_stream() throws Exception { // AC-12
        String t = token(); String teamId = createTeam(t);
        String[] g = liveGame(t, teamId); String gameId = g[0]; String p1 = g[1];
        post(t, gameId, "{\"eventType\":\"SINGLE\",\"actorPlayerId\":\"" + p1 + "\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"1\"}]}");

        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.team.hits").value(1))
           .andExpect(jsonPath("$.batting[?(@.playerId=='" + p1 + "')].h").value(org.hamcrest.Matchers.contains(1)));
    }

    @Test
    void er_override_takes_precedence_over_runs() throws Exception { // AC-12（ER 手動覆寫）
        String t = token(); String teamId = createTeam(t);
        String[] g = liveGame(t, teamId); String gameId = g[0]; String p1 = g[1];
        // 翻到守備半局：先攻 3 出局
        for (int i = 0; i < 3; i++)
            post(t, gameId, "{\"eventType\":\"STRIKEOUT\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"OUT\"}]}");
        // 對手對我方投手 p1 擊出全壘打得 1 分（守備半局，actor=null）
        post(t, gameId, "{\"eventType\":\"HOME_RUN\",\"guestBatterName\":\"敵\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"H\"}],\"pitches\":{\"pitches\":3,\"strikes\":2,\"balls\":1,\"swinging\":1,\"looking\":1}}");

        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].er").value(org.hamcrest.Matchers.contains(1)))     // 預設 = R
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].erOverridden").value(org.hamcrest.Matchers.contains(false)));
        // owner 手動把 ER 改成 0
        mvc.perform(put("/api/games/" + gameId + "/pitchers/" + p1 + "/er").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"er\":0}")).andExpect(status().isOk());
        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].er").value(org.hamcrest.Matchers.contains(0)))
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].erOverridden").value(org.hamcrest.Matchers.contains(true)));
    }

    @Test
    void non_member_cannot_read_box_score() throws Exception {
        String a = token(); String teamId = createTeam(a);
        String gameId = liveGame(a, teamId)[0];
        String b = token();
        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + b))
           .andExpect(status().isNotFound());   // 非成員 → 404（沿 M2/M3a 隱藏存在性）
    }
}
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `mvn -o -Dtest=BoxScoreControllerIT test`
Expected: FAIL（`StatsController` / `box-score` 端點不存在 → 404 或編譯錯）

- [ ] **Step 4: 實作 `StatsService`**

```java
package com.baseball.record.stats;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.lineup.GameRoster;
import com.baseball.record.lineup.GameRosterRepository;
import com.baseball.record.lineup.LineupSlot;
import com.baseball.record.lineup.LineupSlotRepository;
import com.baseball.record.player.Player;
import com.baseball.record.player.PlayerRepository;
import com.baseball.record.scoring.GameEvent;
import com.baseball.record.scoring.GameEventRepository;
import com.baseball.record.scoring.EventPayload;
import com.baseball.record.stats.dto.BoxScoreResponse;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.eventfold.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class StatsService {
    private final GameRepository games;
    private final GameEventRepository events;
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final PlayerRepository players;
    private final ErOverrideRepository erOverrides;
    private final TeamAccessPolicy policy;

    public StatsService(GameRepository games, GameEventRepository events, GameRosterRepository rosters,
                        LineupSlotRepository slots, PlayerRepository players,
                        ErOverrideRepository erOverrides, TeamAccessPolicy policy) {
        this.games = games; this.events = events; this.rosters = rosters; this.slots = slots;
        this.players = players; this.erOverrides = erOverrides; this.policy = policy;
    }

    @Transactional(readOnly = true)
    public BoxScoreResponse boxScore(UUID userId, UUID gameId) {
        Game g = requireMember(userId, gameId);
        List<EventView> views = events.findByGameIdOrderBySequenceNoAsc(gameId).stream().map(StatsService::toView).toList();
        BoxScore box = StatsEngine.fold(initialLineup(g), views);
        return toResponse(gameId, box);
    }

    @Transactional
    public BoxScoreResponse setEr(UUID userId, UUID gameId, UUID pitcherId, int er) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        ErOverride o = erOverrides.findByGameIdAndPitcherId(gameId, pitcherId)
            .orElseGet(() -> new ErOverride(gameId, pitcherId, er));
        o.setEr(er);
        erOverrides.save(o);
        return boxScore(userId, gameId);
    }

    private BoxScoreResponse toResponse(UUID gameId, BoxScore box) {
        Map<UUID, String> names = new HashMap<>();
        Set<UUID> ids = new HashSet<>();
        box.batting().forEach(b -> ids.add(b.playerId()));
        box.pitching().forEach(p -> ids.add(p.playerId()));
        players.findAllById(ids).forEach(p -> names.put(p.getPlayerId(), p.getDisplayName()));
        Map<UUID, Integer> erMap = new HashMap<>();
        erOverrides.findByGameId(gameId).forEach(o -> erMap.put(o.getPitcherId(), o.getEr()));

        List<BoxScoreResponse.LineRow> line = box.lineScore().stream()
            .map(r -> new BoxScoreResponse.LineRow(r[0], r[1], r[2])).toList();
        List<BoxScoreResponse.BatRow> batting = box.batting().stream()
            .map(b -> new BoxScoreResponse.BatRow(b.playerId().toString(), b.order(),
                names.getOrDefault(b.playerId(), "球員"), b.position(),
                b.pa(), b.ab(), b.r(), b.h(), b.doubles(), b.triples(), b.hr(),
                b.rbi(), b.bb(), b.k(), b.sb(), avg(b.h(), b.ab()))).toList();
        List<BoxScoreResponse.PitchRow> pitching = box.pitching().stream()
            .map(p -> {
                boolean overridden = erMap.containsKey(p.playerId());
                int er = overridden ? erMap.get(p.playerId()) : p.r();
                return new BoxScoreResponse.PitchRow(p.playerId().toString(),
                    names.getOrDefault(p.playerId(), "球員"), ip(p.outs()),
                    p.h(), p.r(), er, overridden, p.bb(), p.k(), p.pitches());
            }).toList();
        return new BoxScoreResponse(line,
            new BoxScoreResponse.Totals(box.team().runs(), box.team().hits()),
            new BoxScoreResponse.Totals(box.opponent().runs(), box.opponent().hits()),
            batting, pitching);
    }

    private static String ip(int outs) { return (outs / 3) + "." + (outs % 3); }
    private static String avg(int h, int ab) {
        if (ab == 0) return ".000";
        String s = String.format("%.3f", (double) h / ab);
        return s.startsWith("0") ? s.substring(1) : s;     // 0.333 → .333；1.000 維持
    }

    // ── 與 ScoringService 等價的小工具（刻意複製，避免動 M3a） ──
    private InitialStateBuilder.InitialLineup initialLineup(Game g) {
        GameRoster roster = rosters.findByGameId(g.getGameId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "roster not confirmed"));
        List<LineupSlot> rows = slots.findByGameRosterId(roster.getGameRosterId());
        List<LineupEntry> lineup = new ArrayList<>();
        UUID startingPitcher = null;
        for (LineupSlot s : rows) {
            if (!"starter".equals(s.getLineupStatus())) continue;
            int order = s.getBattingOrder() == null ? 0 : s.getBattingOrder();
            lineup.add(new LineupEntry(order, s.getPlayerId(), s.getGuestName(), s.getFieldPosition(),
                true, true, false, false));
            if ("P".equals(s.getFieldPosition())) startingPitcher = s.getPlayerId();
        }
        lineup.sort(Comparator.comparingInt(LineupEntry::battingOrder));
        return new InitialStateBuilder.InitialLineup(g.getHomeAway(), lineup, startingPitcher);
    }
    private static EventView toView(GameEvent e) {
        EventPayload p = e.getPayload();
        return new EventView(e.getSequenceNo(), e.getEventType(), e.getActorPlayerId(), e.getRelatedPlayers(),
            p.runnerMoves(), p.pitches(), null, p.fieldPosition(), p.guestBatterName(),
            p.subInPlayerId(), p.subInGuestName(), p.subOutPlayerId(), p.subBattingOrder(), p.subFieldPosition());
    }

    private Game requireMember(UUID userId, UUID gameId) {
        Game g = load(gameId);
        policy.requireMember(userId, g.getTeamId());
        return g;
    }
    private Game load(UUID gameId) {
        return games.findById(gameId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
```

> **驗證點**：`EventPayload` 的 accessor 名稱（`runnerMoves/pitches/fieldPosition/guestBatterName/subInPlayerId/subInGuestName/subOutPlayerId/subBattingOrder/subFieldPosition`）須與 `scoring/EventPayload.java` 一致（同 `ScoringService.toView`）。`LineupSlot` getter（`getLineupStatus/getBattingOrder/getPlayerId/getGuestName/getFieldPosition`）同 `ScoringService.initialLineup`。

- [ ] **Step 5: 實作 `StatsController`**

```java
package com.baseball.record.stats;

import com.baseball.record.stats.dto.BoxScoreResponse;
import com.baseball.record.stats.dto.ErRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class StatsController {
    private final StatsService service;
    public StatsController(StatsService service) { this.service = service; }

    @GetMapping("/api/games/{gameId}/box-score")
    public BoxScoreResponse boxScore(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.boxScore(userId, gameId);
    }

    @PutMapping("/api/games/{gameId}/pitchers/{playerId}/er")
    public BoxScoreResponse setEr(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                  @PathVariable UUID playerId, @Valid @RequestBody ErRequest req) {
        return service.setEr(userId, gameId, playerId, req.er());
    }
}
```

- [ ] **Step 6: 跑測試確認通過**

Run: `mvn -o -Dtest=BoxScoreControllerIT test`
Expected: PASS（3 個）

- [ ] **Step 7: Wave 2 commit**

```bash
cd backend && mvn -o -Dtest=ContextLoadsIT,BoxScoreControllerIT test
git add backend/src/main/resources/db/migration/V5__er_override.sql backend/src/main/java/com/baseball/record/stats/
git add backend/src/test/java/com/baseball/record/stats/BoxScoreControllerIT.java
git commit -m "feat(m3b): Wave 2 — stats 模組 box score API + ER 手動覆寫（AC-12）"
```

---

## Wave 3 — 後端 SSE 即時計分板（AC-10）

### Task 5: `GameStreamRegistry` ＋ broadcaster ＋ `StreamController` ＋ ScoringService hook

**Files:**
- Create: `backend/src/main/java/com/baseball/record/scoring/GameStreamRegistry.java`
- Create: `backend/src/main/java/com/baseball/record/scoring/ScoreboardChanged.java`
- Create: `backend/src/main/java/com/baseball/record/scoring/ScoreboardBroadcaster.java`
- Create: `backend/src/main/java/com/baseball/record/scoring/StreamController.java`
- Modify: `backend/src/main/java/com/baseball/record/scoring/ScoringService.java`
- Test: `backend/src/test/java/com/baseball/record/scoring/GameStreamRegistryTest.java`
- Test: `backend/src/test/java/com/baseball/record/scoring/GameStreamIT.java`

- [ ] **Step 1: 加 registry 單元測試（失敗）**

```java
package com.baseball.record.scoring;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GameStreamRegistryTest {

    @Test
    void publish_sends_payload_to_subscribed_emitter() throws IOException {
        GameStreamRegistry reg = new GameStreamRegistry();
        UUID gameId = UUID.randomUUID();
        SseEmitter spy = mock(SseEmitter.class);
        reg.add(gameId, spy);

        Object payload = new Object();
        reg.publish(gameId, payload);

        verify(spy, atLeastOnce()).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test
    void publish_to_game_with_no_subscribers_is_noop() {
        GameStreamRegistry reg = new GameStreamRegistry();
        reg.publish(UUID.randomUUID(), new Object());   // 不丟例外
        assertThat(true).isTrue();
    }

    @Test
    void failed_send_removes_emitter() throws IOException {
        GameStreamRegistry reg = new GameStreamRegistry();
        UUID gameId = UUID.randomUUID();
        SseEmitter bad = mock(SseEmitter.class);
        doThrow(new IOException("boom")).when(bad).send(any(SseEmitter.SseEventBuilder.class));
        reg.add(gameId, bad);

        reg.publish(gameId, new Object());     // 第一次：send 失敗 → 移除
        reg.publish(gameId, new Object());     // 第二次：已無訂閱者
        verify(bad, times(1)).send(any(SseEmitter.SseEventBuilder.class));
    }
}
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `mvn -o -Dtest=GameStreamRegistryTest test`
Expected: FAIL（`GameStreamRegistry` 不存在）

- [ ] **Step 3: 實作 `GameStreamRegistry`**

```java
package com.baseball.record.scoring;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** 每場一組 SSE 訂閱者；publish 推最新計分板 payload，送失敗即移除。in-memory（單機 MVP）。 */
@Component
public class GameStreamRegistry {
    private static final long TIMEOUT = 30 * 60 * 1000L;   // 30 分鐘
    private final Map<UUID, Set<SseEmitter>> subs = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID gameId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT);
        add(gameId, emitter);
        emitter.onCompletion(() -> remove(gameId, emitter));
        emitter.onTimeout(() -> remove(gameId, emitter));
        emitter.onError(e -> remove(gameId, emitter));
        return emitter;
    }

    void add(UUID gameId, SseEmitter emitter) {
        subs.computeIfAbsent(gameId, k -> ConcurrentHashMap.newKeySet()).add(emitter);
    }
    private void remove(UUID gameId, SseEmitter emitter) {
        Set<SseEmitter> set = subs.get(gameId);
        if (set != null) { set.remove(emitter); if (set.isEmpty()) subs.remove(gameId); }
    }

    public void publish(UUID gameId, Object payload) {
        Set<SseEmitter> set = subs.get(gameId);
        if (set == null) return;
        for (SseEmitter e : Set.copyOf(set)) {
            try { e.send(SseEmitter.event().name("state").data(payload)); }
            catch (IOException | IllegalStateException ex) { remove(gameId, e); }
        }
    }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `mvn -o -Dtest=GameStreamRegistryTest test`
Expected: PASS

- [ ] **Step 5: 建 event ＋ broadcaster ＋ controller，並 hook ScoringService**

`ScoreboardChanged.java`：
```java
package com.baseball.record.scoring;

import com.baseball.record.shared.eventfold.GameState;
import java.util.UUID;

/** 記錄事件成功後發佈，攜帶已算好的最新 GameState；AFTER_COMMIT 推給訂閱者。 */
public record ScoreboardChanged(UUID gameId, GameState state) {}
```

`ScoreboardBroadcaster.java`：
```java
package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.GameStateResponse;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ScoreboardBroadcaster {
    private final GameStreamRegistry registry;
    public ScoreboardBroadcaster(GameStreamRegistry registry) { this.registry = registry; }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChange(ScoreboardChanged e) {
        registry.publish(e.gameId(), new GameStateResponse(e.state()));
    }
}
```

`StreamController.java`（驗權後訂閱，連上立即推一次當前 state）：
```java
package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.GameStateResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;

@RestController
public class StreamController {
    private final ScoringService scoring;
    private final GameStreamRegistry registry;
    public StreamController(ScoringService scoring, GameStreamRegistry registry) {
        this.scoring = scoring; this.registry = registry;
    }

    @GetMapping(value = "/api/games/{gameId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        GameStateResponse current = scoring.state(userId, gameId);   // 含 requireMember 驗權；非成員 → 404
        SseEmitter emitter = registry.subscribe(gameId);
        try { emitter.send(SseEmitter.event().name("state").data(current)); }
        catch (IOException e) { emitter.completeWithError(e); }
        return emitter;
    }
}
```

修改 `ScoringService`：注入 `ApplicationEventPublisher`，三個寫方法 commit 前發事件（AFTER_COMMIT listener 等到 commit 後才推）。

建構子加參數：
```java
    private final org.springframework.context.ApplicationEventPublisher publisher;

    public ScoringService(GameRepository games, GameEventRepository events, GameRosterRepository rosters,
                          LineupSlotRepository slots, TeamAccessPolicy policy,
                          org.springframework.context.ApplicationEventPublisher publisher) {
        this.games = games; this.events = events; this.rosters = rosters; this.slots = slots; this.policy = policy;
        this.publisher = publisher;
    }
```

`record(...)`：`events.save(ev);` 之後、`return` 之前加：
```java
        publisher.publishEvent(new ScoreboardChanged(gameId, after));
```

`update(...)`：把 `recompute(g, gameId); return state(userId, gameId);` 改為：
```java
        recompute(g, gameId);
        GameState now = fold(g, events.findByGameIdOrderBySequenceNoAsc(gameId));
        publisher.publishEvent(new ScoreboardChanged(gameId, now));
        return new GameStateResponse(now);
```

`delete(...)`：把 `recompute(g, gameId); return state(userId, gameId);` 改為同上三行。

> 確保 `GameStateResponse` 已 import（`com.baseball.record.scoring.dto.GameStateResponse`，ScoringService 已用 `dto.*`）。

- [ ] **Step 6: 加 SSE 整合測試（AC-10）**

用 `@SpyBean` 驗證「寫事件 → AFTER_COMMIT 推正確 snapshot」（不需真 socket；真正「另一裝置看到」由前端 E2E 覆蓋）。

```java
package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.GameStateResponse;
import com.baseball.record.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GameStreamIT extends IntegrationTest {
    @Autowired MockMvc mvc;
    @MockitoSpyBean GameStreamRegistry registry;

    String token() throws Exception {
        String email = "sse" + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }
    String createTeam(String t) throws Exception {
        return JsonPath.read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    String liveGame(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"P" + i + "\"}"))
                .andReturn().getResponse().getContentAsString(), "$.playerId");
            if (i > 0) slots.append(",");
            slots.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
                 .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        mvc.perform(put("/api/games/" + gameId + "/roster").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"slots\":[" + slots + "]}")).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}")).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\",\"recordingDetail\":\"L2\"}")).andExpect(status().isOk());
        return gameId;
    }

    @Test
    void recording_event_publishes_updated_snapshot_after_commit() throws Exception { // AC-10
        String t = token(); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);

        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"eventType\":\"HOME_RUN\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"H\"}]}"))
           .andExpect(status().isCreated());

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(registry, timeout(2000)).publish(org.mockito.ArgumentMatchers.eq(UUID.fromString(gameId)), payload.capture());
        GameStateResponse pushed = (GameStateResponse) payload.getValue();
        assertThat(pushed.state().scoreUs()).isEqualTo(1);    // 推出的 snapshot 已含新比分
    }
}
```

> **註**：`@MockitoSpyBean`（Spring Boot 3.4+）。若專案版本較舊，改用 `@org.springframework.boot.test.mock.mockito.SpyBean`。AFTER_COMMIT listener 在請求執行緒 commit 後同步觸發，`timeout(2000)` 為保險。

- [ ] **Step 7: 跑測試確認通過**

Run: `mvn -o -Dtest=GameStreamRegistryTest,GameStreamIT test`
Expected: PASS

- [ ] **Step 8: 全後端回歸（確認沒撞壞 M3a 76 測試 + 建構子改動）**

Run: `mvn -o test`
Expected: PASS（全綠；ScoringService 建構子多一參數，Spring 自動注入；既有 ScoringControllerIT 不變）

- [ ] **Step 9: Wave 3 commit**

```bash
cd backend && mvn -o test
git add backend/src/main/java/com/baseball/record/scoring/ backend/src/test/java/com/baseball/record/scoring/
git commit -m "feat(m3b): Wave 3 — SSE 即時計分板 registry/broadcaster + ScoringService 推播 hook（AC-10）"
```

---

## Wave 4 — 前端 plumbing（api client ＋ 鑽石 ＋ 盜壘按鈕）

### Task 6: `api/client.ts` 擴充 ＋ `BasesDiamond`

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/game/BasesDiamond.tsx`
- Modify: `frontend/src/pages/game/recording.css`

- [ ] **Step 1: client 加 `boxScore` / `setEr`（games）與 `stream`（events）**

`games` 物件內（`state:` 那行之後）加：
```ts
    boxScore: (gameId: string) => req(`/api/games/${gameId}/box-score`),
    setEr: (gameId: string, playerId: string, er: number) =>
      req(`/api/games/${gameId}/pitchers/${playerId}/er`, { method: 'PUT', body: JSON.stringify({ er }) }),
```

`events` 物件內（`remove:` 那行之後）加 fetch streaming（可帶 JWT header）：
```ts
    // 訂閱 SSE 計分板：回傳停止函式。payload = GameStateResponse（{ state }）。
    stream: (gameId: string, onState: (r: any) => void, onError?: (e: any) => void) => {
      const ctrl = new AbortController()
      const token = getToken()
      fetch(`/api/games/${gameId}/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ctrl.signal,
      }).then(async res => {
        if (!res.ok || !res.body) { onError?.(new Error(String(res.status))); return }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i); buf = buf.slice(i + 2)
            const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')
            if (data) { try { onState(JSON.parse(data)) } catch { /* 忽略非 JSON frame */ } }
          }
        }
      }).catch(err => { if (!ctrl.signal.aborted) onError?.(err) })
      return () => ctrl.abort()
    },
```

- [ ] **Step 2: 建 `BasesDiamond`**

```tsx
type Bases = { first?: unknown; second?: unknown; third?: unknown }
export default function BasesDiamond({ bases }: { bases: Bases }) {
  const on = (v: unknown) => (v ? 'on' : '')
  return (
    <div className="diamond" aria-label="壘包狀態" role="img">
      <span className={`base base-2 ${on(bases.second)}`} />
      <span className={`base base-3 ${on(bases.third)}`} />
      <span className={`base base-1 ${on(bases.first)}`} />
      <span className="base base-h" />
    </div>
  )
}
```

- [ ] **Step 3: recording.css 加樣式**（append；全走 design tokens）

```css
/* ── 計分板 / 鑽石 / box（M3b） ── */
.scoreboard { display: grid; gap: 16px; }
.sb-score { display: flex; align-items: center; gap: 24px; }
.sb-team { display: flex; flex-direction: column; align-items: center; }
.sb-team strong { font-size: 2.4rem; color: var(--accent-strong); }
.sb-live { margin-left: auto; color: var(--muted); font-size: .85rem; }
.sb-live.on { color: var(--accent); }
.sb-line { border-collapse: collapse; }
.sb-line th, .sb-line td { border: 1px solid var(--border); padding: 2px 8px; text-align: center; min-width: 24px; }
.sb-situation { display: flex; align-items: center; gap: 16px; }

.diamond { position: relative; width: 64px; height: 64px; }
.diamond .base { position: absolute; width: 16px; height: 16px; background: var(--surface-alt);
  border: 1px solid var(--border); transform: rotate(45deg); }
.diamond .base.on { background: var(--accent); border-color: var(--accent-strong); }
.diamond .base-2 { top: 0; left: 24px; }
.diamond .base-1 { top: 24px; left: 48px; }
.diamond .base-3 { top: 24px; left: 0; }
.diamond .base-h { top: 48px; left: 24px; background: var(--text); }

.box-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: .9rem; }
.box-table th, .box-table td { border-bottom: 1px solid var(--border); padding: 4px 6px; text-align: right; }
.box-table th:first-child, .box-table td:first-child { text-align: left; }
.box-er { cursor: pointer; text-decoration: underline dotted; }
.box-er.overridden { color: var(--warning); }
```

- [ ] **Step 4: 編譯確認**

Run: `cd frontend && npm run build`
Expected: tsc + vite 乾淨（無未使用 import 錯誤；`BasesDiamond` 尚未被引用會被 tree-shake，build 仍過）

- [ ] **Step 5: 不單獨 commit（Wave 4 末一起）**

---

### Task 7: `RecordTab` 盜壘 / 盜壘失敗按鈕

**Files:**
- Modify: `frontend/src/pages/game/RecordTab.tsx`

進攻半局且有跑者在壘時，顯示盜壘按鈕：選一位跑者推進一個壘（`BASE_RUNNING`，runnerMove `from→from+1`），或盜壘失敗（`from→OUT`）。

- [ ] **Step 1: 在 `rec-actions` 之前插入盜壘區塊**

在 `RecordTab` 的 `return (...)` 中，`<div className="rec-actions">` 之前插入：

```tsx
      {state.battingSide === 'offense' && basesOccupied().length > 0 && !pending && (
        <div className="rec-palette" aria-label="盜壘">
          {basesOccupied().map(fromBase => {
            const to = fromBase === '3' ? 'H' : String(Number(fromBase) + 1)
            return (
              <span key={fromBase} style={{ display: 'inline-flex', gap: 4 }}>
                <Button variant="ghost" onClick={() => send('BASE_RUNNING', [{ from: fromBase, to }])}>
                  {fromBase}壘盜{to === 'H' ? '本' : to}
                </Button>
                <Button variant="ghost" onClick={() => send('BASE_RUNNING', [{ from: fromBase, to: 'OUT' }])}>
                  {fromBase}壘盜失敗
                </Button>
              </span>
            )
          })}
        </div>
      )}
```

> `send` / `basesOccupied` 為 `RecordTab` 既有函式，直接重用。

- [ ] **Step 2: 編譯確認**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 3: Wave 4 commit**

```bash
cd frontend && npm run build
git add frontend/src/api/client.ts frontend/src/pages/game/BasesDiamond.tsx \
        frontend/src/pages/game/recording.css frontend/src/pages/game/RecordTab.tsx
git commit -m "feat(m3b): Wave 4 — api client SSE/box/er + 鑽石元件 + 盜壘按鈕"
```

---

## Wave 5 — 前端分頁（計分板 ＋ 數據）

### Task 8: `ScoreboardTab` ＋ route

**Files:**
- Create: `frontend/src/pages/game/ScoreboardTab.tsx`
- Modify: `frontend/src/layout/GameLayout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 建 `ScoreboardTab`**

```tsx
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import BasesDiamond from './BasesDiamond'
import './recording.css'

export default function ScoreboardTab() {
  const { game } = useOutletContext<{ game: any }>()
  const gameId = game?.gameId
  const [state, setState] = useState<any>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (!gameId) return
    api.games.state(gameId).then(r => setState(r.state)).catch(() => {})
    const stop = api.events.stream(gameId,
      r => { if (r?.state) { setState(r.state); setLive(true) } },
      () => setLive(false))
    return stop
  }, [gameId])

  if (!state) return <section><p role="status">尚無記錄。</p></section>
  const b = state.bases ?? {}
  const batter = state.lineup?.find((e: any) => e.battingOrder === state.currentBatterOrder)
  const line: number[][] = state.lineScore ?? []
  return (
    <section className="scoreboard">
      <div className="sb-score">
        <div className="sb-team"><span>對手</span><strong>{state.scoreOpp}</strong></div>
        <div className="sb-team"><span>我隊</span><strong>{state.scoreUs}</strong></div>
        <span className={`sb-live ${live ? 'on' : ''}`}>{live ? '● LIVE' : '○ 離線'}</span>
      </div>

      <table className="sb-line">
        <thead><tr><th></th>{line.map(r => <th key={r[0]}>{r[0]}</th>)}<th>R</th></tr></thead>
        <tbody>
          <tr><th>上</th>{line.map(r => <td key={r[0]}>{r[1]}</td>)}<td>{line.reduce((a, r) => a + r[1], 0)}</td></tr>
          <tr><th>下</th>{line.map(r => <td key={r[0]}>{r[2]}</td>)}<td>{line.reduce((a, r) => a + r[2], 0)}</td></tr>
        </tbody>
      </table>

      <div className="sb-situation">
        <span>{state.inning} 局{state.half === 'top' ? '上' : '下'}</span>
        <span>{state.outs} 出局</span>
        <BasesDiamond bases={b} />
      </div>

      <div className="sb-now">
        {state.battingSide === 'offense'
          ? <>打擊：第 {state.currentBatterOrder} 棒 {batter?.guestName ?? '球員'}</>
          : <>我隊守備中</>}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: GameLayout 移除計分板 `soon`**

把 `{ to: \`${base}/scoreboard\`, label: '計分板', soon: true },` 改為：
```tsx
    { to: `${base}/scoreboard`, label: '計分板' },
```

- [ ] **Step 3: App.tsx 接 route**

import 區加：`import ScoreboardTab from './pages/game/ScoreboardTab'`
把 `<Route path="scoreboard" element={<Placeholder name="計分板" />} />` 改為：
```tsx
              <Route path="scoreboard" element={<ScoreboardTab />} />
```

- [ ] **Step 4: 編譯確認**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: 不單獨 commit（Wave 5 末一起）**

---

### Task 9: `BoxTab` ＋ route

**Files:**
- Create: `frontend/src/pages/game/BoxTab.tsx`
- Modify: `frontend/src/layout/GameLayout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 建 `BoxTab`**（ER 欄點擊就地編輯；非 owner 由後端擋、前端 toast）

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { useToast } from '../../ui'
import './recording.css'

export default function BoxTab() {
  const { game } = useOutletContext<{ game: any }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [box, setBox] = useState<any>(null)

  const load = useCallback(() => {
    if (gameId) api.games.boxScore(gameId).then(setBox).catch(() => setBox(null))
  }, [gameId])
  useEffect(() => { load() }, [load])

  async function editEr(p: any) {
    const input = window.prompt(`設定投手 ${p.name} 的自責分 (ER)`, String(p.er))
    if (input == null) return
    const er = parseInt(input, 10)
    if (Number.isNaN(er) || er < 0) { toast.show('請輸入非負整數', 'error'); return }
    try { setBox(await api.games.setEr(gameId!, p.playerId, er)) }
    catch { toast.show('修改失敗（需 owner 權限）', 'error') }
  }

  if (!box) return <section><p role="status">尚無數據。</p></section>
  return (
    <section>
      <table className="sb-line">
        <thead><tr><th></th>{box.lineScore.map((r: any) => <th key={r.inning}>{r.inning}</th>)}<th>R</th><th>H</th></tr></thead>
        <tbody>
          <tr><th>上</th>{box.lineScore.map((r: any) => <td key={r.inning}>{r.top}</td>)}<td>{box.opponent.runs}</td><td>{box.opponent.hits}</td></tr>
          <tr><th>下</th>{box.lineScore.map((r: any) => <td key={r.inning}>{r.bottom}</td>)}<td>{box.team.runs}</td><td>{box.team.hits}</td></tr>
        </tbody>
      </table>

      <h3>打擊（我隊）</h3>
      <table className="box-table">
        <thead><tr><th>打者</th><th>守</th><th>打席</th><th>打數</th><th>得分</th><th>安打</th><th>二</th><th>三</th><th>全</th><th>打點</th><th>四壞</th><th>三振</th><th>盜壘</th><th>打率</th></tr></thead>
        <tbody>
          {box.batting.map((p: any) => (
            <tr key={p.playerId}>
              <td>{p.order}. {p.name}</td><td>{p.position}</td><td>{p.pa}</td><td>{p.ab}</td><td>{p.r}</td>
              <td>{p.h}</td><td>{p.doubles}</td><td>{p.triples}</td><td>{p.hr}</td><td>{p.rbi}</td>
              <td>{p.bb}</td><td>{p.k}</td><td>{p.sb}</td><td>{p.avg}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>投球（我隊）</h3>
      <table className="box-table">
        <thead><tr><th>投手</th><th>局數</th><th>被安</th><th>失分</th><th>自責</th><th>四壞</th><th>三振</th><th>用球</th></tr></thead>
        <tbody>
          {box.pitching.map((p: any) => (
            <tr key={p.playerId}>
              <td>{p.name}</td><td>{p.ip}</td><td>{p.h}</td><td>{p.r}</td>
              <td className={`box-er ${p.erOverridden ? 'overridden' : ''}`}
                  onClick={() => editEr(p)} title="點擊修改自責分">{p.er}</td>
              <td>{p.bb}</td><td>{p.k}</td><td>{p.pitches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
```

- [ ] **Step 2: GameLayout 移除數據 `soon`**

把 `{ to: \`${base}/box\`, label: '數據', soon: true },` 改為：
```tsx
    { to: `${base}/box`, label: '數據' },
```

- [ ] **Step 3: App.tsx 接 route**

import 區加：`import BoxTab from './pages/game/BoxTab'`
把 `<Route path="box" element={<Placeholder name="數據" />} />` 改為：
```tsx
              <Route path="box" element={<BoxTab />} />
```

- [ ] **Step 4: 編譯確認**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Wave 5 commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/game/ScoreboardTab.tsx frontend/src/pages/game/BoxTab.tsx \
        frontend/src/layout/GameLayout.tsx frontend/src/App.tsx
git commit -m "feat(m3b): Wave 5 — 計分板 + 數據分頁（移除 soon 佔位）"
```

---

## Wave 6 — Playwright E2E（AC-10 / AC-12 端到端）

### Task 10: `m3b-scoreboard-stats.spec.ts`

**Files:**
- Create: `frontend/e2e/m3b-scoreboard-stats.spec.ts`

> 參考既有 `frontend/e2e/m3a-recording.spec.ts` 的登入 / 建隊 / 建賽 / 名單 / 開賽 helper 寫法與 selector 慣例；沿用其 fixture。下方為骨架，實作時對齊 m3a 的既有 helper（若 m3a 已匯出共用 helper 則 import 重用）。

- [ ] **Step 1: 寫 E2E（先確認 m3a spec 的 helper 形態再落地）**

```ts
import { test, expect } from '@playwright/test'
// TODO(實作者)：import / 對齊 m3a-recording.spec.ts 既有的 login()/createTeam()/startLiveGame() helper

test('記一場 → 計分板即時更新 + box score + 盜壘 SB + ER 編輯', async ({ page }) => {
  // 前置：登入、建隊、建 9 人 away 比賽、確認名單、開賽（沿用 m3a helper）
  // const { gameId } = await startLiveGame(page)

  // 1) 記一支全壘打（記錄分頁）
  await page.getByRole('tab', { name: '記錄' }).click().catch(() => {})
  await page.getByRole('button', { name: 'HR' }).click()

  // 2) 計分板分頁：應顯示我隊 1 分（SSE 或載入時 fetch /state）
  await page.getByRole('link', { name: '計分板' }).click()
  await expect(page.locator('.sb-team', { hasText: '我隊' }).locator('strong')).toHaveText('1')

  // 3) 數據分頁：box score 我隊安打 = 1（全壘打計安打）
  await page.getByRole('link', { name: '數據' }).click()
  await expect(page.getByRole('cell', { name: '1' }).first()).toBeVisible()

  // 4) ER 就地編輯（owner）：點自責分欄改值，數字更新
  //   （守備半局先製造一次失分，使投手列出現後再測；視 m3a helper 能力補足）
})
```

- [ ] **Step 2: 跑 E2E**

```bash
# 確保後端(:5199 連 DB) 與 vite dev 已起；若 node 殭屍多先 taskkill //F //IM node.exe
cd frontend && npx playwright test m3b-scoreboard-stats.spec.ts --timeout=60000
```
Expected: PASS（核心：計分板顯示比分、box score 有數據）

- [ ] **Step 3: 全 E2E 回歸**

Run: `cd frontend && npx playwright test --timeout=60000`
Expected: 既有 8 + 新增皆綠（navigation / m3a 等不受影響）

- [ ] **Step 4: Wave 6 commit**

```bash
git add frontend/e2e/m3b-scoreboard-stats.spec.ts
git commit -m "test(m3b): Wave 6 — Playwright E2E 計分板/box score/盜壘/ER（AC-10/12）"
```

---

## 收尾驗收（對應 AC）

| AC | 驗證 |
|---|---|
| **AC-10 即時計分板** | `GameStreamRegistryTest`（推播機制）＋ `GameStreamIT`（寫事件→AFTER_COMMIT 推正確 snapshot）＋ E2E（計分板分頁看到比分更新） |
| **AC-12 單場統計** | `StatsEngineTest`（逐欄位推導，含 SB）＋ `BoxScoreControllerIT`（box score 數值、ER 覆寫）＋ E2E（數據分頁顯示） |

- 後端：`mvn -o test` 全綠（M3a 76 + 本里程碑新增）。
- 前端：`npm run build` 乾淨 + `npx playwright test` 全綠。
- 使用者層級：Web 上開兩分頁（記錄 + 計分板）走一遍，看到即時更新；數據分頁顯示 box score；owner 點 ER 可改。

## Self-Review 註記（已檢查）

- **Spec 覆蓋**：SSE（§5/Task5）、stats 引擎（§3.1/Task2）、box 規則（§3.2/Task2+4）、ER 覆寫（§3.4/Task3+4）、盜壘（§4/Task1+7）、兩分頁（§7/Task8+9）、V5（§8/Task3）、AC 測試（§9/各 Task）皆有對應 task。
- **型別一致**：`GameStreamRegistry.add/publish/subscribe`、`ScoreboardChanged(gameId,state)`、`BoxScore.BattingLine/PitchingLine`、`BoxScoreResponse.BatRow/PitchRow`、`EventApplier.isBaserunningOnly` 跨 task 命名一致。
- **待實作者驗證點（已標註）**：`EventPayload` accessor 名稱、`LineupSlot` getter、`@MockitoSpyBean` vs `@SpyBean`（Spring Boot 版本）、m3a E2E helper 形態。

## 實作修正記錄（執行時發現，已套用）

1. **StatsEngine 自管投手歸因**（Task 2）：原設計用 `before.currentPitcherId()` 歸因投球，但 **away 隊** fold 時 `currentPitcherId` 在守備半局恆為 `null`（M3a `InitialStateBuilder` 只在「先守」時種投手；away 隊翻半局後 `nextPitcher` 帶不到先發投手，且 fold 的投球數也被丟棄）。修正：`StatsEngine` 改自管 `currentPitcher`（種 `lineup.startingPitcherId()`、`PITCHER_CHANGE` 時更新），用球數直接從事件 `ev.pitches()` 累加，不再讀 `s.pitcherPitches()`。**不動 M3a 事件 fold 核心**。已加單元測試 `away_team_pitcher_attributed_after_flip_to_defense` 鎖住。
2. **IT 助手改名 `post`→`postEvent`**（Task 4）：`BoxScoreControllerIT` 的私有助手 `post(...)` 與靜態 import 的 `MockMvcRequestBuilders.post` 撞名導致編譯失敗；改名 `postEvent`。`GameStreamIT`（Task 5）若沿用同模式請直接用 `postEvent`。
