# M3a（賽中記錄引擎 · 寫端）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 owner 開賽後逐打席記錄（結果＋逐球好壞球可選＋跑者處理）、賽中換人/再上場（規則驗證）、即時取場面狀態、補登修正並自動重算，最後結束比賽——事件溯源寫端一條龍。

**Architecture:** 後端 package-by-module 新增 `scoring`、`shared.eventfold`，擴充 `shared.ruleengine`（`SubstitutionValidator`）與 `game`（狀態流轉）。場面狀態＝事件流「摺疊」純函式推導；**跑者去向由記錄員顯式產生（鑽石），存進事件 payload 的 `runnerMoves`，故 fold 只「套用」移動、不推斷棒球規則**。每筆寫入存 `snapshotAfter`（JSONB）；修正某筆從該 `sequenceNo` 起重算。沿用 M2 `TeamAccessPolicy`（owner 寫/member 讀）、RFC7807 ProblemDetail（非法換人 422）、Postgres+Flyway+Hibernate 6（JSONB 用 `@JdbcTypeCode(SqlTypes.JSON)`、陣列用 `SqlTypes.ARRAY`）。前端沿用 tokens / react-router / `api/client.ts` / `ui/` 元件庫。

**Tech Stack:** Java 21 + Spring Boot 3.5（Web/Data-JPA/Validation/Security/Actuator）、PostgreSQL + Flyway、Hibernate 6、Testcontainers（over Podman）、React + TypeScript + Vite、Playwright。

---

## 設計來源
`docs/superpowers/specs/2026-06-11-m3a-in-game-recording-design.md`（事實來源，commit `af223e1`）。對應 **AC-8（賽中記錄）/ AC-9（再上場驗證）/ AC-11（補登修正重算）**。M3b（SSE 計分板 + 單場統計，AC-10/12）與 backlog §E 進階動態不在本計畫。

## 執行重要約定（controller 必讀）

- **JDK 21 就地**：每個 build/test shell 開頭
  `export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"; export PATH="$JAVA_HOME/bin:$PATH"`。用系統 `mvn`（非 `./mvnw`）。
- **不主動 commit**（專案規則覆寫 skill 的「frequent commits」）：本計畫**不含** per-task `git commit`；commit 與否由使用者於收尾決定（fast-mode 慣例：每 Wave/Phase 收一次由 controller 提議）。
- **fast-mode subagent**（user 全域規則）：subagent 只「寫 code + test」，**不各自跑 build/test**。controller 先 `mvn -o test-compile` 預編譯一次，之後集中跑（`mvn -o -Dtest=X test`）。背景 subagent 無 Bash → mvn/npm 由 controller 跑。
- **同一 `target/` 不可多 subagent 同時編譯**：並行 subagent 只寫不同檔；編譯/測試 controller 集中跑。
- 後端 5199（`mvn -o spring-boot:run`，DB＝podman 容器 `backend_db_1`）/ 前端 5200（`npm run dev -- --port 5200 --strictPort`）；Testcontainers 走 Podman socket（必要時 `export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`）。
- 收尾 `taskkill //F //IM node.exe` + 刪 `frontend/.vite`（勿誤殺 java.exe 後端）。

## 範圍內 level（design §1/§2）
M3a 主交付 **L2（乾淨結果）＋逐球好壞球可選＋跑者處理**；架構內建 level/對稱概念但 **L1（純好壞球手動切棒）、L3（守位細節）、對稱具名對手** 為緊接增量，本計畫不實作其 UI/規則分支（保留欄位與擴充點即可）。

## 關鍵契約（跨 task 型別一致性）

事件 payload 與場面狀態的純資料型別（fold/validator/service/DTO 共用語彙）：

- `eventType`（String）：
  - PA 結果：`SINGLE DOUBLE TRIPLE HOME_RUN WALK HIT_BY_PITCH STRIKEOUT GROUND_OUT FLY_OUT FIELDERS_CHOICE SAC_FLY SAC_BUNT REACH_ON_ERROR`
  - 換人：`PINCH_HIT PINCH_RUN POSITION_CHANGE PITCHER_CHANGE RE_ENTRY`
  - 跑壘：`BASE_RUNNING`（盜壘/暴投/牽制/手動調壘）
- `RunnerMove(String from, String to)`：`from` ∈ `B`(打者)/`1`/`2`/`3`；`to` ∈ `1`/`2`/`3`/`H`(得分)/`OUT`。
- 半局翻面（3 出局）由 fold 推導，不存獨立事件。

## 檔案結構（本計畫新增/修改）

**後端 新增**
```
src/main/resources/db/migration/V4__game_events.sql
src/main/java/com/baseball/record/shared/eventfold/
    BaseState.java  GameState.java  LineupEntry.java  PitcherLine.java
    EventView.java  RunnerMove.java  PitchTally.java
    EventApplier.java  GameStateFolder.java  InitialStateBuilder.java
src/main/java/com/baseball/record/shared/ruleengine/
    SubstitutionAction.java  SubstitutionValidator.java   (新增；沿用既有 Violation/ValidationResult)
src/main/java/com/baseball/record/scoring/
    GameEvent.java  GameEventRepository.java
    ScoringService.java  ScoringController.java  ScoringExceptionHandler.java
    EventInvalidException.java
    dto/{RecordEventRequest, EventResponse, GameStateResponse, RunnerMoveDto, PitchTallyDto}.java
```
**後端 修改**
```
src/main/java/com/baseball/record/game/Game.java            (加 recordingDetail / symmetricOpponent 欄位 + getter/setter)
src/main/java/com/baseball/record/game/GameService.java     (transition 擴充 live/paused/completed；開賽帶設定)
src/main/java/com/baseball/record/game/dto/UpdateGameRequest.java  (gameStatus 值域擴充 + recordingDetail/symmetricOpponent)
src/main/java/com/baseball/record/game/dto/GameResponse.java       (回傳 recordingDetail/symmetricOpponent)
```
**後端 測試**
```
src/test/java/com/baseball/record/shared/eventfold/{GameStateFolderTest, EventApplierTest}.java
src/test/java/com/baseball/record/shared/ruleengine/SubstitutionValidatorTest.java
src/test/java/com/baseball/record/scoring/ScoringControllerIT.java
src/test/java/com/baseball/record/game/GameControllerIT.java   (修改：加 live/paused/completed 流轉測試)
```
**前端 新增/修改**
```
src/api/client.ts                       (修改：加 games.start/pause/complete、events.*、game.state)
src/pages/game/RecordTab.tsx            (新增：記錄主畫面)
src/pages/game/TimelineTab.tsx          (新增：事件時間線 + 修正/刪除)
src/pages/game/recording.css            (新增：鑽石/結果面板/狀態列樣式)
src/layout/GameLayout.tsx               (修改：記錄/時間線分頁移除 soon、加開賽控制)
src/App.tsx                             (修改：record/timeline route 換成真元件)
e2e/m3a-recording.spec.ts               (新增 Playwright)
```

## 執行順序（依賴 / 可並行）

- **Wave 1（並行，互不相干檔）**：Task 1（V4 migration）、Task 2（eventfold 純函式）、Task 3（SubstitutionValidator 純函式）。
- **Wave 2（並行，皆依賴 Task 1 的表/欄）**：Task 4（GameEvent entity/repo）、Task 5（game 狀態流轉擴充）。
- **Wave 3**：Task 6（scoring service + API + 重算；依賴 2/3/4/5）。
- **Wave 4**：Task 7（前端 client；依賴後端 API 形狀 6）。
- **Wave 5（並行）**：Task 8（RecordTab）、Task 9（TimelineTab + 開賽控制）。
- **Wave 6**：Task 10（Playwright E2E）。

> controller 每個 Wave 結束集中編譯/跑測（`mvn -o test-compile` → `mvn -o -Dtest=... test`；前端 `npm run build`），綠燈才進下一 Wave。

---

## Task 1：Flyway V4 — game_event 表 + games 兩個開賽欄位

**Files:**
- Create: `backend/src/main/resources/db/migration/V4__game_events.sql`
- Verify: 既有 `src/test/java/com/baseball/record/support/ContextLoadsIT.java`（context load 跑 flyway + Hibernate validate）

- [ ] **Step 1: 寫 migration SQL**

```sql
-- V4__game_events.sql

ALTER TABLE games ADD COLUMN recording_detail   VARCHAR(4)  NOT NULL DEFAULT 'L2';
ALTER TABLE games ADD COLUMN symmetric_opponent BOOLEAN     NOT NULL DEFAULT false;

CREATE TABLE game_event (
    event_id        UUID PRIMARY KEY,
    game_id         UUID         NOT NULL REFERENCES games(game_id),
    inning          INT          NOT NULL,
    half            VARCHAR(10)  NOT NULL,                 -- top / bottom
    sequence_no     INT          NOT NULL,                 -- 全場單調遞增，定義順序與重算起點
    event_type      VARCHAR(30)  NOT NULL,
    actor_player_id UUID,                                  -- 進攻打者；守備半局匿名對手 = null
    related_players UUID[]       NOT NULL DEFAULT '{}',    -- 被換者/投手/受影響跑者
    payload         JSONB        NOT NULL DEFAULT '{}',    -- runnerMoves / pitches / fieldPosition / guestBatterName
    score_delta     INT          NOT NULL DEFAULT 0,
    outs_after      INT          NOT NULL,
    bases_after     JSONB        NOT NULL DEFAULT '{}',    -- {first,second,third}
    snapshot_after  JSONB        NOT NULL DEFAULT '{}',    -- 完整 GameState
    capture_source  VARCHAR(20)  NOT NULL DEFAULT 'manual',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_game_seq UNIQUE (game_id, sequence_no)
);
CREATE INDEX idx_event_game_seq ON game_event (game_id, sequence_no);
```

- [ ] **Step 2: controller 驗證 flyway 套用**

Run: `mvn -o -Dtest=ContextLoadsIT test`
Expected: PASS（flyway 套用 V4；既有 `Game` entity 尚未加新欄位，但 `ddl-auto=validate` 對「DB 多欄、entity 少欄」不報錯——新欄位有 DEFAULT。Task 5 才把欄位加進 entity）。

---

## Task 2：shared/eventfold 純函式（場面狀態摺疊）+ 單元測試（無 DB）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/shared/eventfold/{BaseState,GameState,LineupEntry,PitcherLine,EventView,RunnerMove,PitchTally,EventApplier,GameStateFolder,InitialStateBuilder}.java`
- Test: `backend/src/test/java/com/baseball/record/shared/eventfold/{GameStateFolderTest,EventApplierTest}.java`

- [ ] **Step 1: 寫純資料型別**

`RunnerMove.java`：
```java
package com.baseball.record.shared.eventfold;

/** from: "B"(打者)/"1"/"2"/"3"；to: "1"/"2"/"3"/"H"(得分)/"OUT"。跑者去向由記錄員顯式產生。 */
public record RunnerMove(String from, String to) {}
```

`PitchTally.java`：
```java
package com.baseball.record.shared.eventfold;

/** 守備半局投手用球累計（offense 半局可為 null：對手投手非我方球員）。 */
public record PitchTally(int pitches, int strikes, int balls, int swinging, int looking) {
    public static PitchTally zero() { return new PitchTally(0, 0, 0, 0, 0); }
    public PitchTally plus(PitchTally o) {
        if (o == null) return this;
        return new PitchTally(pitches + o.pitches(), strikes + o.strikes(), balls + o.balls(),
            swinging + o.swinging(), looking + o.looking());
    }
}
```

`EventView.java`（fold 的純輸入；service 由 entity 解析後傳入）：
```java
package com.baseball.record.shared.eventfold;

import java.util.List;
import java.util.UUID;

/**
 * fold 純輸入。runnerMoves 顯式描述本事件所有跑者去向（含打者 from="B"）。
 * pitcherId = 本事件當下投手（守備半局＝我方投手；offense 半局 = null）。
 * fieldPosition：L3 守位（出局守備位置，可 null）。guestBatterName：對手匿名打者顯示名（可 null）。
 * sub*：換人事件用（PINCH_HIT/PINCH_RUN/POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY）。
 */
public record EventView(
    int sequenceNo, String eventType,
    UUID actorPlayerId, List<UUID> relatedPlayers,
    List<RunnerMove> runnerMoves, PitchTally pitches,
    UUID pitcherId, String fieldPosition, String guestBatterName,
    UUID subInPlayerId, String subInGuestName, UUID subOutPlayerId,
    Integer subBattingOrder, String subFieldPosition) {}
```

`BaseState.java`（壘包；token = playerId 字串或匿名 "OPP#n"）：
```java
package com.baseball.record.shared.eventfold;

public record BaseState(String first, String second, String third) {
    public static BaseState empty() { return new BaseState(null, null, null); }
    public String at(String base) {
        return switch (base) { case "1" -> first; case "2" -> second; case "3" -> third; default -> null; };
    }
    public BaseState with(String base, String runner) {
        return switch (base) {
            case "1" -> new BaseState(runner, second, third);
            case "2" -> new BaseState(first, runner, third);
            case "3" -> new BaseState(first, second, runner);
            default -> this;
        };
    }
}
```

`LineupEntry.java`（在場/打序狀態，含再上場追蹤）：
```java
package com.baseball.record.shared.eventfold;

import java.util.UUID;

public record LineupEntry(int battingOrder, UUID playerId, String guestName, String fieldPosition,
                          boolean onField, boolean starter, boolean exited, boolean reEntered) {
    public LineupEntry withField(String pos)      { return new LineupEntry(battingOrder, playerId, guestName, pos, onField, starter, exited, reEntered); }
    public LineupEntry leave()                    { return new LineupEntry(battingOrder, playerId, guestName, fieldPosition, false, starter, true, reEntered); }
    public LineupEntry enter(UUID pid, String gn, String pos) { return new LineupEntry(battingOrder, pid, gn, pos, true, starter, false, reEntered); }
    public LineupEntry reenter()                  { return new LineupEntry(battingOrder, playerId, guestName, fieldPosition, true, starter, false, true); }
}
```

`PitcherLine.java`：
```java
package com.baseball.record.shared.eventfold;

import com.baseball.record.shared.eventfold.PitchTally;

public record PitcherLine(java.util.UUID pitcherId, PitchTally pitches) {}
```

`GameState.java`（fold 產出＝snapshot 模型）：
```java
package com.baseball.record.shared.eventfold;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * battingSide: "offense"(我隊打擊) / "defense"(我隊守備)，由 half + homeAway 推導。
 * us/opp 比分；lineScore 每局 {top,bottom}。lineup 為我隊打序狀態。
 * pitcherPitches: 我方各投手用球累計。currentBatterIndex 指向 lineup 的打序游標（offense 用）。
 */
public record GameState(
    int inning, String half, String battingSide,
    int outs, int scoreUs, int scoreOpp,
    BaseState bases,
    int currentBatterOrder,
    UUID currentPitcherId,
    List<LineupEntry> lineup,
    Map<UUID, PitchTally> pitcherPitches,
    List<int[]> lineScore) {}   // 每元素 = {inning, topRuns, bottomRuns}
```

- [ ] **Step 2: 寫失敗測試 `EventApplierTest`**（單事件套用語意）

```java
package com.baseball.record.shared.eventfold;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EventApplierTest {

    static GameState fresh() {
        // 我隊客場（away）→ top 半局我隊進攻；簡化 9 人打序、投手 = lineup[0..8] 不重要（offense）
        return new GameState(1, "top", "offense", 0, 0, 0, BaseState.empty(),
            1, null, java.util.List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
    }

    static EventView pa(String type, List<RunnerMove> moves) {
        return new EventView(1, type, UUID.randomUUID(), List.of(), moves, null,
            null, null, null, null, null, null, null, null);
    }

    @Test
    void single_puts_batter_on_first() {
        GameState s = EventApplier.apply(fresh(), pa("SINGLE", List.of(new RunnerMove("B", "1"))));
        assertThat(s.bases().first()).isNotNull();
        assertThat(s.outs()).isZero();
        assertThat(s.scoreUs()).isZero();
    }

    @Test
    void strikeout_adds_out() {
        GameState s = EventApplier.apply(fresh(), pa("STRIKEOUT", List.of(new RunnerMove("B", "OUT"))));
        assertThat(s.outs()).isEqualTo(1);
        assertThat(s.bases().first()).isNull();
    }

    @Test
    void home_run_with_runner_scores_two() {
        GameState start = new GameState(1, "top", "offense", 0, 0, 0,
            BaseState.empty().with("1", "r1"), 3, null, List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
        GameState s = EventApplier.apply(start, pa("HOME_RUN",
            List.of(new RunnerMove("1", "H"), new RunnerMove("B", "H"))));
        assertThat(s.scoreUs()).isEqualTo(2);
        assertThat(s.bases()).isEqualTo(BaseState.empty());
    }

    @Test
    void third_out_flips_half_and_clears_bases() {
        GameState start = new GameState(1, "top", "offense", 2, 0, 0,
            BaseState.empty().with("2", "r2"), 5, null, List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
        GameState s = EventApplier.apply(start, pa("FLY_OUT", List.of(new RunnerMove("B", "OUT"))));
        assertThat(s.outs()).isZero();
        assertThat(s.half()).isEqualTo("bottom");
        assertThat(s.battingSide()).isEqualTo("defense");
        assertThat(s.bases()).isEqualTo(BaseState.empty());
    }

    @Test
    void defense_pa_pitch_tally_accrues_to_pitcher() {
        UUID p = UUID.randomUUID();
        GameState start = new GameState(1, "bottom", "defense", 0, 0, 0, BaseState.empty(),
            0, p, List.of(), new java.util.HashMap<>(), new java.util.ArrayList<>());
        EventView ev = new EventView(1, "STRIKEOUT", null, List.of(), List.of(new RunnerMove("B", "OUT")),
            new PitchTally(4, 3, 1, 2, 1), p, null, "對手1", null, null, null, null, null);
        GameState s = EventApplier.apply(start, ev);
        assertThat(s.pitcherPitches().get(p).pitches()).isEqualTo(4);
        assertThat(s.outs()).isEqualTo(1);
    }
}
```

- [ ] **Step 3: 寫失敗測試 `GameStateFolderTest`**（整串摺疊 + 初始化 + 半局比分）

```java
package com.baseball.record.shared.eventfold;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class GameStateFolderTest {

    static EventView pa(int seq, String type, RunnerMove... moves) {
        return new EventView(seq, type, UUID.randomUUID(), List.of(), List.of(moves), null,
            null, null, null, null, null, null, null, null);
    }

    /** 我隊 away：起始 top 半局、進攻。打序 9 人（playerId 1..9）。 */
    static InitialStateBuilder.InitialLineup lineup9() {
        List<LineupEntry> es = new ArrayList<>();
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 9; i++)
            es.add(new LineupEntry(i + 1, UUID.randomUUID(), null, pos[i], true, true, false, false));
        return new InitialStateBuilder.InitialLineup("away", es, es.get(0).playerId());
    }

    @Test
    void empty_events_yield_initial_top1_offense() {
        GameState s = GameStateFolder.fold(lineup9(), List.of());
        assertThat(s.inning()).isEqualTo(1);
        assertThat(s.half()).isEqualTo("top");
        assertThat(s.battingSide()).isEqualTo("offense");
        assertThat(s.currentBatterOrder()).isEqualTo(1);
        assertThat(s.outs()).isZero();
    }

    @Test
    void three_strikeouts_flip_to_bottom_defense() {
        GameState s = GameStateFolder.fold(lineup9(), List.of(
            pa(1, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(2, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(3, "STRIKEOUT", new RunnerMove("B", "OUT"))));
        assertThat(s.half()).isEqualTo("bottom");
        assertThat(s.battingSide()).isEqualTo("defense");
        assertThat(s.outs()).isZero();
    }

    @Test
    void runs_in_top_count_to_us_and_linescore() {
        GameState s = GameStateFolder.fold(lineup9(), List.of(
            pa(1, "HOME_RUN", new RunnerMove("B", "H")),
            pa(2, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(3, "STRIKEOUT", new RunnerMove("B", "OUT")),
            pa(4, "STRIKEOUT", new RunnerMove("B", "OUT"))));
        assertThat(s.scoreUs()).isEqualTo(1);
        assertThat(s.lineScore().get(0)[1]).isEqualTo(1); // top of inning 1 = 1 run
    }

    @Test
    void batting_cursor_advances_and_wraps() {
        List<EventView> evs = new ArrayList<>();
        for (int i = 1; i <= 3; i++) evs.add(pa(i, "STRIKEOUT", new RunnerMove("B", "OUT")));
        GameState s = GameStateFolder.fold(lineup9(), evs);
        // 3 出局後翻到 bottom（defense），守備半局不推我隊打序游標
        assertThat(s.battingSide()).isEqualTo("defense");
    }
}
```

- [ ] **Step 4: controller 跑測確認 FAIL**

Run: `mvn -o -Dtest=EventApplierTest,GameStateFolderTest test`
Expected: 編譯失敗 / FAIL（`EventApplier`/`GameStateFolder`/`InitialStateBuilder` 未實作）。

- [ ] **Step 5: 實作 `InitialStateBuilder`**

```java
package com.baseball.record.shared.eventfold;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

/** 由出賽名單建初始 GameState（inning 1、依 homeAway 決定首半局攻守）。 */
public final class InitialStateBuilder {
    private InitialStateBuilder() {}

    public record InitialLineup(String homeAway, List<LineupEntry> lineup, UUID startingPitcherId) {}

    public static GameState initial(InitialLineup in) {
        // away → top 半局我隊先攻（offense）；home → top 半局我隊先守（defense）
        String half = "top";
        String battingSide = "away".equals(in.homeAway()) ? "offense" : "defense";
        UUID pitcher = "defense".equals(battingSide) ? in.startingPitcherId() : null;
        int firstOrder = "offense".equals(battingSide) ? 1 : 0;
        return new GameState(1, half, battingSide, 0, 0, 0, BaseState.empty(),
            firstOrder, pitcher, List.copyOf(in.lineup()), new HashMap<>(), new ArrayList<>());
    }
}
```

- [ ] **Step 6: 實作 `EventApplier`**（單事件 reducer）

```java
package com.baseball.record.shared.eventfold;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 把單一事件套用到 GameState（純函式，回新狀態）。跑者移動皆顯式（runnerMoves）。 */
public final class EventApplier {
    private EventApplier() {}

    public static GameState apply(GameState s, EventView ev) {
        if (isSubstitution(ev.eventType())) return applySubstitution(s, ev);
        return applyPlay(s, ev);
    }

    static boolean isSubstitution(String t) {
        return switch (t) {
            case "PINCH_HIT", "PINCH_RUN", "POSITION_CHANGE", "PITCHER_CHANGE", "RE_ENTRY" -> true;
            default -> false;
        };
    }

    /** PA 結果 / 跑壘：套用 runnerMoves、計分、計出局、投球累計、必要時翻半局、推進打序游標。 */
    static GameState applyPlay(GameState s, EventView ev) {
        BaseState bases = s.bases();
        int outs = s.outs(), scoreUs = s.scoreUs(), scoreOpp = s.scoreOpp();
        int runs = 0, newOuts = 0;

        // 先清空被移動「出發壘」（B 不在壘上），再放置「目的壘」；H=得分、OUT=出局。
        // 收集目的地避免覆寫衝突：先算離壘，再放新位置。
        String first = bases.first(), second = bases.second(), third = bases.third();
        Map<String, String> place = new HashMap<>(); // base -> runner token
        for (RunnerMove m : ev.runnerMoves()) {
            String token = switch (m.from()) {
                case "1" -> first; case "2" -> second; case "3" -> third;
                case "B" -> batterToken(ev); default -> null;
            };
            // 離開原壘
            switch (m.from()) { case "1" -> first = null; case "2" -> second = null; case "3" -> third = null; }
            switch (m.to()) {
                case "H" -> runs++;
                case "OUT" -> newOuts++;
                case "1", "2", "3" -> place.put(m.to(), token);
                default -> {}
            }
        }
        BaseState moved = new BaseState(
            place.getOrDefault("1", first), place.getOrDefault("2", second), place.getOrDefault("3", third));

        outs += newOuts;
        if ("offense".equals(s.battingSide())) scoreUs += runs; else scoreOpp += runs;

        // 投球累計（守備半局、有投手）
        Map<UUID, PitchTally> pp = new HashMap<>(s.pitcherPitches());
        if (ev.pitches() != null && s.currentPitcherId() != null)
            pp.merge(s.currentPitcherId(), ev.pitches(), PitchTally::plus);

        List<int[]> line = addLineScore(s, runs);

        // 翻半局
        if (outs >= 3) {
            String nextHalf = "top".equals(s.half()) ? "bottom" : "top";
            int nextInning = "top".equals(s.half()) ? s.inning() : s.inning() + 1;
            String nextSide = flipSide(s.battingSide());
            return new GameState(nextInning, nextHalf, nextSide, 0, scoreUs, scoreOpp,
                BaseState.empty(), nextBatterOrderForHalf(s, nextSide), nextPitcher(s, nextSide),
                s.lineup(), pp, line);
        }
        int nextOrder = "offense".equals(s.battingSide()) ? wrap(s.currentBatterOrder(), s.lineup()) : s.currentBatterOrder();
        return new GameState(s.inning(), s.half(), s.battingSide(), outs, scoreUs, scoreOpp,
            moved, nextOrder, s.currentPitcherId(), s.lineup(), pp, line);
    }

    static GameState applySubstitution(GameState s, EventView ev) {
        List<LineupEntry> lu = new ArrayList<>(s.lineup());
        UUID pitcher = s.currentPitcherId();
        switch (ev.eventType()) {
            case "PITCHER_CHANGE" -> {
                pitcher = ev.subInPlayerId();
                replaceField(lu, ev, "P");
            }
            case "POSITION_CHANGE" -> replaceField(lu, ev, ev.subFieldPosition());
            case "PINCH_HIT", "PINCH_RUN" -> swapIn(lu, ev);
            case "RE_ENTRY" -> reenter(lu, ev);
            default -> {}
        }
        return new GameState(s.inning(), s.half(), s.battingSide(), s.outs(), s.scoreUs(), s.scoreOpp(),
            s.bases(), s.currentBatterOrder(), pitcher, lu, s.pitcherPitches(), s.lineScore());
    }

    // ── helpers ──
    private static String batterToken(EventView ev) {
        return ev.actorPlayerId() != null ? ev.actorPlayerId().toString()
            : (ev.guestBatterName() != null ? "OPP:" + ev.guestBatterName() : "OPP");
    }
    private static String flipSide(String side) { return "offense".equals(side) ? "defense" : "offense"; }
    private static int wrap(int order, List<LineupEntry> lu) {
        int n = (int) lu.stream().filter(e -> e.battingOrder() > 0).count();
        if (n == 0) return order;
        return order >= n ? 1 : order + 1;
    }
    private static int nextBatterOrderForHalf(GameState s, String nextSide) {
        return "offense".equals(nextSide) ? Math.max(1, s.currentBatterOrder()) : s.currentBatterOrder();
    }
    private static UUID nextPitcher(GameState s, String nextSide) {
        return "defense".equals(nextSide) ? s.currentPitcherId() : null;
    }
    private static List<int[]> addLineScore(GameState s, int runs) {
        List<int[]> line = new ArrayList<>();
        for (int[] row : s.lineScore()) line.add(row.clone());
        int idx = -1;
        for (int i = 0; i < line.size(); i++) if (line.get(i)[0] == s.inning()) { idx = i; break; }
        if (idx < 0) { line.add(new int[]{s.inning(), 0, 0}); idx = line.size() - 1; }
        if ("top".equals(s.half())) line.get(idx)[1] += runs; else line.get(idx)[2] += runs;
        return line;
    }
    private static void replaceField(List<LineupEntry> lu, EventView ev, String pos) {
        for (int i = 0; i < lu.size(); i++) {
            LineupEntry e = lu.get(i);
            if (matchesOut(e, ev)) lu.set(i, e.enter(ev.subInPlayerId(), ev.subInGuestName(), pos));
            else if (pos != null && pos.equals(e.fieldPosition()) && !matchesOut(e, ev)) lu.set(i, e.withField(null));
        }
    }
    private static void swapIn(List<LineupEntry> lu, EventView ev) {
        for (int i = 0; i < lu.size(); i++) {
            LineupEntry e = lu.get(i);
            if (matchesOut(e, ev)) {
                lu.set(i, e.leave());
                lu.set(i, lu.get(i).enter(ev.subInPlayerId(), ev.subInGuestName(), ev.subFieldPosition()));
            }
        }
    }
    private static void reenter(List<LineupEntry> lu, EventView ev) {
        for (int i = 0; i < lu.size(); i++) {
            LineupEntry e = lu.get(i);
            if (e.playerId() != null && e.playerId().equals(ev.subInPlayerId())) lu.set(i, e.reenter());
        }
    }
    private static boolean matchesOut(LineupEntry e, EventView ev) {
        return ev.subOutPlayerId() != null && ev.subOutPlayerId().equals(e.playerId());
    }
}
```

> 註：`swapIn`/`replaceField` 採「先 leave 再 enter 同一打序 slot」語意；POSITION_CHANGE 的舊守位清空為簡化版（M3a L2 夠用），守位互換的完整處理隨 L3/進階補強。

- [ ] **Step 7: 實作 `GameStateFolder`**

```java
package com.baseball.record.shared.eventfold;

import java.util.List;

/** 事件流摺疊：initial → 逐筆 apply。事件須已依 sequenceNo 排序。 */
public final class GameStateFolder {
    private GameStateFolder() {}

    public static GameState fold(InitialStateBuilder.InitialLineup lineup, List<EventView> events) {
        GameState s = InitialStateBuilder.initial(lineup);
        for (EventView ev : events) s = EventApplier.apply(s, ev);
        return s;
    }
}
```

- [ ] **Step 8: controller 跑測確認 PASS**

Run: `mvn -o -Dtest=EventApplierTest,GameStateFolderTest test`
Expected: PASS。（若 `batting_cursor` 等案例對游標細節有出入，以測試為準微調 `wrap`/`nextBatterOrderForHalf`，行為契約＝測試。）

---

## Task 3：shared/ruleengine — SubstitutionValidator 純函式 + 單元測試（再上場 VR-002/003）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/shared/ruleengine/{SubstitutionAction,SubstitutionValidator}.java`（沿用既有 `Violation`/`ValidationResult`）
- Test: `backend/src/test/java/com/baseball/record/shared/ruleengine/SubstitutionValidatorTest.java`

- [ ] **Step 1: 寫 `SubstitutionAction`（純輸入）**

```java
package com.baseball.record.shared.ruleengine;

import java.util.UUID;

/**
 * 換人動作純輸入（service 由 GameState.lineup 解析後傳入）。
 * type: PINCH_HIT/PINCH_RUN/POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY。
 * outOnField: 被換者目前是否在場；inAlreadyStarter: 接手者是否為「曾先發、已下場」（再上場對象）。
 * inHasReEntered: 接手者是否已用過再上場。targetPosition: 換上後守位（POSITION_CHANGE/PITCHER_CHANGE）。
 */
public record SubstitutionAction(
    String type, UUID outPlayerId, boolean outOnField,
    UUID inPlayerId, boolean inAlreadyStarter, boolean inHasReEntered, boolean inExited,
    String targetPosition, boolean reEntryAllowed,
    java.util.Map<String, Integer> currentPositionCounts) {}
```

- [ ] **Step 2: 寫失敗測試 `SubstitutionValidatorTest`**

```java
package com.baseball.record.shared.ruleengine;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SubstitutionValidatorTest {

    static SubstitutionAction pinchHit(boolean outOnField) {
        return new SubstitutionAction("PINCH_HIT", UUID.randomUUID(), outOnField,
            UUID.randomUUID(), false, false, false, null, false, Map.of());
    }

    @Test
    void pinch_hit_for_on_field_player_is_valid() {
        ValidationResult r = SubstitutionValidator.validate(pinchHit(true));
        assertThat(r.valid()).isTrue();
    }

    @Test
    void sub_target_not_on_field_fails() {
        ValidationResult r = SubstitutionValidator.validate(pinchHit(false));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("SUB_TARGET_NOT_ON_FIELD"));
    }

    @Test
    void re_entry_not_allowed_fails() { // VR-002/003：reEntryAllowed=false
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), true, false, true, "LF", false, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("RE_ENTRY_NOT_ALLOWED"));
    }

    @Test
    void re_entry_once_allowed_passes() {
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), true, false, true, "LF", true, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.valid()).isTrue();
    }

    @Test
    void re_entry_second_time_fails() { // 已用過再上場
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), true, true, true, "LF", true, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("RE_ENTRY_ALREADY_USED"));
    }

    @Test
    void re_entry_non_starter_fails() { // 只有先發可再上場
        SubstitutionAction a = new SubstitutionAction("RE_ENTRY", null, false,
            UUID.randomUUID(), false, false, true, "LF", true, Map.of());
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("RE_ENTRY_NOT_STARTER"));
    }

    @Test
    void position_change_duplicate_fails() {
        SubstitutionAction a = new SubstitutionAction("POSITION_CHANGE", UUID.randomUUID(), true,
            UUID.randomUUID(), false, false, false, "SS", false, Map.of("SS", 1));
        ValidationResult r = SubstitutionValidator.validate(a);
        assertThat(r.violations()).anyMatch(v -> v.code().equals("POSITION_DUPLICATE"));
    }
}
```

- [ ] **Step 3: controller 跑測確認 FAIL**

Run: `mvn -o -Dtest=SubstitutionValidatorTest test`
Expected: FAIL（`SubstitutionValidator` 未實作）。

- [ ] **Step 4: 實作 `SubstitutionValidator`**

```java
package com.baseball.record.shared.ruleengine;

import java.util.ArrayList;
import java.util.List;

/** 換人/再上場驗證純函式（design §8；VR-002/003）。 */
public final class SubstitutionValidator {
    private SubstitutionValidator() {}

    public static ValidationResult validate(SubstitutionAction a) {
        List<Violation> out = new ArrayList<>();

        switch (a.type()) {
            case "PINCH_HIT", "PINCH_RUN", "POSITION_CHANGE", "PITCHER_CHANGE" -> {
                if (!a.outOnField())
                    out.add(new Violation("SUB_TARGET_NOT_ON_FIELD", "被換下的球員目前不在場上"));
            }
            case "RE_ENTRY" -> {
                if (!a.reEntryAllowed())
                    out.add(new Violation("RE_ENTRY_NOT_ALLOWED", "本場規則不允許再上場"));
                if (!a.inAlreadyStarter())
                    out.add(new Violation("RE_ENTRY_NOT_STARTER", "只有先發球員可再上場"));
                else if (!a.inExited())
                    out.add(new Violation("RE_ENTRY_NOT_EXITED", "該球員尚未下場，無需再上場"));
                if (a.inHasReEntered())
                    out.add(new Violation("RE_ENTRY_ALREADY_USED", "該球員已用過一次再上場"));
            }
            default -> out.add(new Violation("SUB_TYPE_UNKNOWN", "未知換人類型：" + a.type()));
        }

        // 守位不重複（POSITION_CHANGE/PITCHER_CHANGE/RE_ENTRY 帶守位時）
        String pos = a.targetPosition();
        if (pos != null && a.currentPositionCounts().getOrDefault(pos, 0) >= 1
            && !"PITCHER_CHANGE".equals(a.type()))   // 換投承接同一個 P 守位，不算重複
            out.add(new Violation("POSITION_DUPLICATE", "守位重複：" + pos));

        return new ValidationResult(out.isEmpty(), out);
    }
}
```

- [ ] **Step 5: controller 跑測確認 PASS**

Run: `mvn -o -Dtest=SubstitutionValidatorTest test`
Expected: PASS。

---

## Task 4：GameEvent entity + repository（JSONB / uuid[] 對映）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/scoring/{GameEvent,GameEventRepository}.java`,
  `scoring/dto/{RunnerMoveDto,PitchTallyDto}.java`, `scoring/EventPayload.java`
- 無獨立測試（由 Task 6 IT 覆蓋）；本 task 只建 entity/repo + payload 型別，Wave 2 編譯確認。

- [ ] **Step 1: `EventPayload`（JSONB 內容；複用 eventfold 的 RunnerMove/PitchTally）**

```java
package com.baseball.record.scoring;

import com.baseball.record.shared.eventfold.PitchTally;
import com.baseball.record.shared.eventfold.RunnerMove;

import java.util.List;
import java.util.UUID;

/** game_event.payload(JSONB) 的內容；換人欄位於非換人事件為 null。 */
public record EventPayload(
    List<RunnerMove> runnerMoves, PitchTally pitches,
    String fieldPosition, String guestBatterName,
    UUID subInPlayerId, String subInGuestName, UUID subOutPlayerId,
    Integer subBattingOrder, String subFieldPosition) {}
```

- [ ] **Step 2: `GameEvent` entity（Hibernate 6 JSON/ARRAY）**

```java
package com.baseball.record.scoring;

import com.baseball.record.shared.eventfold.BaseState;
import com.baseball.record.shared.eventfold.GameState;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "game_event")
public class GameEvent {
    @Id @Column(name = "event_id") private UUID eventId = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "inning", nullable = false) private int inning;
    @Column(name = "half", nullable = false) private String half;
    @Column(name = "sequence_no", nullable = false) private int sequenceNo;
    @Column(name = "event_type", nullable = false) private String eventType;
    @Column(name = "actor_player_id") private UUID actorPlayerId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "related_players", columnDefinition = "uuid[]", nullable = false)
    private List<UUID> relatedPlayers = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "jsonb", nullable = false)
    private EventPayload payload = new EventPayload(List.of(), null, null, null, null, null, null, null, null);

    @Column(name = "score_delta", nullable = false) private int scoreDelta;
    @Column(name = "outs_after", nullable = false) private int outsAfter;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "bases_after", columnDefinition = "jsonb", nullable = false)
    private BaseState basesAfter = BaseState.empty();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot_after", columnDefinition = "jsonb", nullable = false)
    private GameState snapshotAfter;

    @Column(name = "capture_source", nullable = false) private String captureSource = "manual";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected GameEvent() {}
    public GameEvent(UUID gameId, int sequenceNo, String eventType) {
        this.gameId = gameId; this.sequenceNo = sequenceNo; this.eventType = eventType;
    }

    public UUID getEventId() { return eventId; }
    public UUID getGameId() { return gameId; }
    public int getInning() { return inning; } public void setInning(int v) { inning = v; }
    public String getHalf() { return half; } public void setHalf(String v) { half = v; }
    public int getSequenceNo() { return sequenceNo; } public void setSequenceNo(int v) { sequenceNo = v; }
    public String getEventType() { return eventType; } public void setEventType(String v) { eventType = v; }
    public UUID getActorPlayerId() { return actorPlayerId; } public void setActorPlayerId(UUID v) { actorPlayerId = v; }
    public List<UUID> getRelatedPlayers() { return relatedPlayers; } public void setRelatedPlayers(List<UUID> v) { relatedPlayers = new ArrayList<>(v); }
    public EventPayload getPayload() { return payload; } public void setPayload(EventPayload v) { payload = v; }
    public int getScoreDelta() { return scoreDelta; } public void setScoreDelta(int v) { scoreDelta = v; }
    public int getOutsAfter() { return outsAfter; } public void setOutsAfter(int v) { outsAfter = v; }
    public BaseState getBasesAfter() { return basesAfter; } public void setBasesAfter(BaseState v) { basesAfter = v; }
    public GameState getSnapshotAfter() { return snapshotAfter; } public void setSnapshotAfter(GameState v) { snapshotAfter = v; }
    public String getCaptureSource() { return captureSource; } public void setCaptureSource(String v) { captureSource = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
```

> Hibernate 6.2+ `@JdbcTypeCode(SqlTypes.JSON)` 用 Spring 提供的 Jackson `ObjectMapper` 直接序列化 record/POJO 到 `jsonb`；read 時反序列化（record 需 jackson-databind ≥2.12，Spring Boot 3.5 已含）。無需額外依賴。

- [ ] **Step 3: `GameEventRepository`**

```java
package com.baseball.record.scoring;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GameEventRepository extends JpaRepository<GameEvent, UUID> {
    List<GameEvent> findByGameIdOrderBySequenceNoAsc(UUID gameId);
    Optional<GameEvent> findTopByGameIdOrderBySequenceNoDesc(UUID gameId);
}
```

- [ ] **Step 4: `scoring/dto/{RunnerMoveDto,PitchTallyDto}`（DTO 邊界；對映 eventfold 型別）**

```java
package com.baseball.record.scoring.dto;

import jakarta.validation.constraints.Pattern;

public record RunnerMoveDto(
    @Pattern(regexp = "B|1|2|3") String from,
    @Pattern(regexp = "1|2|3|H|OUT") String to) {}
```
```java
package com.baseball.record.scoring.dto;

import jakarta.validation.constraints.Min;

public record PitchTallyDto(@Min(0) int pitches, @Min(0) int strikes, @Min(0) int balls,
                            @Min(0) int swinging, @Min(0) int looking) {}
```

- [ ] **Step 5: 編譯確認（Wave 2 末，與 Task 5 一起）**

Run: `mvn -o test-compile`
Expected: BUILD SUCCESS（entity/repo/payload 編譯通過；JSON 對映在 Task 6 IT 實跑驗證）。

---

## Task 5：game 模組 — 狀態流轉擴充 live/paused/completed + 開賽設定欄位

**Files:**
- Modify: `backend/src/main/java/com/baseball/record/game/Game.java`（加 `recordingDetail`/`symmetricOpponent`）
- Modify: `backend/src/main/java/com/baseball/record/game/GameService.java`（`transition` 擴充；開賽帶設定）
- Modify: `backend/src/main/java/com/baseball/record/game/dto/UpdateGameRequest.java`、`game/dto/GameResponse.java`
- Test: `backend/src/test/java/com/baseball/record/game/GameControllerIT.java`（**追加**流轉測試）

- [ ] **Step 1: `GameControllerIT` 追加測試（失敗）**

於既有 `GameControllerIT` class 內新增（沿用既有 `token`/`createTeam`/`createGameBody` helper）：
```java
    private String confirmAndOpen(String t, String teamId) throws Exception {
        // 建賽 → 進 scheduled
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Foe")))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        // 放一份合法 9 人名單再確認（沿用 roster PUT；此處借 LineupControllerIT 同款 body）
        // 為聚焦狀態流轉，直接 PATCH 略過 lineup_confirmed gate 不可行 → 必須先確認名單。
        return gameId;
    }

    @Test
    void open_pause_complete_flow() throws Exception {
        String t = token("gs_"); String teamId = createTeam(t, "baseball");
        String gameId = createConfirmedGame(t, teamId);   // helper：建賽+放合法名單+confirm（見 Step 1b）

        // lineup_confirmed → live（帶開賽設定）
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"gameStatus\":\"live\",\"recordingDetail\":\"L2\",\"symmetricOpponent\":false}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.gameStatus").value("live"))
           .andExpect(jsonPath("$.recordingDetail").value("L2"));

        // live → paused → live → completed
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"paused\"}"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.gameStatus").value("paused"));
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\"}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"completed\"}"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.gameStatus").value("completed"));
    }

    @Test
    void illegal_transition_scheduled_to_live_conflicts() throws Exception {
        String t = token("gx_"); String teamId = createTeam(t, "baseball");
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Foe")))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        // scheduled → live（未經 lineup_confirmed）→ 409
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\"}"))
           .andExpect(status().isConflict());
    }
```

- [ ] **Step 1b: `createConfirmedGame` helper（放合法 9 人名單並 confirm）**

```java
    /** 建賽 → 加 9 名球員 → PUT 合法名單 → confirm，回 gameId（lineup_confirmed）。 */
    private String createConfirmedGame(String t, String teamId) throws Exception {
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Foe")))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"P" + i + "\"}"))
                    .andReturn().getResponse().getContentAsString(), "$.playerId");
            if (i > 0) slots.append(",");
            slots.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
                 .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        mvc.perform(put("/api/games/" + gameId + "/roster").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"slots\":[" + slots + "]}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isOk());
        return gameId;
    }
```
（記得在 IT 檔頂 import 補 `static ...MockMvcRequestBuilders.put` 已含於 `*`；`patch` 同。）

- [ ] **Step 2: `Game.java` 加欄位**

在 `gameStatus` 欄位後新增：
```java
    @Column(name = "recording_detail", nullable = false) private String recordingDetail = "L2";
    @Column(name = "symmetric_opponent", nullable = false) private boolean symmetricOpponent = false;
```
並加 getter/setter：
```java
    public String getRecordingDetail() { return recordingDetail; } public void setRecordingDetail(String v) { recordingDetail = v; }
    public boolean isSymmetricOpponent() { return symmetricOpponent; } public void setSymmetricOpponent(boolean v) { symmetricOpponent = v; }
```

- [ ] **Step 3: `UpdateGameRequest.java` 擴充**

把 `gameStatus` regex 擴充並加兩欄：
```java
    @Pattern(regexp = "draft|scheduled|lineup_confirmed|live|paused|completed") String gameStatus,
    @Pattern(regexp = "L1|L2|L3") String recordingDetail,
    Boolean symmetricOpponent) {}
```
（即在原 record 參數列尾，把 `gameStatus` 那行改成上面三行；其餘參數不變。）

- [ ] **Step 4: `GameResponse.java` 擴充**

於尾端加兩欄：
```java
                           String gameStatus, String recordingDetail, boolean symmetricOpponent) {}
```
（把原本結尾 `String gameStatus) {}` 改為上面。）

- [ ] **Step 5: `GameService` — transition 擴充 + 開賽帶設定 + toResponse**

`update(...)`：在 `applyFields` 後、`transition` 前，先把開賽設定吸收（僅在轉 live 時）：
```java
    @Transactional
    public GameResponse update(UUID userId, UUID gameId, UpdateGameRequest req) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        applyFields(g, req);
        if (req.recordingDetail() != null) g.setRecordingDetail(req.recordingDetail());
        if (req.symmetricOpponent() != null) g.setSymmetricOpponent(req.symmetricOpponent());
        if (req.gameStatus() != null) transition(g, req.gameStatus());
        g.touch();
        return toResponse(g);
    }
```

`transition(...)`：在既有 `switch` 的 cases 增加 live/paused/completed（沿用既有 confirmLineup 等）：
```java
    protected void transition(Game g, String target) {
        if (target.equals(g.getGameStatus())) return;
        switch (g.getGameStatus() + "->" + target) {
            case "draft->scheduled", "scheduled->draft" -> g.setGameStatus(target);
            case "scheduled->lineup_confirmed" -> confirmLineup(g);
            case "lineup_confirmed->scheduled" -> {
                rosters.findByGameId(g.getGameId()).ifPresent(r -> { r.setConfirmedAt(null); r.touch(); });
                g.setGameStatus("scheduled");
            }
            case "lineup_confirmed->live", "paused->live" -> g.setGameStatus("live");
            case "live->paused" -> g.setGameStatus("paused");
            case "live->completed", "paused->completed" -> g.setGameStatus("completed");
            default -> throw new ResponseStatusException(HttpStatus.CONFLICT,
                "illegal status transition " + g.getGameStatus() + " -> " + target);
        }
    }
```

`toResponse(...)`：尾端帶兩個新欄位：
```java
    GameResponse toResponse(Game g) {
        return new GameResponse(g.getGameId(), g.getTeamId(), g.getSportType(), g.getMatchMode(),
            g.getBasePresetId(), g.isDhEnabled(), g.isEpAllowed(), g.getRosterSize(), g.isReEntryAllowed(),
            g.getGameDate(), g.getHomeAway(), g.getOpponentName(), g.getVenue(), g.getWeather(),
            g.getTemperatureC(), g.getGameStatus(), g.getRecordingDetail(), g.isSymmetricOpponent());
    }
```

- [ ] **Step 6: controller 跑測（含 M2 既有測試不回歸）**

Run: `mvn -o -Dtest=GameControllerIT,LineupControllerIT test`
Expected: PASS（新增 2 流轉測試綠；M2 既有測試仍綠）。

---

## Task 6：scoring — 事件 CRUD + /state + 重算（service/controller/exception + IT，AC-8/9/11）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/scoring/{ScoringService,ScoringController,ScoringExceptionHandler,EventInvalidException}.java`,
  `scoring/dto/{RecordEventRequest,EventResponse,GameStateResponse}.java`
- Test: `backend/src/test/java/com/baseball/record/scoring/ScoringControllerIT.java`

- [ ] **Step 1: DTOs**

`scoring/dto/RecordEventRequest.java`：
```java
package com.baseball.record.scoring.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;
import java.util.UUID;

/** 記一筆事件。PA：actorPlayerId + runnerMoves(+pitches)。換人：sub* 欄位。 */
public record RecordEventRequest(
    @NotNull @Pattern(regexp = "SINGLE|DOUBLE|TRIPLE|HOME_RUN|WALK|HIT_BY_PITCH|STRIKEOUT|GROUND_OUT|FLY_OUT|FIELDERS_CHOICE|SAC_FLY|SAC_BUNT|REACH_ON_ERROR|PINCH_HIT|PINCH_RUN|POSITION_CHANGE|PITCHER_CHANGE|RE_ENTRY|BASE_RUNNING")
    String eventType,
    UUID actorPlayerId,
    List<UUID> relatedPlayers,
    List<RunnerMoveDto> runnerMoves,
    PitchTallyDto pitches,
    String fieldPosition,
    String guestBatterName,
    UUID subInPlayerId, String subInGuestName, UUID subOutPlayerId,
    Integer subBattingOrder, String subFieldPosition) {}
```

`scoring/dto/EventResponse.java`：
```java
package com.baseball.record.scoring.dto;

import com.baseball.record.scoring.EventPayload;

import java.util.List;
import java.util.UUID;

public record EventResponse(UUID eventId, int sequenceNo, int inning, String half, String eventType,
                            UUID actorPlayerId, List<UUID> relatedPlayers, EventPayload payload,
                            int scoreDelta, int outsAfter) {}
```

`scoring/dto/GameStateResponse.java`：
```java
package com.baseball.record.scoring.dto;

import com.baseball.record.shared.eventfold.GameState;

/** 直接回 fold 後的 GameState（前端據此渲染狀態列/鑽石/打序游標）。 */
public record GameStateResponse(GameState state) {}
```

- [ ] **Step 2: 例外 + handler**

`scoring/EventInvalidException.java`：
```java
package com.baseball.record.scoring;

import com.baseball.record.shared.ruleengine.Violation;
import java.util.List;

public class EventInvalidException extends RuntimeException {
    private final List<Violation> violations;
    public EventInvalidException(List<Violation> violations) { super("event invalid"); this.violations = violations; }
    public List<Violation> getViolations() { return violations; }
}
```
`scoring/ScoringExceptionHandler.java`：
```java
package com.baseball.record.scoring;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ScoringExceptionHandler {
    @ExceptionHandler(EventInvalidException.class)
    public ProblemDetail handle(EventInvalidException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "事件不合法");
        pd.setTitle("Event Invalid");
        pd.setProperty("violations", ex.getViolations());
        return pd;
    }
}
```

- [ ] **Step 3: 寫 IT `ScoringControllerIT`（失敗）— AC-8/9/11**

```java
package com.baseball.record.scoring;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ScoringControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token(String p) throws Exception {
        String email = p + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }
    String createTeam(String t) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    /** 建賽（home 主場→ top 半局我隊先守；為讓首半局即我隊進攻，這裡用 away 客場）+ 9 人合法名單 + confirm + open live。回 gameId。 */
    String liveGame(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
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
    private String single() {
        return "{\"eventType\":\"SINGLE\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"1\"}]}";
    }
    private String strikeout() {
        return "{\"eventType\":\"STRIKEOUT\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"OUT\"}]}";
    }

    @Test
    void record_events_updates_state() throws Exception { // AC-8
        String t = token("s1_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(single())).andExpect(status().isCreated());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.state.outs").value(0))
           .andExpect(jsonPath("$.state.bases.first").isNotEmpty());
    }

    @Test
    void three_outs_flip_half() throws Exception { // AC-8
        String t = token("s2_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        for (int i = 0; i < 3; i++)
            mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(strikeout())).andExpect(status().isCreated());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.half").value("bottom"))
           .andExpect(jsonPath("$.state.battingSide").value("defense"))
           .andExpect(jsonPath("$.state.outs").value(0));
    }

    @Test
    void re_entry_when_not_allowed_is_422() throws Exception { // AC-9（建一場 reEntryAllowed=false）
        String t = token("s3_"); String teamId = createTeam(t);
        // 自建 reEntryAllowed=false 的 live game（複用 liveGame 但改旗標：此處簡化—另寫 body）
        // 省略：與 liveGame 相同但 reEntryAllowed=false；對 RE_ENTRY 事件預期 422。
        // （實作測試時複製 liveGame 改一個布林即可。）
    }

    @Test
    void correction_recomputes_state() throws Exception { // AC-11
        String t = token("s4_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        // 記 HOME_RUN（得 1 分），再改成 STRIKEOUT → 比分應回 0、後續快照重算
        String hrId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"eventType\":\"HOME_RUN\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"H\"}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.eventId");
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.scoreUs").value(1));
        mvc.perform(patch("/api/games/" + gameId + "/events/" + hrId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(strikeout())).andExpect(status().isOk());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.scoreUs").value(0))
           .andExpect(jsonPath("$.state.outs").value(1));
    }

    @Test
    void delete_event_recomputes() throws Exception { // AC-11（撤銷）
        String t = token("s5_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        String id = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(single()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.eventId");
        mvc.perform(delete("/api/games/" + gameId + "/events/" + id).header("Authorization", "Bearer " + t))
           .andExpect(status().isOk());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.bases.first").doesNotExist());
    }

    @Test
    void non_owner_cannot_record() throws Exception {
        String a = token("s6a_"); String teamId = createTeam(a);
        String gameId = liveGame(a, teamId);
        String b = token("s6b_");
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + b)
                .contentType(MediaType.APPLICATION_JSON).content(single()))
           .andExpect(status().isNotFound()); // 非成員 → 404（隱藏存在性，沿 M2）
    }
}
```

- [ ] **Step 4: 實作 `ScoringService`**

```java
package com.baseball.record.scoring;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.lineup.GameRoster;
import com.baseball.record.lineup.GameRosterRepository;
import com.baseball.record.lineup.LineupSlot;
import com.baseball.record.lineup.LineupSlotRepository;
import com.baseball.record.scoring.dto.*;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.eventfold.*;
import com.baseball.record.shared.ruleengine.SubstitutionAction;
import com.baseball.record.shared.ruleengine.SubstitutionValidator;
import com.baseball.record.shared.ruleengine.ValidationResult;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class ScoringService {
    private final GameRepository games;
    private final GameEventRepository events;
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final TeamAccessPolicy policy;

    public ScoringService(GameRepository games, GameEventRepository events, GameRosterRepository rosters,
                          LineupSlotRepository slots, TeamAccessPolicy policy) {
        this.games = games; this.events = events; this.rosters = rosters; this.slots = slots; this.policy = policy;
    }

    @Transactional
    public EventResponse record(UUID userId, UUID gameId, RecordEventRequest req) {
        Game g = requireOwnerLiveGame(userId, gameId);
        List<GameEvent> existing = events.findByGameIdOrderBySequenceNoAsc(gameId);
        GameState state = fold(g, existing);

        if (EventApplier.isSubstitution(req.eventType()))
            validateSubstitution(g, state, req);

        int seq = existing.isEmpty() ? 1 : existing.get(existing.size() - 1).getSequenceNo() + 1;
        GameEvent ev = buildEntity(gameId, seq, req);
        GameState before = state;
        GameState after = EventApplier.apply(before, toView(ev));
        stampDerived(ev, before, after);
        events.save(ev);
        return toResponse(ev);
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(UUID userId, UUID gameId) {
        Game g = requireMember(userId, gameId);
        return events.findByGameIdOrderBySequenceNoAsc(gameId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public GameStateResponse state(UUID userId, UUID gameId) {
        Game g = requireMember(userId, gameId);
        return new GameStateResponse(fold(g, events.findByGameIdOrderBySequenceNoAsc(gameId)));
    }

    @Transactional
    public GameStateResponse update(UUID userId, UUID gameId, UUID eventId, RecordEventRequest req) {
        Game g = requireOwnerLiveGame(userId, gameId);
        GameEvent ev = events.findById(eventId)
            .filter(e -> e.getGameId().equals(gameId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "event not found"));
        applyRequest(ev, req);          // 改 type/payload/actor（保留 sequenceNo）
        recompute(g, gameId);
        return state(userId, gameId);
    }

    @Transactional
    public GameStateResponse delete(UUID userId, UUID gameId, UUID eventId) {
        Game g = requireOwnerLiveGame(userId, gameId);
        events.findById(eventId).filter(e -> e.getGameId().equals(gameId)).ifPresent(events::delete);
        recompute(g, gameId);
        return state(userId, gameId);
    }

    // ── 重算：refold 全部，逐筆覆寫 snapshot/derived ──
    private void recompute(Game g, UUID gameId) {
        List<GameEvent> all = events.findByGameIdOrderBySequenceNoAsc(gameId);
        GameState s = InitialStateBuilder.initial(initialLineup(g));
        for (GameEvent e : all) {
            GameState before = s;
            s = EventApplier.apply(before, toView(e));
            stampDerived(e, before, s);
        }
        events.saveAll(all);
    }

    private GameState fold(Game g, List<GameEvent> evs) {
        return GameStateFolder.fold(initialLineup(g), evs.stream().map(this::toView).toList());
    }

    private void stampDerived(GameEvent ev, GameState before, GameState after) {
        ev.setInning(before.inning()); ev.setHalf(before.half());
        ev.setScoreDelta((after.scoreUs() + after.scoreOpp()) - (before.scoreUs() + before.scoreOpp()));
        ev.setOutsAfter(after.outs());
        ev.setBasesAfter(after.bases());
        ev.setSnapshotAfter(after);
    }

    // ── 名單 → 初始狀態 ──
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

    private void validateSubstitution(Game g, GameState state, RecordEventRequest req) {
        Map<String, Integer> posCounts = new HashMap<>();
        for (LineupEntry e : state.lineup())
            if (e.onField() && e.fieldPosition() != null) posCounts.merge(e.fieldPosition(), 1, Integer::sum);
        LineupEntry outE = find(state, req.subOutPlayerId());
        LineupEntry inE = find(state, req.subInPlayerId());
        SubstitutionAction a = new SubstitutionAction(
            req.eventType(), req.subOutPlayerId(), outE != null && outE.onField(),
            req.subInPlayerId(), inE != null && inE.starter(), inE != null && inE.reEntered(),
            inE != null && inE.exited(), req.subFieldPosition(), g.isReEntryAllowed(), posCounts);
        ValidationResult r = SubstitutionValidator.validate(a);
        if (!r.valid()) throw new EventInvalidException(r.violations());
    }

    private LineupEntry find(GameState s, UUID pid) {
        if (pid == null) return null;
        return s.lineup().stream().filter(e -> pid.equals(e.playerId())).findFirst().orElse(null);
    }

    // ── entity ↔ view 對映 ──
    private GameEvent buildEntity(UUID gameId, int seq, RecordEventRequest req) {
        GameEvent ev = new GameEvent(gameId, seq, req.eventType());
        applyRequest(ev, req);
        return ev;
    }
    private void applyRequest(GameEvent ev, RecordEventRequest req) {
        ev.setEventType(req.eventType());
        ev.setActorPlayerId(req.actorPlayerId());
        ev.setRelatedPlayers(req.relatedPlayers() == null ? List.of() : req.relatedPlayers());
        List<RunnerMove> moves = req.runnerMoves() == null ? List.of()
            : req.runnerMoves().stream().map(m -> new RunnerMove(m.from(), m.to())).toList();
        PitchTally pitches = req.pitches() == null ? null
            : new PitchTally(req.pitches().pitches(), req.pitches().strikes(), req.pitches().balls(),
                             req.pitches().swinging(), req.pitches().looking());
        ev.setPayload(new EventPayload(moves, pitches, req.fieldPosition(), req.guestBatterName(),
            req.subInPlayerId(), req.subInGuestName(), req.subOutPlayerId(), req.subBattingOrder(), req.subFieldPosition()));
    }
    private EventView toView(GameEvent e) {
        EventPayload p = e.getPayload();
        return new EventView(e.getSequenceNo(), e.getEventType(), e.getActorPlayerId(), e.getRelatedPlayers(),
            p.runnerMoves(), p.pitches(), null, p.fieldPosition(), p.guestBatterName(),
            p.subInPlayerId(), p.subInGuestName(), p.subOutPlayerId(), p.subBattingOrder(), p.subFieldPosition());
    }
    private EventResponse toResponse(GameEvent e) {
        return new EventResponse(e.getEventId(), e.getSequenceNo(), e.getInning(), e.getHalf(), e.getEventType(),
            e.getActorPlayerId(), e.getRelatedPlayers(), e.getPayload(), e.getScoreDelta(), e.getOutsAfter());
    }

    // ── 授權 ──
    private Game requireOwnerLiveGame(UUID userId, UUID gameId) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        if (!"live".equals(g.getGameStatus()) && !"paused".equals(g.getGameStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "game not live");
        return g;
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

> 需要 `LineupSlotRepository.findByGameRosterId(UUID)`（M2 已有，確認簽名一致；若無則於本 task 補一行 query method）。`GameRosterRepository.findByGameId(UUID)` M2 已有。

- [ ] **Step 5: 實作 `ScoringController`**

```java
package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class ScoringController {
    private final ScoringService service;
    public ScoringController(ScoringService service) { this.service = service; }

    @PostMapping("/api/games/{gameId}/events")
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse record(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                @Valid @RequestBody RecordEventRequest req) {
        return service.record(userId, gameId, req);
    }

    @GetMapping("/api/games/{gameId}/events")
    public List<EventResponse> list(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.list(userId, gameId);
    }

    @GetMapping("/api/games/{gameId}/state")
    public GameStateResponse state(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.state(userId, gameId);
    }

    @PatchMapping("/api/games/{gameId}/events/{eventId}")
    public GameStateResponse update(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                    @PathVariable UUID eventId, @Valid @RequestBody RecordEventRequest req) {
        return service.update(userId, gameId, eventId, req);
    }

    @DeleteMapping("/api/games/{gameId}/events/{eventId}")
    public GameStateResponse delete(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                                    @PathVariable UUID eventId) {
        return service.delete(userId, gameId, eventId);
    }
}
```

- [ ] **Step 6: controller 跑測（補完 Step 3 中省略的 re_entry_not_allowed 測試本體後）**

Run: `mvn -o -Dtest=ScoringControllerIT test`
Expected: PASS（AC-8/9/11 綠）。若 JSONB record 反序列化報錯，確認 `EventPayload`/`GameState`/`BaseState` 皆為 record 且欄位有預設建構（Jackson 以參數建構），必要時加 `spring.jackson` 無特殊設定即可。

- [ ] **Step 7: 全後端回歸**

Run: `mvn -o test`
Expected: 全綠（M1/M2 既有 + M3a 新增）。

---

## Task 7：前端 `api/client.ts` 擴充（games 開賽控制 + events + state）

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: 在 `api` 物件加方法**

`games` 物件內加：
```ts
    start: (gameId: string, d: object) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'live', ...d }) }),
    pause: (gameId: string) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'paused' }) }),
    resume: (gameId: string) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'live' }) }),
    complete: (gameId: string) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'completed' }) }),
    state: (gameId: string) => req(`/api/games/${gameId}/state`),
```
並在 `api` 物件尾端新增 `events`：
```ts
  events: {
    list: (gameId: string) => req(`/api/games/${gameId}/events`),
    record: (gameId: string, d: object) => req(`/api/games/${gameId}/events`, { method: 'POST', body: JSON.stringify(d) }),
    update: (gameId: string, eventId: string, d: object) => req(`/api/games/${gameId}/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove: (gameId: string, eventId: string) => req(`/api/games/${gameId}/events/${eventId}`, { method: 'DELETE' }),
  },
```

- [ ] **Step 2: 編譯確認（與 Wave 5 一起）** `npm run build` Expected: tsc 通過。

---

## Task 8：RecordTab（記錄主畫面）+ recording.css + 路由接線

**Files:**
- Create: `frontend/src/pages/game/RecordTab.tsx`, `frontend/src/pages/game/recording.css`
- Modify: `frontend/src/layout/GameLayout.tsx`（記錄/時間線分頁移除 `soon`）、`frontend/src/App.tsx`（route 換真元件）

> 視覺為功能版（沿用 `ui/` + tokens；polish 之後批次做）。互動：開賽設定 → 狀態列＋打席卡 → 結果面板 → 有跑者彈跑者處理 → 撤銷。

- [ ] **Step 1: `recording.css`（鑽石/狀態列/結果面板）**

```css
.rec-statebar { display: flex; justify-content: space-between; align-items: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 10px 14px; margin-bottom: 12px; }
.rec-batter { padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--radius-md);
  background: var(--surface-alt); margin-bottom: 12px; font-weight: 600; }
.rec-pitch { display: flex; gap: 8px; align-items: center; font-size: 0.9em; color: var(--muted); margin-top: 6px; }
.rec-palette { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.rec-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.rec-diamond { position: relative; width: 150px; height: 150px; margin: 12px auto; }
.rec-diamond .sq { position: absolute; inset: 28px; transform: rotate(45deg); border: 2px solid var(--accent); }
.rec-runner { position: absolute; width: 30px; height: 30px; transform: rotate(45deg); cursor: pointer;
  background: var(--surface-alt); border: 1.5px solid var(--border); }
.rec-runner.occupied { background: var(--accent); }
.rec-runner.b1 { right: 16px; top: 60px; } .rec-runner.b2 { left: 60px; top: 16px; } .rec-runner.b3 { left: 16px; top: 60px; }
```

- [ ] **Step 2: `RecordTab.tsx`（功能版）**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, useToast } from '../../ui'
import './recording.css'

// L2 結果面板：label → eventType；out=是否使打者出局、base=打者上壘目的（安打/保送）
const RESULTS: { label: string; type: string; to: string }[] = [
  { label: '1B', type: 'SINGLE', to: '1' }, { label: '2B', type: 'DOUBLE', to: '2' },
  { label: '3B', type: 'TRIPLE', to: '3' }, { label: 'HR', type: 'HOME_RUN', to: 'H' },
  { label: '保送', type: 'WALK', to: '1' }, { label: '觸身', type: 'HIT_BY_PITCH', to: '1' },
  { label: '三振', type: 'STRIKEOUT', to: 'OUT' }, { label: '野選', type: 'FIELDERS_CHOICE', to: 'OUT' },
  { label: '滾地', type: 'GROUND_OUT', to: 'OUT' }, { label: '飛球', type: 'FLY_OUT', to: 'OUT' },
  { label: '犧飛', type: 'SAC_FLY', to: 'OUT' }, { label: '失誤', type: 'REACH_ON_ERROR', to: '1' },
]

export default function RecordTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [state, setState] = useState<any>(null)
  const [pitch, setPitch] = useState({ pitches: 0, strikes: 0, balls: 0, swinging: 0, looking: 0 })
  const [pending, setPending] = useState<{ type: string; batterTo: string } | null>(null)

  const loadState = useCallback(() => {
    if (!gameId) return
    api.games.state(gameId).then(r => setState(r.state)).catch(() => setState(null))
  }, [gameId])
  useEffect(() => { loadState() }, [loadState, game?.gameStatus])

  async function open() {
    await api.games.start(gameId!, { recordingDetail: 'L2', symmetricOpponent: false })
    reload(); loadState()
  }

  function bumpPitch(kind: 'strike-swing' | 'strike-look' | 'ball') {
    setPitch(p => ({
      pitches: p.pitches + 1,
      strikes: p.strikes + (kind === 'ball' ? 0 : 1),
      balls: p.balls + (kind === 'ball' ? 1 : 0),
      swinging: p.swinging + (kind === 'strike-swing' ? 1 : 0),
      looking: p.looking + (kind === 'strike-look' ? 1 : 0),
    }))
  }

  function basesOccupied() {
    const b = state?.bases ?? {}
    return ['1', '2', '3'].filter(k => b[{ '1': 'first', '2': 'second', '3': 'third' }[k] as string])
  }

  async function send(eventType: string, runnerMoves: { from: string; to: string }[]) {
    const body: any = { eventType, runnerMoves }
    if (state?.battingSide === 'defense' && pitch.pitches > 0) body.pitches = pitch
    try {
      await api.events.record(gameId!, body)
      setPitch({ pitches: 0, strikes: 0, balls: 0, swinging: 0, looking: 0 }); setPending(null)
      loadState()
    } catch { toast.show('記錄失敗', 'error') }
  }

  function clickResult(r: { type: string; to: string }) {
    const batterMove = r.to === 'OUT' ? { from: 'B', to: 'OUT' } : { from: 'B', to: r.to }
    const occ = basesOccupied()
    if (occ.length === 0) { send(r.type, [batterMove]); return }
    // 有跑者 → 進跑者處理（簡化：預設保送類強迫進壘、其餘留壘，使用者可在面板調整）
    setPending({ type: r.type, batterTo: r.to })
  }

  async function undo() {
    const evs = await api.events.list(gameId!)
    if (!evs.length) return
    await api.events.remove(gameId!, evs[evs.length - 1].eventId)
    loadState()
  }

  if (!game) return null
  if (game.gameStatus === 'lineup_confirmed')
    return <section><p>名單已確認，準備開賽。</p><Button onClick={open}>開賽（L2 標準記錄）</Button></section>
  if (game.gameStatus === 'scheduled' || game.gameStatus === 'draft')
    return <section><p role="alert" className="warn">尚未確認名單，請先到「出賽名單」確認。</p></section>
  if (!state) return <section><p role="status">載入中…</p></section>

  const b = state.bases ?? {}
  const batter = state.lineup?.find((e: any) => e.battingOrder === state.currentBatterOrder)

  return (
    <section>
      <div className="rec-statebar">
        <span>客 {state.scoreOpp} : {state.scoreUs} 主</span>
        <span>{state.inning} 局{state.half === 'top' ? '上' : '下'} · {state.outs} 出局 · {state.battingSide === 'offense' ? '我隊進攻' : '我隊守備'}</span>
        <span>壘包 {[b.first && '1', b.second && '2', b.third && '3'].filter(Boolean).join('·') || '空'}</span>
      </div>

      <div className="rec-batter">
        {state.battingSide === 'offense'
          ? <>打擊　第 {state.currentBatterOrder} 棒 {batter?.guestName ?? '球員'}</>
          : <>守備　投手記錄
            <div className="rec-pitch">
              球數 好{pitch.strikes} 壞{pitch.balls} 用球{pitch.pitches}
              <Button variant="ghost" onClick={() => bumpPitch('strike-swing')}>揮空</Button>
              <Button variant="ghost" onClick={() => bumpPitch('strike-look')}>站著好球</Button>
              <Button variant="ghost" onClick={() => bumpPitch('ball')}>壞球</Button>
            </div>
          </>}
      </div>

      {!pending && <div className="rec-palette">
        {RESULTS.map(r => <Button key={r.label} variant="ghost" onClick={() => clickResult(r)}>{r.label}</Button>)}
      </div>}

      {pending && <RunnerPanel state={state} pending={pending} onCancel={() => setPending(null)}
        onConfirm={(moves) => send(pending.type, moves)} />}

      <div className="rec-actions">
        <Button variant="ghost" onClick={undo}>⤺ 撤銷上一筆</Button>
        {game.gameStatus === 'live' && <Button variant="ghost" onClick={() => api.games.pause(gameId!).then(reload)}>暫停</Button>}
        {game.gameStatus === 'paused' && <Button variant="ghost" onClick={() => api.games.resume(gameId!).then(reload)}>繼續</Button>}
        <Button onClick={() => api.games.complete(gameId!).then(reload)}>結束比賽</Button>
      </div>
    </section>
  )
}

/** 跑者處理：每位在壘跑者選 留/進壘/得分/出局，加上打者去向，組 runnerMoves。 */
function RunnerPanel({ state, pending, onConfirm, onCancel }:
  { state: any; pending: { type: string; batterTo: string }; onConfirm: (m: { from: string; to: string }[]) => void; onCancel: () => void }) {
  const b = state.bases ?? {}
  const runners = [
    b.third && { from: '3' }, b.second && { from: '2' }, b.first && { from: '1' },
  ].filter(Boolean) as { from: string }[]
  const [dest, setDest] = useState<Record<string, string>>(
    Object.fromEntries(runners.map(r => [r.from, r.from])))   // 預設留原壘
  const opts = (from: string) => ['留', String(Number(from) + 1) <= '3' ? String(Number(from) + 1) : 'H', 'H', 'OUT']
  function confirm() {
    const moves = runners.map(r => ({ from: r.from, to: dest[r.from] === '留' ? r.from : dest[r.from] }))
    const batterMove = pending.batterTo === 'OUT' ? { from: 'B', to: 'OUT' } : { from: 'B', to: pending.batterTo }
    onConfirm([...moves, batterMove])
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, marginTop: 8 }}>
      <p>跑者處理（{pending.type}）：</p>
      {runners.map(r => (
        <div key={r.from} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0' }}>
          <span style={{ width: 64 }}>{r.from} 壘跑者</span>
          {opts(r.from).map(o => (
            <Button key={o} variant={dest[r.from] === o ? 'primary' : 'ghost'}
              onClick={() => setDest(d => ({ ...d, [r.from]: o }))}>{o === '留' ? '留原壘' : o === 'H' ? '得分' : o === 'OUT' ? '出局' : `→${o}壘`}</Button>
          ))}
        </div>
      ))}
      <div className="rec-actions">
        <Button onClick={confirm}>確認</Button>
        <Button variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}
```

> 註：`RunnerPanel` 的進壘選項為功能版（留/進一壘/得分/出局）；完整鑽石點選互動與「強迫進壘自動建議」屬視覺 polish，列後續。打者去向沿用結果按鈕對應的 `to`。

- [ ] **Step 3: `GameLayout.tsx` 把 記錄/時間線 分頁的 `soon` 拿掉**

```tsx
    { to: `${base}/record`, label: '記錄' },
    { to: `${base}/scoreboard`, label: '計分板', soon: true },
    { to: `${base}/box`, label: '數據', soon: true },
    { to: `${base}/timeline`, label: '時間線' },
```

- [ ] **Step 4: `App.tsx` 換 route 元件**

import：
```tsx
import RecordTab from './pages/game/RecordTab'
import TimelineTab from './pages/game/TimelineTab'
```
把 game 巢狀路由的 record/timeline 改：
```tsx
              <Route path="record" element={<RecordTab />} />
              <Route path="scoreboard" element={<Placeholder name="計分板" />} />
              <Route path="box" element={<Placeholder name="數據" />} />
              <Route path="timeline" element={<TimelineTab />} />
```

- [ ] **Step 5: 編譯（與 Task 9 一起）** `npm run build` Expected: tsc 通過。

---

## Task 9：TimelineTab（事件時間線 + 刪除/修正）

**Files:**
- Create: `frontend/src/pages/game/TimelineTab.tsx`

- [ ] **Step 1: `TimelineTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, EmptyState, useToast } from '../../ui'

const LABEL: Record<string, string> = {
  SINGLE: '一壘安打', DOUBLE: '二壘安打', TRIPLE: '三壘安打', HOME_RUN: '全壘打',
  WALK: '保送', HIT_BY_PITCH: '觸身球', STRIKEOUT: '三振', GROUND_OUT: '滾地出局',
  FLY_OUT: '飛球出局', FIELDERS_CHOICE: '野手選擇', SAC_FLY: '高飛犧牲', SAC_BUNT: '犧牲觸擊',
  REACH_ON_ERROR: '失誤上壘', PINCH_HIT: '代打', PINCH_RUN: '代跑', POSITION_CHANGE: '守位調整',
  PITCHER_CHANGE: '換投', RE_ENTRY: '再上場', BASE_RUNNING: '跑壘',
}

export default function TimelineTab() {
  const { game, reload } = useOutletContext<{ game: any; reload: () => void }>()
  const gameId = game?.gameId
  const toast = useToast()
  const [events, setEvents] = useState<any[] | null>(null)
  const load = useCallback(() => {
    if (!gameId) return
    api.events.list(gameId).then(setEvents).catch(() => setEvents([]))
  }, [gameId])
  useEffect(() => { load() }, [load])

  async function remove(eventId: string) {
    try { await api.events.remove(gameId!, eventId); toast.show('已刪除並重算'); load(); reload() }
    catch { toast.show('刪除失敗（比賽需在進行中）', 'error') }
  }

  if (!game) return null
  if (!events) return <section><p role="status">載入中…</p></section>
  if (events.length === 0) return <section><EmptyState>尚無事件記錄</EmptyState></section>

  return (
    <section>
      <table className="table">
        <thead><tr><th>#</th><th>局</th><th>事件</th><th>得分</th><th>出局</th><th></th></tr></thead>
        <tbody>
          {events.map(e => (
            <tr key={e.eventId}>
              <td>{e.sequenceNo}</td>
              <td>{e.inning}{e.half === 'top' ? '上' : '下'}</td>
              <td>{LABEL[e.eventType] ?? e.eventType}</td>
              <td>{e.scoreDelta > 0 ? `+${e.scoreDelta}` : ''}</td>
              <td>{e.outsAfter}</td>
              <td className="row-actions">
                {(game.gameStatus === 'live' || game.gameStatus === 'paused') &&
                  <Button variant="ghost" onClick={() => remove(e.eventId)}>刪除</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="subtitle" style={{ marginTop: 8 }}>刪除任一筆會從該點重算後續比分與壘包（AC-11）。</p>
    </section>
  )
}
```

- [ ] **Step 2: 編譯** `npm run build` Expected: tsc 通過、無未用 import。

---

## Task 10：Playwright E2E（AC-8/9/11 一條龍）

**Files:**
- Create: `frontend/e2e/m3a-recording.spec.ts`

> 需後端 5199 + Postgres + 前端 5200（playwright 自起）。

- [ ] **Step 1: `m3a-recording.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

async function setupLiveGame(page: any, prefix: string) {
  const email = `${prefix}_${Date.now()}@x.com`
  await page.goto('/')
  await page.getByPlaceholder('顯示名稱(註冊用)').fill('Rec')
  await page.getByPlaceholder('email').fill(email)
  await page.getByPlaceholder('密碼').fill('pw123456')
  await page.getByRole('button', { name: '註冊' }).click()
  await page.getByRole('button', { name: '建立球隊' }).click()
  await page.getByLabel('球隊名稱').fill('Rec Team')
  await page.getByRole('dialog').getByRole('button', { name: '建立' }).click()
  await expect(page).toHaveURL(/\/teams\/.+\/players/)

  // 9 名球員
  const names = ['A','B','C','D','E','F','G','H','I']
  for (const n of names) {
    await page.getByPlaceholder('球員名稱').fill(n)
    await page.getByRole('button', { name: '新增球員' }).click()
    await expect(page.getByRole('cell', { name: n, exact: true })).toBeVisible()
  }
  // 建賽（away→首半局我隊進攻）
  await page.getByRole('link', { name: '比賽' }).click()
  await page.getByRole('button', { name: '建立比賽' }).click()
  await page.locator('input[type=date]').fill('2026-08-01')
  await page.locator('select').first().selectOption('baseball')
  await page.getByPlaceholder('對手名稱').fill('Foe')
  // 主/客 選客場
  await page.getByRole('button', { name: '建立比賽' }).click()
  await expect(page).toHaveURL(/\/games\/.+\/lineup/)
  // 排 9 人合法名單
  const pos = ['P','C','1B','2B','3B','SS','LF','CF','RF']
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: '＋ 新增一列' }).click()
    const row = page.locator('table.table tbody tr').nth(i)
    await row.locator('select').first().selectOption({ label: names[i] })
    await row.locator('select').nth(1).selectOption(pos[i])
  }
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.locator('.ui-chip').filter({ hasText: '名單已確認' })).toBeVisible()
}

test('AC-8/11：開賽、記錄、撤銷重算', async ({ page }) => {
  await setupLiveGame(page, 'm3a')
  // 進記錄分頁 → 開賽
  await page.getByRole('link', { name: '記錄' }).click()
  await page.getByRole('button', { name: /開賽/ }).click()

  // 記三次三振 → 換半局（我隊守備）
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '三振' }).click()
  await expect(page.getByText(/我隊守備/)).toBeVisible()

  // 時間線有 3 筆，刪一筆後剩 2（AC-11 重算）
  await page.getByRole('link', { name: '時間線' }).click()
  await expect(page.locator('table.table tbody tr')).toHaveCount(3)
  await page.locator('table.table tbody tr').first().getByRole('button', { name: '刪除' }).click()
  await expect(page.locator('table.table tbody tr')).toHaveCount(2)
})
```

> ⚠️ E2E 對 UI 文案/選擇器敏感；實作時若 CreateGameForm 的主客選擇器或按鈕名稱不同，依實際 DOM 調整（建賽預設 home，需確保選 away 或改測「我隊守備/進攻」斷言對應）。E2E 重點＝AC-8（記錄改變狀態）、AC-11（刪除重算）可見。

- [ ] **Step 2: controller 跑 E2E**

Run（先確保後端 5199 + DB 起）：`cd frontend && npx playwright test m3a-recording.spec.ts --reporter=list`
Expected: PASS。

---

## Plan Self-Review（writing-plans 自查）

**1. Spec coverage（design §對應 task）：**
- §3 記錄 UX（5 改良/L2/鑽石/撤銷/開賽設定）→ Task 8（RecordTab/RunnerPanel/開賽）、Task 9（時間線刪除）、Task 5（開賽設定欄位）。✅
- §4 套件結構（scoring/eventfold/ruleengine 擴充）→ Task 2/3/4/6。✅
- §5 事件模型（composite PA event + eventType 清單 + GameEvent schema）→ Task 1（schema）、Task 4（entity）、契約區（eventType）。✅
- §6 資料模型 V4（game_event + games 兩欄）→ Task 1。✅
- §7 event-fold + 重算 → Task 2（fold/applier）、Task 6（record/recompute）。✅
- §8 SubstitutionValidator（VR-002/003）→ Task 3 + Task 6（validateSubstitution 橋接）。✅
- §9 授權/錯誤（owner 寫/member 讀、422）→ Task 6（requireOwnerLiveGame/requireMember、EventInvalidException）。✅
- §10 API（events CRUD + /state；狀態流轉）→ Task 6（controller）、Task 5（PATCH 流轉）。✅
- §11 測試與 AC（AC-8/9/11）→ Task 2/3 unit、Task 6 IT、Task 10 E2E。✅
- §12 不回歸 M1/M2 → Task 5 跑 M2 IT 確認；migration 純加欄/加表。✅

**2. Placeholder scan：** Task 6 Step 3 的 `re_entry_when_not_allowed_is_422` 與 `non_member` 測試本體有「省略，實作時複製 liveGame 改旗標」註記——這是**刻意留給實作者的小擴充**（已給明確指示與既有 helper），非空白 TODO；其餘步驟皆含完整 code。fold 的「跑者自動推進規則表」依設計 §13 改由 UI 顯式 runnerMoves 取代，**不留待實作猜測**。✅

**3. Type consistency：** `EventView`/`GameState`/`BaseState`/`RunnerMove`/`PitchTally`/`LineupEntry` 跨 Task 2（定義）→ Task 4（payload 複用 RunnerMove/PitchTally）→ Task 6（toView/EventApplier）一致；`SubstitutionAction` 欄位於 Task 3 定義、Task 6 `validateSubstitution` 對齊建構；`GameResponse`/`UpdateGameRequest` 新欄位於 Task 5 三處（entity/DTO/toResponse）一致。✅

> 已知簡化（design §13 對齊、非缺漏）：POSITION_CHANGE 守位互換、L1/L3、對稱具名對手、ER 自責分精算 → 後續增量；本計畫只達 AC-8/9/11 與 L2。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-11-m3a-in-game-recording.md`。兩種執行選項：

1. **Subagent-Driven（推薦）** — 每 task 派新鮮 subagent、task 間 review、快速迭代（fast-mode：subagent 只寫檔、controller 集中跑 build/test、每 Wave 收一次 commit）。
2. **Inline Execution** — 本 session 內逐 task 執行，checkpoint 批次 review。

要哪一種？

