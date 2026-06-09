# M2（比賽 + 規則設定 + 出賽名單 + 名單驗證）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 owner 建立一場比賽（棒/壘 × 正式/友誼/對內，帶入規則基底後可改）、編排出賽名單（打序/守位/先發替補/路人），並在開賽前驗證名單合法性後確認（gameStatus 到 `lineup_confirmed`）。

**Architecture:** 後端 package-by-module（`game` / `lineup` / `shared.ruleengine`）；名單驗證是 `shared.ruleengine` 的純函式，service 預先解析 DB 旗標後傳入。沿用 M1-B 的 `TeamAccessPolicy`（owner-only 寫、member 讀）、全域 RFC7807 ProblemDetail、Postgres + Flyway + Hibernate。前端 React + TS 全 UI，沿用既有 tokens / react-router / `api/client.ts`。

**Tech Stack:** Java 21 + Spring Boot 3.5（Web/Data-JPA/Validation/Security）、PostgreSQL + Flyway、Hibernate 6、Testcontainers（over Podman）、React + TypeScript + Vite、Playwright。

---

## 設計來源
`docs/superpowers/specs/2026-06-08-m2-games-lineup-design.md`（事實來源）。對應 **AC-4/5/6/7**。

## 執行重要約定（controller 必讀）

- **JDK 21 就地**：每個 build/test shell 開頭
  `export JAVA_HOME="C:/Program Files/OpenJDK/jdk-21"; export PATH="$JAVA_HOME/bin:$PATH"`。用系統 `mvn`（非 `./mvnw`）。
- **不主動 commit**（專案規則覆寫 skill 的「frequent commits」）：本計畫**不含** per-task `git commit` 步驟；是否 commit 由使用者於收尾決定。
- **fast-mode subagent**（user 全域規則）：subagent 只「寫 code + test」，**不各自跑 build/test**。controller 先 `mvn -o test-compile` 預編譯一次，之後集中跑驗證（`mvn -o -Dtest=X test`）。背景 subagent 無 Bash → mvn/npm 由 controller 跑。
- **同一 `target/` 不可多 subagent 同時編譯**：並行的 subagent 只寫不同檔；編譯/測試 controller 集中跑。
- 後端 5199 / 前端 5200；Testcontainers 走 Podman socket（必要時 `export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`）。
- 收尾 `taskkill //F //IM node.exe` + 刪 `frontend/.vite`（避免殘留 node 咬 vite）。

## 檔案結構（本計畫新增/修改）

**後端 新增**
```
src/main/resources/db/migration/V3__games_rosters_rules.sql
src/main/java/com/baseball/record/shared/ruleengine/
    PositionRules.java  SlotView.java  LineupView.java  Violation.java
    ValidationResult.java  LineupValidator.java
src/main/java/com/baseball/record/game/
    RulePreset.java  RulePresetRepository.java  RulePresetController.java
    Game.java  GameRepository.java  GameService.java  GameController.java
    dto/{RulePresetResponse, CreateGameRequest, UpdateGameRequest, GameResponse, OpponentSuggestion}.java
src/main/java/com/baseball/record/lineup/
    GameRoster.java  GameRosterRepository.java  LineupSlot.java  LineupSlotRepository.java
    LineupService.java  LineupController.java  RosterValidationService.java
    LineupInvalidException.java  ApiExceptionHandler.java
    dto/{LineupSlotDto, PutRosterRequest, RosterResponse, ValidationResultResponse}.java
```
**後端 測試**
```
src/test/java/com/baseball/record/shared/ruleengine/{LineupValidatorTest, PositionRulesTest}.java
src/test/java/com/baseball/record/game/{RulePresetControllerIT, GameControllerIT}.java
src/test/java/com/baseball/record/lineup/LineupControllerIT.java
```
**前端 新增/修改**
```
src/api/client.ts                 (修改：加 rulePresets/games/opponents/roster)
src/pages/GameCreatePage.tsx      (新增)
src/pages/GamePage.tsx            (新增：名單編輯 + 驗證)
src/pages/games.css               (新增)
src/pages/TeamPage.tsx            (修改：加「比賽」區塊)
src/App.tsx                       (修改：加 routes)
e2e/m2-games-lineup.spec.ts       (新增 Playwright)
```

## 執行順序（依賴 / 可並行）

- **Wave 1（並行，互不相干檔）**：Task 1（migration）、Task 2（ruleengine）。
- **Wave 2（並行，皆依賴 Task 1 的表）**：Task 3（preset）、Task 4（game CRUD）、Task 5（roster/slot entities）。
- **Wave 3**：Task 6（lineup service + confirm 接線；依賴 2/4/5）。
- **Wave 4**：Task 7（前端 client；依賴後端 API 形狀 4/6）。
- **Wave 5（並行）**：Task 8（建比賽頁 + 列表）、Task 9（名單編輯頁）。
- **Wave 6**：Task 10（Playwright E2E）。

> controller 每個 Wave 結束後集中編譯/跑測（`mvn -o test-compile` → `mvn -o -Dtest=... test`），綠燈才進下一 Wave。

---

## Task 1：Flyway V3 migration + seed 6 presets

**Files:**
- Create: `backend/src/main/resources/db/migration/V3__games_rosters_rules.sql`
- Verify: 既有 `src/test/java/com/baseball/record/support/ContextLoadsIT.java`（context load 會跑 flyway）

- [ ] **Step 1: 寫 migration SQL**

```sql
-- V3__games_rosters_rules.sql

CREATE TABLE rule_preset (
    preset_id           VARCHAR(40) PRIMARY KEY,
    label               VARCHAR(60)  NOT NULL,
    sport_type          VARCHAR(20)  NOT NULL,
    match_mode          VARCHAR(20)  NOT NULL,
    dh_allowed          BOOLEAN      NOT NULL,
    ep_allowed          BOOLEAN      NOT NULL,
    default_roster_size INT          NOT NULL,
    re_entry_allowed    BOOLEAN      NOT NULL,
    roster_flex         BOOLEAN      NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO rule_preset
    (preset_id, label, sport_type, match_mode, dh_allowed, ep_allowed, default_roster_size, re_entry_allowed, roster_flex)
VALUES
    ('baseball-formal-9',          '棒球正式賽 9 人',      'baseball',      'formal',   false, false, 9,  false, false),
    ('baseball-formal-dh',         '棒球正式賽 9 人+DH',   'baseball',      'formal',   true,  false, 9,  false, false),
    ('softball-slow-formal-10',    '慢壘正式賽 10 人',      'softball_slow', 'formal',   false, false, 10, true,  false),
    ('softball-slow-formal-ep-11', '慢壘正式賽 10 人+EP',  'softball_slow', 'formal',   false, true,  10, true,  false),
    ('softball-friendly-ep',       '壘球友誼賽（EP/彈性）', 'softball_slow', 'friendly', false, true,  10, true,  true),
    ('teeball-friendly',           '樂樂棒友誼賽（彈性）',  'teeball',       'friendly', false, true,  9,  true,  true);

CREATE TABLE games (
    game_id          UUID PRIMARY KEY,
    team_id          UUID         NOT NULL REFERENCES teams(team_id),
    sport_type       VARCHAR(20)  NOT NULL,
    match_mode       VARCHAR(20)  NOT NULL,
    base_preset_id   VARCHAR(40)  REFERENCES rule_preset(preset_id),
    dh_enabled       BOOLEAN      NOT NULL,
    ep_allowed       BOOLEAN      NOT NULL,
    roster_size      INT          NOT NULL,
    re_entry_allowed BOOLEAN      NOT NULL,
    game_date        DATE         NOT NULL,
    home_away        VARCHAR(10)  NOT NULL,
    opponent_name    VARCHAR(120),
    venue            VARCHAR(120),
    weather          VARCHAR(40),
    temperature_c    INT,
    game_status      VARCHAR(20)  NOT NULL DEFAULT 'draft',
    created_by       UUID         NOT NULL REFERENCES users(user_id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_games_team     ON games (team_id);
CREATE INDEX idx_games_opponent ON games (team_id, opponent_name);

CREATE TABLE game_roster (
    game_roster_id UUID PRIMARY KEY,
    game_id        UUID        NOT NULL UNIQUE REFERENCES games(game_id),
    confirmed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE lineup_slot (
    slot_id        UUID PRIMARY KEY,
    game_roster_id UUID        NOT NULL REFERENCES game_roster(game_roster_id),
    player_id      UUID        REFERENCES players(player_id),
    guest_name     VARCHAR(120),
    batting_order  INT,
    field_position VARCHAR(10),
    lineup_status  VARCHAR(20) NOT NULL DEFAULT 'starter',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_slot_source CHECK ((player_id IS NOT NULL) <> (guest_name IS NOT NULL))
);
CREATE INDEX idx_slot_roster ON lineup_slot (game_roster_id);
```

- [ ] **Step 2: controller 驗證 flyway 套用**

Run: `mvn -o -Dtest=ContextLoadsIT test`
Expected: PASS（flyway 套用 V3、Hibernate `ddl-auto=validate` 不報錯——entity 在後續 task 加，本 task 只驗 SQL 能套用且既有 context 仍綠）。

---

## Task 2：shared/ruleengine 純函式 + 單元測試（無 DB）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/shared/ruleengine/{PositionRules,SlotView,LineupView,Violation,ValidationResult,LineupValidator}.java`
- Test: `backend/src/test/java/com/baseball/record/shared/ruleengine/{PositionRulesTest,LineupValidatorTest}.java`

- [ ] **Step 1: 寫純資料類別**

`PositionRules.java`：
```java
package com.baseball.record.shared.ruleengine;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** 僅供名單驗證用的 per-sportType 守位集（M1-B 球員守位仍自由字串）。 */
public final class PositionRules {
    private PositionRules() {}
    static final List<String> BASEBALL  = List.of("P","C","1B","2B","3B","SS","LF","CF","RF");
    static final List<String> SLOWPITCH = List.of("P","C","1B","2B","3B","SS","LF","CF","RF","SF");

    /** 該 sportType 合法的守位值（前端下拉 / 輸入驗證用）。 */
    public static List<String> validPositions(String sportType) {
        return "softball_slow".equals(sportType) ? SLOWPITCH : BASEBALL;
    }
    /** formal 必要齊全的守位集；teeball 無強制。 */
    public static Set<String> requiredPositions(String sportType) {
        return switch (sportType) {
            case "teeball" -> Set.of();
            case "softball_slow" -> new LinkedHashSet<>(SLOWPITCH);
            default -> new LinkedHashSet<>(BASEBALL);
        };
    }
    /** 標準守備人數 D（推導 EP 用）。 */
    public static int standardDefensiveCount(String sportType) {
        return "softball_slow".equals(sportType) ? 10 : 9;
    }
}
```

`SlotView.java`（純資料；service 預先解析 eligible）：
```java
package com.baseball.record.shared.ruleengine;

import java.util.UUID;

/** eligible：註冊球員是否可出賽（屬隊且非 archived/unavailable）；路人恆 true。 */
public record SlotView(UUID playerId, String guestName, Integer battingOrder,
                       String fieldPosition, String lineupStatus, boolean eligible) {
    public boolean isStarter() { return "starter".equals(lineupStatus); }
}
```

`LineupView.java`：
```java
package com.baseball.record.shared.ruleengine;

import java.util.List;

/** flex：matchMode != formal（friendly/intra_squad 放寬人數與守位齊全）。 */
public record LineupView(String sportType, boolean dhEnabled, boolean epAllowed,
                         int rosterSize, boolean flex, List<SlotView> slots) {}
```

`Violation.java` / `ValidationResult.java`：
```java
package com.baseball.record.shared.ruleengine;
public record Violation(String code, String message) {}
```
```java
package com.baseball.record.shared.ruleengine;
import java.util.List;
public record ValidationResult(boolean valid, List<Violation> violations) {}
```

- [ ] **Step 2: 寫失敗測試 `LineupValidatorTest`**

```java
package com.baseball.record.shared.ruleengine;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LineupValidatorTest {

    /** 棒球 9 人，打序 1..9，守位 P,C,1B,2B,3B,SS,LF,CF,RF，全員既打又守。 */
    static List<SlotView> baseballNine() {
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        List<SlotView> s = new ArrayList<>();
        for (int i = 0; i < 9; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        return s;
    }
    static LineupView formal(List<SlotView> slots) {
        return new LineupView("baseball", false, false, 9, false, slots);
    }

    @Test
    void legal_baseball_nine_passes() {
        ValidationResult r = LineupValidator.validate(formal(baseballNine()));
        assertThat(r.valid()).isTrue();
        assertThat(r.violations()).isEmpty();
    }

    @Test
    void batting_order_gap_fails() {
        List<SlotView> s = baseballNine();
        s.set(8, new SlotView(java.util.UUID.randomUUID(), null, 10, "RF", "starter", true)); // 1..8,10
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.valid()).isFalse();
        assertThat(r.violations()).anyMatch(v -> v.code().equals("BATTING_ORDER_INVALID"));
    }

    @Test
    void missing_required_position_fails() {
        List<SlotView> s = baseballNine();
        s.set(8, new SlotView(java.util.UUID.randomUUID(), null, 9, "RF", "starter", true));
        s.set(7, new SlotView(java.util.UUID.randomUUID(), null, 8, "RF", "starter", true)); // 兩個 RF，缺 CF
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("REQUIRED_POSITION_MISSING"));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("POSITION_DUPLICATE"));
    }

    @Test
    void missing_pitcher_fails() {
        List<SlotView> s = baseballNine();
        s.set(0, new SlotView(java.util.UUID.randomUUID(), null, 1, "DH-bogus", "starter", true));
        // 把 P 換掉造成沒有投手（也會觸發守位缺漏；至少要有 PITCHER_MISSING）
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("PITCHER_MISSING"));
    }

    @Test
    void ineligible_player_fails() {
        List<SlotView> s = baseballNine();
        s.set(0, new SlotView(java.util.UUID.randomUUID(), null, 1, "P", "starter", false)); // 不可出賽
        ValidationResult r = LineupValidator.validate(formal(s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("PLAYER_NOT_ELIGIBLE"));
    }

    @Test
    void dh_when_not_allowed_fails() {
        // 投手只守不打（無 battingOrder）+ DH 只打不守 → hasDH，但 dhEnabled=false
        List<SlotView> s = new ArrayList<>();
        String[] pos = {"C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 8; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 9, null, "starter", true));   // DH 只打
        s.add(new SlotView(java.util.UUID.randomUUID(), null, null, "P", "starter", true)); // 投手只守
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, false, 9, false, s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("DH_NOT_ALLOWED"));
    }

    @Test
    void dh_when_allowed_passes() {
        List<SlotView> s = new ArrayList<>();
        String[] pos = {"C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 8; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 9, null, "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, null, "P", "starter", true));
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", true, false, 9, false, s));
        assertThat(r.valid()).isTrue();
    }

    @Test
    void ep_when_not_allowed_fails() {
        // 棒球 10 人打擊（>9）= EP，但 epAllowed=false
        List<SlotView> s = baseballNine();
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 10, null, "starter", true)); // 第 10 棒只打
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, false, 9, false, s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("EP_NOT_ALLOWED"));
    }

    @Test
    void friendly_ep_exceeds_defense_passes() { // AC-7
        List<SlotView> s = baseballNine();
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 10, null, "starter", true));
        s.add(new SlotView(java.util.UUID.randomUUID(), null, 11, null, "starter", true));
        // friendly + epAllowed → 人數超守備數不判非法
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, true, 9, true, s));
        assertThat(r.valid()).isTrue();
    }

    @Test
    void friendly_short_handed_passes_but_still_checks_order() {
        // 8 人友誼，仍檢查打序連續、投手存在
        List<SlotView> s = new ArrayList<>();
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF"};
        for (int i = 0; i < 8; i++)
            s.add(new SlotView(java.util.UUID.randomUUID(), null, i + 1, pos[i], "starter", true));
        ValidationResult ok = LineupValidator.validate(new LineupView("baseball", false, true, 9, true, s));
        assertThat(ok.valid()).isTrue();

        s.set(7, new SlotView(java.util.UUID.randomUUID(), null, 9, "CF", "starter", true)); // 1..7,9 缺號
        ValidationResult bad = LineupValidator.validate(new LineupView("baseball", false, true, 9, true, s));
        assertThat(bad.violations()).anyMatch(v -> v.code().equals("BATTING_ORDER_INVALID"));
    }

    @Test
    void formal_wrong_count_fails() {
        List<SlotView> s = baseballNine();
        s.remove(8); // 只剩 8 棒、formal 非 EP → 數量不符
        ValidationResult r = LineupValidator.validate(new LineupView("baseball", false, false, 9, false, s));
        assertThat(r.violations()).anyMatch(v -> v.code().equals("BATTING_COUNT_MISMATCH"));
    }
}
```

- [ ] **Step 2b: 寫 `PositionRulesTest`**

```java
package com.baseball.record.shared.ruleengine;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class PositionRulesTest {
    @Test void baseball_has_9_required_and_d9() {
        assertThat(PositionRules.requiredPositions("baseball")).hasSize(9).contains("P","RF");
        assertThat(PositionRules.standardDefensiveCount("baseball")).isEqualTo(9);
    }
    @Test void slowpitch_has_10_required_with_sf_and_d10() {
        assertThat(PositionRules.requiredPositions("softball_slow")).hasSize(10).contains("SF");
        assertThat(PositionRules.standardDefensiveCount("softball_slow")).isEqualTo(10);
    }
    @Test void teeball_has_no_required() {
        assertThat(PositionRules.requiredPositions("teeball")).isEmpty();
    }
    @Test void valid_positions_for_slowpitch_include_sf() {
        assertThat(PositionRules.validPositions("softball_slow")).contains("SF");
        assertThat(PositionRules.validPositions("baseball")).doesNotContain("SF");
    }
}
```

- [ ] **Step 3: controller 跑測確認 FAIL**

Run: `mvn -o -Dtest=LineupValidatorTest,PositionRulesTest test`
Expected: 編譯失敗 / FAIL（`LineupValidator` 未實作）。

- [ ] **Step 4: 實作 `LineupValidator`**

```java
package com.baseball.record.shared.ruleengine;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 名單驗證純函式：DH/EP 推導 + 7 條檢查（design §6）。 */
public final class LineupValidator {
    private LineupValidator() {}

    public static ValidationResult validate(LineupView v) {
        List<Violation> out = new ArrayList<>();
        List<SlotView> starters = v.slots().stream().filter(SlotView::isStarter).toList();

        int D = PositionRules.standardDefensiveCount(v.sportType());

        // 打序集合
        List<Integer> orders = new ArrayList<>(
            starters.stream().map(SlotView::battingOrder).filter(o -> o != null).sorted().toList());
        int battingCount = orders.size();

        // 守位集合 / 投手
        Map<String, Integer> posCount = new HashMap<>();
        for (SlotView s : starters)
            if (s.fieldPosition() != null) posCount.merge(s.fieldPosition(), 1, Integer::sum);
        boolean hasPitcher = posCount.containsKey("P");
        SlotView pitcher = starters.stream().filter(s -> "P".equals(s.fieldPosition())).findFirst().orElse(null);
        boolean pitcherBats = pitcher != null && pitcher.battingOrder() != null;

        // 推導
        boolean hasDH = pitcher != null && !pitcherBats;          // 投手只守不打 → DH 制
        boolean hasEP = battingCount > D;                          // 打序 > 標準守備數 → EP

        // ① 打序數量（formal 嚴格；flex 放寬不檢）
        if (!v.flex()) {
            boolean countOk = v.epAllowed() ? battingCount >= v.rosterSize() : battingCount == v.rosterSize();
            if (!countOk)
                out.add(new Violation("BATTING_COUNT_MISMATCH",
                    "打序人數 " + battingCount + " 不符規則（預期 " + v.rosterSize() + (v.epAllowed() ? "+" : "") + "）"));
        }
        // ② 打序連續不重複（always）：須恰為 1..battingCount
        boolean orderOk = true;
        for (int i = 0; i < orders.size(); i++) if (orders.get(i) != i + 1) { orderOk = false; break; }
        if (!orderOk)
            out.add(new Violation("BATTING_ORDER_INVALID", "打序必須連續且不重複（1..N）"));
        // ③ 必要守位齊全（flex 放寬不檢）
        if (!v.flex()) {
            Set<String> required = PositionRules.requiredPositions(v.sportType());
            for (String pos : required)
                if (!posCount.containsKey(pos))
                    out.add(new Violation("REQUIRED_POSITION_MISSING", "缺少守位：" + pos));
        }
        // ④ 守位不重複（always）
        posCount.forEach((pos, c) -> {
            if (c > 1) out.add(new Violation("POSITION_DUPLICATE", "守位重複：" + pos));
        });
        // ⑤ DH/EP 符 flags（always）
        if (hasDH && !v.dhEnabled())
            out.add(new Violation("DH_NOT_ALLOWED", "本場未開放 DH，投手必須在打序內"));
        if (hasEP && !v.epAllowed())
            out.add(new Violation("EP_NOT_ALLOWED", "本場未開放 EP，打序人數不可超過守備人數"));
        // ⑥ 投手存在（always）
        if (!hasPitcher)
            out.add(new Violation("PITCHER_MISSING", "名單必須包含投手（P）"));
        // ⑦ 註冊球員可出賽（always；路人 eligible=true）
        for (SlotView s : starters)
            if (!s.eligible())
                out.add(new Violation("PLAYER_NOT_ELIGIBLE", "名單包含不可出賽的球員（非本隊或已封存/不可出賽）"));

        return new ValidationResult(out.isEmpty(), out);
    }
}
```

- [ ] **Step 5: controller 跑測確認 PASS**

Run: `mvn -o -Dtest=LineupValidatorTest,PositionRulesTest test`
Expected: PASS。

---

## Task 3：RulePreset entity / repo / controller + IT

**Files:**
- Create: `backend/src/main/java/com/baseball/record/game/{RulePreset,RulePresetRepository,RulePresetController}.java`, `game/dto/RulePresetResponse.java`
- Test: `backend/src/test/java/com/baseball/record/game/RulePresetControllerIT.java`

- [ ] **Step 1: 寫 IT（失敗）**

```java
package com.baseball.record.game;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RulePresetControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token() throws Exception {
        String email = "rp_" + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }

    @Test
    void lists_seeded_presets() throws Exception {
        mvc.perform(get("/api/rule-presets").header("Authorization", "Bearer " + token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(6));
    }

    @Test
    void filters_by_match_mode() throws Exception {
        mvc.perform(get("/api/rule-presets?matchMode=formal").header("Authorization", "Bearer " + token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[?(@.matchMode != 'formal')]").isEmpty())
           .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void requires_auth() throws Exception {
        mvc.perform(get("/api/rule-presets")).andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 實作 entity / repo / dto / controller**

`RulePreset.java`：
```java
package com.baseball.record.game;

import jakarta.persistence.*;

@Entity
@Table(name = "rule_preset")
public class RulePreset {
    @Id @Column(name = "preset_id") private String presetId;
    @Column(name = "label", nullable = false) private String label;
    @Column(name = "sport_type", nullable = false) private String sportType;
    @Column(name = "match_mode", nullable = false) private String matchMode;
    @Column(name = "dh_allowed", nullable = false) private boolean dhAllowed;
    @Column(name = "ep_allowed", nullable = false) private boolean epAllowed;
    @Column(name = "default_roster_size", nullable = false) private int defaultRosterSize;
    @Column(name = "re_entry_allowed", nullable = false) private boolean reEntryAllowed;
    @Column(name = "roster_flex", nullable = false) private boolean rosterFlex;

    protected RulePreset() {}
    public String getPresetId() { return presetId; }
    public String getLabel() { return label; }
    public String getSportType() { return sportType; }
    public String getMatchMode() { return matchMode; }
    public boolean isDhAllowed() { return dhAllowed; }
    public boolean isEpAllowed() { return epAllowed; }
    public int getDefaultRosterSize() { return defaultRosterSize; }
    public boolean isReEntryAllowed() { return reEntryAllowed; }
    public boolean isRosterFlex() { return rosterFlex; }
}
```

`RulePresetRepository.java`：
```java
package com.baseball.record.game;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RulePresetRepository extends JpaRepository<RulePreset, String> {
    List<RulePreset> findByMatchModeOrderByPresetId(String matchMode);
    List<RulePreset> findAllByOrderByPresetId();
}
```

`game/dto/RulePresetResponse.java`：
```java
package com.baseball.record.game.dto;
public record RulePresetResponse(String presetId, String label, String sportType, String matchMode,
                                 boolean dhAllowed, boolean epAllowed, int defaultRosterSize,
                                 boolean reEntryAllowed, boolean rosterFlex) {}
```

`RulePresetController.java`（sportType 為軟提示，本 task 先以 matchMode 篩；sportType 參數保留但不過濾，留前端顯示）：
```java
package com.baseball.record.game;

import com.baseball.record.game.dto.RulePresetResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rule-presets")
public class RulePresetController {
    private final RulePresetRepository presets;
    public RulePresetController(RulePresetRepository presets) { this.presets = presets; }

    @GetMapping
    public List<RulePresetResponse> list(@RequestParam(required = false) String sportType,
                                         @RequestParam(required = false) String matchMode) {
        List<RulePreset> rows = matchMode == null
            ? presets.findAllByOrderByPresetId()
            : presets.findByMatchModeOrderByPresetId(matchMode);
        return rows.stream().map(p -> new RulePresetResponse(
            p.getPresetId(), p.getLabel(), p.getSportType(), p.getMatchMode(),
            p.isDhAllowed(), p.isEpAllowed(), p.getDefaultRosterSize(),
            p.isReEntryAllowed(), p.isRosterFlex())).toList();
    }
}
```

- [ ] **Step 3: controller 跑測**

Run: `mvn -o -Dtest=RulePresetControllerIT test`
Expected: PASS。

---

## Task 4：Game entity / repo / service / controller + DTOs + IT（不含 confirm 驗證）

**Files:**
- Create: `backend/src/main/java/com/baseball/record/game/{Game,GameRepository,GameService,GameController}.java`,
  `game/dto/{CreateGameRequest,UpdateGameRequest,GameResponse,OpponentSuggestion}.java`
- Test: `backend/src/test/java/com/baseball/record/game/GameControllerIT.java`

> 本 task 的 PATCH 只處理欄位更新與 `draft↔scheduled`；轉 `lineup_confirmed` 的驗證 gate 在 Task 6 接線。

- [ ] **Step 1: 寫 IT（失敗）**

```java
package com.baseball.record.game;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GameControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token(String p) throws Exception {
        String email = p + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }
    String createTeam(String token, String sport) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"T\",\"sportType\":\"" + sport + "\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    String createGameBody(String opponent) {
        return "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
             + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,"
             + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"home\",\"opponentName\":\"" + opponent + "\"}";
    }

    @Test
    void create_game_enters_scheduled() throws Exception { // AC-4
        String t = token("g1_"); String teamId = createTeam(t, "baseball");
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Lions")))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.gameId").isNotEmpty())
           .andExpect(jsonPath("$.gameStatus").value("scheduled"))
           .andExpect(jsonPath("$.opponentName").value("Lions"));
    }

    @Test
    void list_and_filter_by_status() throws Exception {
        String t = token("g2_"); String teamId = createTeam(t, "baseball");
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(createGameBody("A"))).andExpect(status().isCreated());
        mvc.perform(get("/api/teams/" + teamId + "/games?status=scheduled").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void intra_squad_allows_empty_opponent() throws Exception {
        String t = token("g3_"); String teamId = createTeam(t, "baseball");
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"intra_squad\",\"dhEnabled\":false,"
            + "\"epAllowed\":true,\"rosterSize\":9,\"reEntryAllowed\":true,\"gameDate\":\"2026-07-02\",\"homeAway\":\"home\"}";
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isCreated());
    }

    @Test
    void formal_requires_opponent() throws Exception {
        String t = token("g4_"); String teamId = createTeam(t, "baseball");
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"dhEnabled\":false,"
            + "\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,\"gameDate\":\"2026-07-03\",\"homeAway\":\"home\"}";
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test
    void non_member_cannot_get_game() throws Exception {
        String a = token("g5a_"); String teamId = createTeam(a, "baseball");
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + a)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("X")))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        String b = token("g5b_");
        mvc.perform(get("/api/games/" + gameId).header("Authorization", "Bearer " + b))
           .andExpect(status().isNotFound());
    }

    @Test
    void opponent_autocomplete() throws Exception {
        String t = token("g6_"); String teamId = createTeam(t, "baseball");
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Dragons"))).andExpect(status().isCreated());
        mvc.perform(get("/api/teams/" + teamId + "/opponents?q=dra").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[0].name").value("Dragons"));
    }
}
```

- [ ] **Step 2: 實作 DTOs**

`game/dto/CreateGameRequest.java`：
```java
package com.baseball.record.game.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record CreateGameRequest(
    @NotNull @Pattern(regexp = "baseball|softball_fast|softball_slow|teeball") String sportType,
    @NotNull @Pattern(regexp = "formal|friendly|intra_squad") String matchMode,
    String basePresetId,
    @NotNull Boolean dhEnabled,
    @NotNull Boolean epAllowed,
    @NotNull @Min(1) Integer rosterSize,
    @NotNull Boolean reEntryAllowed,
    @NotNull LocalDate gameDate,
    @NotNull @Pattern(regexp = "home|away") String homeAway,
    @Size(max = 120) String opponentName,
    @Size(max = 120) String venue,
    @Size(max = 40) String weather,
    @Min(-50) @Max(60) Integer temperatureC) {}
```

`game/dto/UpdateGameRequest.java`（全選填；含狀態）：
```java
package com.baseball.record.game.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record UpdateGameRequest(
    @Pattern(regexp = "baseball|softball_fast|softball_slow|teeball") String sportType,
    @Pattern(regexp = "formal|friendly|intra_squad") String matchMode,
    String basePresetId,
    Boolean dhEnabled,
    Boolean epAllowed,
    @Min(1) Integer rosterSize,
    Boolean reEntryAllowed,
    LocalDate gameDate,
    @Pattern(regexp = "home|away") String homeAway,
    @Size(max = 120) String opponentName,
    @Size(max = 120) String venue,
    @Size(max = 40) String weather,
    @Min(-50) @Max(60) Integer temperatureC,
    @Pattern(regexp = "draft|scheduled|lineup_confirmed") String gameStatus) {}
```

`game/dto/GameResponse.java`：
```java
package com.baseball.record.game.dto;

import java.time.LocalDate;
import java.util.UUID;

public record GameResponse(UUID gameId, UUID teamId, String sportType, String matchMode, String basePresetId,
                           boolean dhEnabled, boolean epAllowed, int rosterSize, boolean reEntryAllowed,
                           LocalDate gameDate, String homeAway, String opponentName, String venue,
                           String weather, Integer temperatureC, String gameStatus) {}
```

`game/dto/OpponentSuggestion.java`：
```java
package com.baseball.record.game.dto;
public record OpponentSuggestion(String name) {}
```

- [ ] **Step 3: 實作 Game entity**

`Game.java`：
```java
package com.baseball.record.game;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "games")
public class Game {
    @Id @Column(name = "game_id") private UUID gameId = UUID.randomUUID();
    @Column(name = "team_id", nullable = false) private UUID teamId;
    @Column(name = "sport_type", nullable = false) private String sportType;
    @Column(name = "match_mode", nullable = false) private String matchMode;
    @Column(name = "base_preset_id") private String basePresetId;
    @Column(name = "dh_enabled", nullable = false) private boolean dhEnabled;
    @Column(name = "ep_allowed", nullable = false) private boolean epAllowed;
    @Column(name = "roster_size", nullable = false) private int rosterSize;
    @Column(name = "re_entry_allowed", nullable = false) private boolean reEntryAllowed;
    @Column(name = "game_date", nullable = false) private LocalDate gameDate;
    @Column(name = "home_away", nullable = false) private String homeAway;
    @Column(name = "opponent_name") private String opponentName;
    @Column(name = "venue") private String venue;
    @Column(name = "weather") private String weather;
    @Column(name = "temperature_c") private Integer temperatureC;
    @Column(name = "game_status", nullable = false) private String gameStatus = "draft";
    @Column(name = "created_by", nullable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected Game() {}
    public Game(UUID teamId, UUID createdBy) { this.teamId = teamId; this.createdBy = createdBy; }

    public UUID getGameId() { return gameId; }
    public UUID getTeamId() { return teamId; }
    public String getSportType() { return sportType; } public void setSportType(String v) { sportType = v; }
    public String getMatchMode() { return matchMode; } public void setMatchMode(String v) { matchMode = v; }
    public String getBasePresetId() { return basePresetId; } public void setBasePresetId(String v) { basePresetId = v; }
    public boolean isDhEnabled() { return dhEnabled; } public void setDhEnabled(boolean v) { dhEnabled = v; }
    public boolean isEpAllowed() { return epAllowed; } public void setEpAllowed(boolean v) { epAllowed = v; }
    public int getRosterSize() { return rosterSize; } public void setRosterSize(int v) { rosterSize = v; }
    public boolean isReEntryAllowed() { return reEntryAllowed; } public void setReEntryAllowed(boolean v) { reEntryAllowed = v; }
    public LocalDate getGameDate() { return gameDate; } public void setGameDate(LocalDate v) { gameDate = v; }
    public String getHomeAway() { return homeAway; } public void setHomeAway(String v) { homeAway = v; }
    public String getOpponentName() { return opponentName; } public void setOpponentName(String v) { opponentName = v; }
    public String getVenue() { return venue; } public void setVenue(String v) { venue = v; }
    public String getWeather() { return weather; } public void setWeather(String v) { weather = v; }
    public Integer getTemperatureC() { return temperatureC; } public void setTemperatureC(Integer v) { temperatureC = v; }
    public String getGameStatus() { return gameStatus; } public void setGameStatus(String v) { gameStatus = v; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}
```

`GameRepository.java`：
```java
package com.baseball.record.game;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface GameRepository extends JpaRepository<Game, UUID> {
    List<Game> findByTeamIdOrderByGameDateDesc(UUID teamId);
    List<Game> findByTeamIdAndGameStatusOrderByGameDateDesc(UUID teamId, String gameStatus);

    @Query("select distinct g.opponentName from Game g where g.teamId = :teamId "
         + "and g.opponentName is not null and lower(g.opponentName) like lower(concat('%', :q, '%')) "
         + "order by g.opponentName")
    List<String> suggestOpponents(@Param("teamId") UUID teamId, @Param("q") String q);
}
```

- [ ] **Step 4: 實作 GameService**

```java
package com.baseball.record.game;

import com.baseball.record.game.dto.*;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class GameService {
    private final GameRepository games;
    private final TeamAccessPolicy policy;

    public GameService(GameRepository games, TeamAccessPolicy policy) {
        this.games = games; this.policy = policy;
    }

    @Transactional
    public GameResponse create(UUID userId, UUID teamId, CreateGameRequest req) {
        policy.requireRole(userId, teamId, TeamRole.OWNER);
        requireOpponentUnlessIntra(req.matchMode(), req.opponentName());
        Game g = new Game(teamId, userId);
        g.setSportType(req.sportType());
        g.setMatchMode(req.matchMode());
        g.setBasePresetId(req.basePresetId());
        g.setDhEnabled(req.dhEnabled());
        g.setEpAllowed(req.epAllowed());
        g.setRosterSize(req.rosterSize());
        g.setReEntryAllowed(req.reEntryAllowed());
        g.setGameDate(req.gameDate());
        g.setHomeAway(req.homeAway());
        g.setOpponentName(req.opponentName());
        g.setVenue(req.venue());
        g.setWeather(req.weather());
        g.setTemperatureC(req.temperatureC());
        g.setGameStatus("scheduled"); // AC-4：建立即進 scheduled
        return toResponse(games.save(g));
    }

    @Transactional(readOnly = true)
    public List<GameResponse> list(UUID userId, UUID teamId, String status) {
        policy.requireMember(userId, teamId);
        List<Game> rows = status == null
            ? games.findByTeamIdOrderByGameDateDesc(teamId)
            : games.findByTeamIdAndGameStatusOrderByGameDateDesc(teamId, status);
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public GameResponse get(UUID userId, UUID gameId) {
        Game g = load(gameId);
        policy.requireMember(userId, g.getTeamId());
        return toResponse(g);
    }

    @Transactional(readOnly = true)
    public List<OpponentSuggestion> suggestOpponents(UUID userId, UUID teamId, String q) {
        policy.requireMember(userId, teamId);
        if (q == null || q.isBlank()) return List.of();
        return games.suggestOpponents(teamId, q).stream().limit(10).map(OpponentSuggestion::new).toList();
    }

    /** PATCH：欄位更新 + draft↔scheduled。lineup_confirmed 在 Task 6 接線（本實作暫拒）。 */
    @Transactional
    public GameResponse update(UUID userId, UUID gameId, UpdateGameRequest req) {
        Game g = load(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        applyFields(g, req);
        if (req.gameStatus() != null) transition(g, req.gameStatus());
        g.touch();
        return toResponse(g);
    }

    // 供 Task 6 覆寫/擴充 lineup_confirmed 用；本 task 只允許 draft↔scheduled。
    protected void transition(Game g, String target) {
        if (target.equals(g.getGameStatus())) return;
        boolean ok = switch (g.getGameStatus()) {
            case "draft" -> target.equals("scheduled");
            case "scheduled" -> target.equals("draft");
            default -> false;
        };
        if (!ok) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "illegal status transition " + g.getGameStatus() + " -> " + target);
        g.setGameStatus(target);
    }

    void applyFields(Game g, UpdateGameRequest req) {
        if (req.sportType() != null) g.setSportType(req.sportType());
        if (req.matchMode() != null) g.setMatchMode(req.matchMode());
        if (req.basePresetId() != null) g.setBasePresetId(req.basePresetId());
        if (req.dhEnabled() != null) g.setDhEnabled(req.dhEnabled());
        if (req.epAllowed() != null) g.setEpAllowed(req.epAllowed());
        if (req.rosterSize() != null) g.setRosterSize(req.rosterSize());
        if (req.reEntryAllowed() != null) g.setReEntryAllowed(req.reEntryAllowed());
        if (req.gameDate() != null) g.setGameDate(req.gameDate());
        if (req.homeAway() != null) g.setHomeAway(req.homeAway());
        if (req.opponentName() != null) g.setOpponentName(req.opponentName());
        if (req.venue() != null) g.setVenue(req.venue());
        if (req.weather() != null) g.setWeather(req.weather());
        if (req.temperatureC() != null) g.setTemperatureC(req.temperatureC());
        requireOpponentUnlessIntra(g.getMatchMode(), g.getOpponentName());
    }

    private static void requireOpponentUnlessIntra(String matchMode, String opponentName) {
        if (!"intra_squad".equals(matchMode) && (opponentName == null || opponentName.isBlank()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "opponentName required for " + matchMode);
    }

    Game load(UUID gameId) {
        return games.findById(gameId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }

    GameResponse toResponse(Game g) {
        return new GameResponse(g.getGameId(), g.getTeamId(), g.getSportType(), g.getMatchMode(),
            g.getBasePresetId(), g.isDhEnabled(), g.isEpAllowed(), g.getRosterSize(), g.isReEntryAllowed(),
            g.getGameDate(), g.getHomeAway(), g.getOpponentName(), g.getVenue(), g.getWeather(),
            g.getTemperatureC(), g.getGameStatus());
    }
}
```

> ⚠️ `transition` / `load` / `toResponse` / `applyFields` 設為 package/protected 可見度，Task 6 會擴充 `transition` 與注入驗證。

- [ ] **Step 5: 實作 GameController**

```java
package com.baseball.record.game;

import com.baseball.record.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class GameController {
    private final GameService service;
    public GameController(GameService service) { this.service = service; }

    @PostMapping("/api/teams/{teamId}/games")
    @ResponseStatus(HttpStatus.CREATED)
    public GameResponse create(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                               @Valid @RequestBody CreateGameRequest req) {
        return service.create(userId, teamId, req);
    }

    @GetMapping("/api/teams/{teamId}/games")
    public List<GameResponse> list(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                   @RequestParam(required = false) String status) {
        return service.list(userId, teamId, status);
    }

    @GetMapping("/api/games/{gameId}")
    public GameResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.get(userId, gameId);
    }

    @PatchMapping("/api/games/{gameId}")
    public GameResponse update(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                               @Valid @RequestBody UpdateGameRequest req) {
        return service.update(userId, gameId, req);
    }

    @GetMapping("/api/teams/{teamId}/opponents")
    public List<OpponentSuggestion> opponents(@AuthenticationPrincipal UUID userId, @PathVariable UUID teamId,
                                              @RequestParam(required = false) String q) {
        return service.suggestOpponents(userId, teamId, q);
    }
}
```

- [ ] **Step 6: controller 跑測**

Run: `mvn -o -Dtest=GameControllerIT test`
Expected: PASS。

---

## Task 5：GameRoster + LineupSlot entities / repos

**Files:**
- Create: `backend/src/main/java/com/baseball/record/lineup/{GameRoster,GameRosterRepository,LineupSlot,LineupSlotRepository}.java`
- 無獨立測試（行為由 Task 6 IT 覆蓋）；本 task 只建 entity/repo，controller 在 Wave 2 編譯確認。

- [ ] **Step 1: `GameRoster.java`**

```java
package com.baseball.record.lineup;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "game_roster")
public class GameRoster {
    @Id @Column(name = "game_roster_id") private UUID gameRosterId = UUID.randomUUID();
    @Column(name = "game_id", nullable = false) private UUID gameId;
    @Column(name = "confirmed_at") private OffsetDateTime confirmedAt;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected GameRoster() {}
    public GameRoster(UUID gameId) { this.gameId = gameId; }
    public UUID getGameRosterId() { return gameRosterId; }
    public UUID getGameId() { return gameId; }
    public OffsetDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(OffsetDateTime v) { confirmedAt = v; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}
```

- [ ] **Step 2: `GameRosterRepository.java`**

```java
package com.baseball.record.lineup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface GameRosterRepository extends JpaRepository<GameRoster, UUID> {
    Optional<GameRoster> findByGameId(UUID gameId);
}
```

- [ ] **Step 3: `LineupSlot.java`**

```java
package com.baseball.record.lineup;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "lineup_slot")
public class LineupSlot {
    @Id @Column(name = "slot_id") private UUID slotId = UUID.randomUUID();
    @Column(name = "game_roster_id", nullable = false) private UUID gameRosterId;
    @Column(name = "player_id") private UUID playerId;
    @Column(name = "guest_name") private String guestName;
    @Column(name = "batting_order") private Integer battingOrder;
    @Column(name = "field_position") private String fieldPosition;
    @Column(name = "lineup_status", nullable = false) private String lineupStatus = "starter";
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();

    protected LineupSlot() {}
    public LineupSlot(UUID gameRosterId) { this.gameRosterId = gameRosterId; }
    public UUID getSlotId() { return slotId; }
    public UUID getGameRosterId() { return gameRosterId; }
    public UUID getPlayerId() { return playerId; } public void setPlayerId(UUID v) { playerId = v; }
    public String getGuestName() { return guestName; } public void setGuestName(String v) { guestName = v; }
    public Integer getBattingOrder() { return battingOrder; } public void setBattingOrder(Integer v) { battingOrder = v; }
    public String getFieldPosition() { return fieldPosition; } public void setFieldPosition(String v) { fieldPosition = v; }
    public String getLineupStatus() { return lineupStatus; } public void setLineupStatus(String v) { lineupStatus = v; }
}
```

- [ ] **Step 4: `LineupSlotRepository.java`**

```java
package com.baseball.record.lineup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface LineupSlotRepository extends JpaRepository<LineupSlot, UUID> {
    List<LineupSlot> findByGameRosterId(UUID gameRosterId);
    void deleteByGameRosterId(UUID gameRosterId);
}
```

- [ ] **Step 5: controller 編譯確認**

Run: `mvn -o test-compile`
Expected: BUILD SUCCESS。

---

## Task 6：Lineup service / controller / 驗證接線 + confirm gate + IT

**Files:**
- Create: `backend/src/main/java/com/baseball/record/lineup/{LineupService,LineupController,RosterValidationService,LineupInvalidException,ApiExceptionHandler}.java`,
  `lineup/dto/{LineupSlotDto,PutRosterRequest,RosterResponse,ValidationResultResponse}.java`
- Modify: `game/GameService.java`（confirm 接線：注入 `RosterValidationService`，覆寫 `transition` 支援 `lineup_confirmed`）
- Test: `backend/src/test/java/com/baseball/record/lineup/LineupControllerIT.java`

- [ ] **Step 1: 寫 IT（失敗）**

```java
package com.baseball.record.lineup;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LineupControllerIT extends IntegrationTest {
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
    String addPlayer(String token, String teamId, String name, String pos) throws Exception {
        String body = "{\"displayName\":\"" + name + "\",\"primaryPositions\":[\"" + pos + "\"]}";
        String res = mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
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
    /** 組 9 人合法名單 PUT body（守位 P,C,1B,2B,3B,SS,LF,CF,RF）。 */
    String legalNineRoster(String token, String teamId) throws Exception {
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder sb = new StringBuilder("{\"slots\":[");
        for (int i = 0; i < 9; i++) {
            String pid = addPlayer(token, teamId, "P" + i, pos[i]);
            if (i > 0) sb.append(",");
            sb.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
              .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        return sb.append("]}").toString();
    }

    @Test
    void put_draft_roster_does_not_validate() throws Exception {
        Ctx c = baseballGame("l1_");
        String pid = addPlayer(c.token(), c.teamId(), "Solo", "P");
        String body = "{\"slots\":[{\"playerId\":\"" + pid + "\",\"battingOrder\":1,"
            + "\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}"; // 不完整但草稿可存
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.slots.length()").value(1));
    }

    @Test
    void validate_legal_lineup_is_valid() throws Exception { // AC-5
        Ctx c = baseballGame("l2_");
        String body = legalNineRoster(c.token(), c.teamId());
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(post("/api/games/" + c.gameId() + "/roster:validate").header("Authorization", "Bearer " + c.token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.valid").value(true))
           .andExpect(jsonPath("$.violations.length()").value(0));
    }

    @Test
    void validate_illegal_lineup_lists_reasons() throws Exception { // AC-6
        Ctx c = baseballGame("l3_");
        // 只放 8 人、缺投手與守位 → 多條 violation
        StringBuilder sb = new StringBuilder("{\"slots\":[");
        String[] pos = {"C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 8; i++) {
            String pid = addPlayer(c.token(), c.teamId(), "X" + i, pos[i]);
            if (i > 0) sb.append(",");
            sb.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
              .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        String body = sb.append("]}").toString();
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(post("/api/games/" + c.gameId() + "/roster:validate").header("Authorization", "Bearer " + c.token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.valid").value(false))
           .andExpect(jsonPath("$.violations[?(@.code == 'PITCHER_MISSING')]").exists())
           .andExpect(jsonPath("$.violations[?(@.code == 'BATTING_COUNT_MISMATCH')]").exists());
    }

    @Test
    void confirm_legal_lineup_moves_status() throws Exception { // AC-5
        Ctx c = baseballGame("l4_");
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(legalNineRoster(c.token(), c.teamId())))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + c.gameId()).header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.gameStatus").value("lineup_confirmed"));
    }

    @Test
    void confirm_illegal_lineup_returns_422() throws Exception { // AC-6
        Ctx c = baseballGame("l5_");
        String pid = addPlayer(c.token(), c.teamId(), "Only", "P");
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"slots\":[{\"playerId\":\"" + pid + "\",\"battingOrder\":1,\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + c.gameId()).header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isUnprocessableEntity())
           .andExpect(jsonPath("$.violations").isArray());
    }

    @Test
    void friendly_ep_exceeds_defense_confirms() throws Exception { // AC-7
        String t = token("l6_");
        String teamId = read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"softball_slow\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
        String gbody = "{\"sportType\":\"softball_slow\",\"matchMode\":\"friendly\",\"basePresetId\":\"softball-friendly-ep\","
            + "\"dhEnabled\":false,\"epAllowed\":true,\"rosterSize\":10,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-05\",\"homeAway\":\"home\",\"opponentName\":\"Friends\"}";
        String gameId = read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(gbody))
            .andReturn().getResponse().getContentAsString(), "$.gameId");
        // 12 棒（>10 守備），守位含 SF，friendly 放寬人數/守位齊全
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF","SF"};
        StringBuilder sb = new StringBuilder("{\"slots\":[");
        for (int i = 0; i < 12; i++) {
            String pid = addPlayer(t, teamId, "S" + i, i < 10 ? pos[i] : "");
            if (i > 0) sb.append(",");
            sb.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1);
            if (i < 10) sb.append(",\"fieldPosition\":\"").append(pos[i]).append("\"");
            sb.append(",\"lineupStatus\":\"starter\"}");
        }
        String rbody = sb.append("]}").toString();
        mvc.perform(put("/api/games/" + gameId + "/roster").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(rbody)).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.gameStatus").value("lineup_confirmed"));
    }

    @Test
    void guest_slot_allowed() throws Exception {
        Ctx c = baseballGame("l7_");
        String body = "{\"slots\":[{\"guestName\":\"路人A\",\"battingOrder\":1,\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.slots[0].guestName").value("路人A"));
    }

    @Test
    void slot_with_both_sources_is_400() throws Exception {
        Ctx c = baseballGame("l8_");
        String pid = addPlayer(c.token(), c.teamId(), "Dup", "P");
        String body = "{\"slots\":[{\"playerId\":\"" + pid + "\",\"guestName\":\"X\",\"battingOrder\":1,\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: 實作 DTOs**

`lineup/dto/LineupSlotDto.java`：
```java
package com.baseball.record.lineup.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record LineupSlotDto(UUID playerId, @Size(max = 120) String guestName,
                            @Min(1) Integer battingOrder, @Size(max = 10) String fieldPosition,
                            @Pattern(regexp = "starter|bench") String lineupStatus) {}
```

`lineup/dto/PutRosterRequest.java`：
```java
package com.baseball.record.lineup.dto;

import jakarta.validation.Valid;
import java.util.List;

public record PutRosterRequest(@Valid List<LineupSlotDto> slots) {}
```

`lineup/dto/RosterResponse.java`：
```java
package com.baseball.record.lineup.dto;

import java.util.List;
import java.util.UUID;

public record RosterResponse(UUID gameId, boolean confirmed, List<LineupSlotDto> slots) {}
```

`lineup/dto/ValidationResultResponse.java`：
```java
package com.baseball.record.lineup.dto;

import java.util.List;

public record ValidationResultResponse(boolean valid, List<ViolationDto> violations) {
    public record ViolationDto(String code, String message) {}
}
```

- [ ] **Step 3: 實作 `LineupInvalidException` + `ApiExceptionHandler`（422 + violations）**

```java
package com.baseball.record.lineup;

import com.baseball.record.lineup.dto.ValidationResultResponse.ViolationDto;
import java.util.List;

public class LineupInvalidException extends RuntimeException {
    private final List<ViolationDto> violations;
    public LineupInvalidException(List<ViolationDto> violations) {
        super("lineup invalid"); this.violations = violations;
    }
    public List<ViolationDto> getViolations() { return violations; }
}
```
```java
package com.baseball.record.lineup;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(LineupInvalidException.class)
    public ProblemDetail handle(LineupInvalidException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "名單不合法");
        pd.setTitle("Lineup Invalid");
        pd.setProperty("violations", ex.getViolations());
        return pd;
    }
}
```

- [ ] **Step 4: 實作 `RosterValidationService`（DB → LineupView → LineupValidator）**

```java
package com.baseball.record.lineup;

import com.baseball.record.game.Game;
import com.baseball.record.player.Player;
import com.baseball.record.player.PlayerRepository;
import com.baseball.record.shared.ruleengine.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RosterValidationService {
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final PlayerRepository players;

    public RosterValidationService(GameRosterRepository rosters, LineupSlotRepository slots, PlayerRepository players) {
        this.rosters = rosters; this.slots = slots; this.players = players;
    }

    @Transactional(readOnly = true)
    public ValidationResult validate(Game game) {
        List<SlotView> slotViews = buildSlotViews(game);
        boolean flex = !"formal".equals(game.getMatchMode());
        LineupView view = new LineupView(game.getSportType(), game.isDhEnabled(), game.isEpAllowed(),
            game.getRosterSize(), flex, slotViews);
        return LineupValidator.validate(view);
    }

    List<SlotView> buildSlotViews(Game game) {
        GameRoster roster = rosters.findByGameId(game.getGameId()).orElse(null);
        if (roster == null) return List.of();
        List<LineupSlot> rows = slots.findByGameRosterId(roster.getGameRosterId());
        List<UUID> playerIds = rows.stream().map(LineupSlot::getPlayerId).filter(id -> id != null).toList();
        Map<UUID, Player> byId = players.findAllById(playerIds).stream()
            .collect(Collectors.toMap(Player::getPlayerId, p -> p));
        return rows.stream().map(s -> new SlotView(
            s.getPlayerId(), s.getGuestName(), s.getBattingOrder(), s.getFieldPosition(),
            s.getLineupStatus(), eligible(s, byId, game.getTeamId()))).toList();
    }

    private boolean eligible(LineupSlot s, Map<UUID, Player> byId, UUID teamId) {
        if (s.getPlayerId() == null) return true; // 路人
        Player p = byId.get(s.getPlayerId());
        return p != null && teamId.equals(p.getTeamId())
            && !"archived".equals(p.getRosterStatus()) && !"unavailable".equals(p.getAvailability());
    }
}
```

- [ ] **Step 5: 實作 `LineupService`（PUT/GET/validate）**

```java
package com.baseball.record.lineup;

import com.baseball.record.game.Game;
import com.baseball.record.game.GameRepository;
import com.baseball.record.lineup.dto.*;
import com.baseball.record.lineup.dto.ValidationResultResponse.ViolationDto;
import com.baseball.record.shared.authorization.TeamAccessPolicy;
import com.baseball.record.shared.authorization.TeamRole;
import com.baseball.record.shared.ruleengine.PositionRules;
import com.baseball.record.shared.ruleengine.ValidationResult;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class LineupService {
    private final GameRepository games;
    private final GameRosterRepository rosters;
    private final LineupSlotRepository slots;
    private final TeamAccessPolicy policy;
    private final RosterValidationService validation;

    public LineupService(GameRepository games, GameRosterRepository rosters, LineupSlotRepository slots,
                         TeamAccessPolicy policy, RosterValidationService validation) {
        this.games = games; this.rosters = rosters; this.slots = slots;
        this.policy = policy; this.validation = validation;
    }

    @Transactional(readOnly = true)
    public RosterResponse get(UUID userId, UUID gameId) {
        Game g = loadGame(gameId);
        policy.requireMember(userId, g.getTeamId());
        return toResponse(g);
    }

    @Transactional
    public RosterResponse put(UUID userId, UUID gameId, PutRosterRequest req) {
        Game g = loadGame(gameId);
        policy.requireRole(userId, g.getTeamId(), TeamRole.OWNER);
        if ("lineup_confirmed".equals(g.getGameStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "lineup already confirmed; revert to scheduled first");

        List<String> validPos = PositionRules.validPositions(g.getSportType());
        if (req.slots() != null) for (LineupSlotDto s : req.slots()) {
            boolean hasPlayer = s.playerId() != null;
            boolean hasGuest = s.guestName() != null && !s.guestName().isBlank();
            if (hasPlayer == hasGuest)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "each slot needs exactly one of playerId/guestName");
            if (s.fieldPosition() != null && !validPos.contains(s.fieldPosition()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid fieldPosition: " + s.fieldPosition());
        }

        GameRoster roster = rosters.findByGameId(gameId).orElseGet(() -> rosters.save(new GameRoster(gameId)));
        slots.deleteByGameRosterId(roster.getGameRosterId());
        if (req.slots() != null) for (LineupSlotDto s : req.slots()) {
            LineupSlot ls = new LineupSlot(roster.getGameRosterId());
            ls.setPlayerId(s.playerId());
            ls.setGuestName(s.guestName());
            ls.setBattingOrder(s.battingOrder());
            ls.setFieldPosition(s.fieldPosition());
            ls.setLineupStatus(s.lineupStatus() == null ? "starter" : s.lineupStatus());
            slots.save(ls);
        }
        roster.touch();
        return toResponse(g);
    }

    @Transactional(readOnly = true)
    public ValidationResultResponse validate(UUID userId, UUID gameId) {
        Game g = loadGame(gameId);
        policy.requireMember(userId, g.getTeamId());
        ValidationResult r = validation.validate(g);
        return new ValidationResultResponse(r.valid(),
            r.violations().stream().map(v -> new ViolationDto(v.code(), v.message())).toList());
    }

    RosterResponse toResponse(Game g) {
        GameRoster roster = rosters.findByGameId(g.getGameId()).orElse(null);
        List<LineupSlotDto> slotDtos = roster == null ? List.of()
            : slots.findByGameRosterId(roster.getGameRosterId()).stream()
                .map(s -> new LineupSlotDto(s.getPlayerId(), s.getGuestName(), s.getBattingOrder(),
                    s.getFieldPosition(), s.getLineupStatus())).toList();
        boolean confirmed = roster != null && roster.getConfirmedAt() != null;
        return new RosterResponse(g.getGameId(), confirmed, slotDtos);
    }

    Game loadGame(UUID gameId) {
        return games.findById(gameId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
```

- [ ] **Step 6: 實作 `LineupController`**

```java
package com.baseball.record.lineup;

import com.baseball.record.lineup.dto.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/games/{gameId}/roster")
public class LineupController {
    private final LineupService service;
    public LineupController(LineupService service) { this.service = service; }

    @GetMapping
    public RosterResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.get(userId, gameId);
    }

    @PutMapping
    public RosterResponse put(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId,
                              @Valid @RequestBody PutRosterRequest req) {
        return service.put(userId, gameId, req);
    }

    @PostMapping(":validate")
    public ValidationResultResponse validate(@AuthenticationPrincipal UUID userId, @PathVariable UUID gameId) {
        return service.validate(userId, gameId);
    }
}
```

- [ ] **Step 7: 接線 confirm 到 GameService**

修改 `game/GameService.java`：
1. 建構子注入 `RosterValidationService validation` 與 `GameRosterRepository rosters`（跨 module 注入 Spring bean，OK）。
2. 覆寫 `transition` 支援 `scheduled→lineup_confirmed`（驗證 gate）與 `lineup_confirmed→scheduled`（解鎖、清 confirmed_at）。

把 import 補上：
```java
import com.baseball.record.lineup.GameRoster;
import com.baseball.record.lineup.GameRosterRepository;
import com.baseball.record.lineup.LineupInvalidException;
import com.baseball.record.lineup.RosterValidationService;
import com.baseball.record.lineup.dto.ValidationResultResponse.ViolationDto;
import com.baseball.record.shared.ruleengine.ValidationResult;
import java.time.OffsetDateTime;
```
建構子改為：
```java
    private final RosterValidationService validation;
    private final GameRosterRepository rosters;

    public GameService(GameRepository games, TeamAccessPolicy policy,
                       RosterValidationService validation, GameRosterRepository rosters) {
        this.games = games; this.policy = policy; this.validation = validation; this.rosters = rosters;
    }
```
`transition` 改為（取代 Task 4 的 protected 版本）：
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
            default -> throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT,
                "illegal status transition " + g.getGameStatus() + " -> " + target);
        }
    }

    private void confirmLineup(Game g) {
        ValidationResult r = validation.validate(g);
        if (!r.valid())
            throw new LineupInvalidException(
                r.violations().stream().map(v -> new ViolationDto(v.code(), v.message())).toList());
        GameRoster roster = rosters.findByGameId(g.getGameId())
            .orElseGet(() -> rosters.save(new GameRoster(g.getGameId())));
        roster.setConfirmedAt(OffsetDateTime.now());
        roster.touch();
        g.setGameStatus("lineup_confirmed");
    }
```

- [ ] **Step 8: controller 跑測**

Run: `mvn -o -Dtest=LineupControllerIT,GameControllerIT test`
Expected: PASS（GameControllerIT 仍綠——確認 confirm 接線未破壞既有）。

- [ ] **Step 9: 後端全套回歸**

Run: `mvn -o test`
Expected: 全綠（含 M1-A/M1-B 既有測試）。

---

## Task 7：前端 API client + 型別擴充

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: 擴充 `api` 物件**（在現有 `players` 之後加四組）

```ts
  rulePresets: {
    list: (qs = '') => req(`/api/rule-presets${qs}`),
  },
  games: {
    list: (teamId: string, qs = '') => req(`/api/teams/${teamId}/games${qs}`),
    create: (teamId: string, d: object) => req(`/api/teams/${teamId}/games`, { method: 'POST', body: JSON.stringify(d) }),
    get: (gameId: string) => req(`/api/games/${gameId}`),
    update: (gameId: string, d: object) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify(d) }),
    opponents: (teamId: string, q: string) => req(`/api/teams/${teamId}/opponents?q=${encodeURIComponent(q)}`),
  },
  roster: {
    get: (gameId: string) => req(`/api/games/${gameId}/roster`),
    put: (gameId: string, d: object) => req(`/api/games/${gameId}/roster`, { method: 'PUT', body: JSON.stringify(d) }),
    validate: (gameId: string) => req(`/api/games/${gameId}/roster:validate`, { method: 'POST' }),
  },
```

- [ ] **Step 2: PATCH 422 需取得 body**（`req` 目前只 throw status；確認名單時前端需顯示 violations）

把 `req` 改為在錯誤時附帶 body：
```ts
async function req(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (!res.ok) {
    let body: any = null
    try { body = await res.json() } catch { /* no body */ }
    const err: any = new Error(`${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return res.status === 204 ? null : res.json()
}
```

- [ ] **Step 3: controller 驗證前端編譯**

Run: `cd frontend && npm run build`（或 `npx tsc --noEmit`）
Expected: 無型別錯誤。

---

## Task 8：前端 建比賽頁 + 比賽列表 + routes

**Files:**
- Create: `frontend/src/pages/GameCreatePage.tsx`, `frontend/src/pages/games.css`
- Modify: `frontend/src/pages/TeamPage.tsx`（加「比賽」區塊 + 入口）、`frontend/src/App.tsx`（加 routes）

- [ ] **Step 1: `games.css`（沿用 tokens，不寫死色）**

```css
.games-section { margin-top: 24px; }
.games-section h2 { margin-bottom: 12px; }
.game-list { display: grid; gap: 10px; }
.game-card {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 12px 16px; cursor: pointer;
}
.game-card:hover { background: var(--surface-alt); }
.game-card .meta { color: var(--muted); font-size: 0.9em; }
.status-chip { padding: 2px 10px; border-radius: var(--radius-sm); font-size: 0.85em;
  background: var(--accent-soft); color: var(--accent-strong); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 640px; }
.form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.9em; color: var(--muted); }
.form-grid .full { grid-column: 1 / -1; }
.rule-toggles { display: flex; gap: 16px; flex-wrap: wrap; }
.autocomplete { position: relative; }
.autocomplete .options {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 5;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.autocomplete .options div { padding: 6px 10px; cursor: pointer; }
.autocomplete .options div:hover { background: var(--surface-alt); }
```

- [ ] **Step 2: `GameCreatePage.tsx`**（preset 帶入可改 + 對手 autocomplete；matchMode 非 intra 必填對手）

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import './LoginPage.css'
import './teams.css'
import './games.css'

const STATUS_LABEL: Record<string, string> = { draft: '草稿', scheduled: '已排定', lineup_confirmed: '名單已確認' }

export default function GameCreatePage() {
  const { teamId } = useParams()
  const nav = useNavigate()
  const [team, setTeam] = useState<any>(null)
  const [presets, setPresets] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    sportType: 'baseball', matchMode: 'formal', basePresetId: '',
    dhEnabled: false, epAllowed: false, rosterSize: 9, reEntryAllowed: false,
    gameDate: '', homeAway: 'home', opponentName: '', venue: '', weather: '', temperatureC: '',
  })
  const [oppOptions, setOppOptions] = useState<string[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api.teams.get(teamId!).then((t: any) => {
      setTeam(t)
      setForm((f: any) => ({ ...f, sportType: t.sportType }))
    }).catch(() => nav('/'))
  }, [teamId])

  useEffect(() => {
    api.rulePresets.list(`?matchMode=${form.matchMode}`).then(setPresets)
  }, [form.matchMode])

  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  function applyPreset(id: string) {
    const p = presets.find(x => x.presetId === id)
    if (!p) { set('basePresetId', ''); return }
    setForm((f: any) => ({
      ...f, basePresetId: id, dhEnabled: p.dhAllowed, epAllowed: p.epAllowed,
      rosterSize: p.defaultRosterSize, reEntryAllowed: p.reEntryAllowed,
    }))
  }

  async function onOpponentInput(v: string) {
    set('opponentName', v)
    if (v.trim()) {
      const opts = await api.games.opponents(teamId!, v).catch(() => [])
      setOppOptions(opts.map((o: any) => o.name))
    } else setOppOptions([])
  }

  async function submit() {
    setErr('')
    const body: any = {
      sportType: form.sportType, matchMode: form.matchMode,
      basePresetId: form.basePresetId || undefined,
      dhEnabled: form.dhEnabled, epAllowed: form.epAllowed,
      rosterSize: Number(form.rosterSize), reEntryAllowed: form.reEntryAllowed,
      gameDate: form.gameDate, homeAway: form.homeAway,
      opponentName: form.opponentName || undefined,
      venue: form.venue || undefined, weather: form.weather || undefined,
      temperatureC: form.temperatureC === '' ? undefined : Number(form.temperatureC),
    }
    try {
      const g = await api.games.create(teamId!, body)
      nav(`/games/${g.gameId}`)
    } catch (e: any) { setErr('建立失敗：請確認必填欄位（對內賽以外需填對手）。') }
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>建立比賽 — {team?.teamName ?? '…'}</h1>
        <button className="btn btn-ghost" onClick={() => nav(`/teams/${teamId}`)}>← 返回</button>
      </div>
      {err && <p role="alert" className="error">{err}</p>}
      <div className="form-grid">
        <label>球種
          <select value={form.sportType} onChange={e => set('sportType', e.target.value)}>
            <option value="baseball">棒球</option>
            <option value="softball_fast">快壘</option>
            <option value="softball_slow">慢壘</option>
            <option value="teeball">樂樂棒</option>
          </select>
        </label>
        <label>賽事模式
          <select value={form.matchMode} onChange={e => set('matchMode', e.target.value)}>
            <option value="formal">正式</option>
            <option value="friendly">友誼</option>
            <option value="intra_squad">對內賽</option>
          </select>
        </label>
        <label className="full">規則基底（帶入後可改）
          <select value={form.basePresetId} onChange={e => applyPreset(e.target.value)}>
            <option value="">— 不帶入 —</option>
            {presets.map(p => <option key={p.presetId} value={p.presetId}>{p.label}</option>)}
          </select>
        </label>
        <div className="full rule-toggles">
          <label><input type="checkbox" checked={form.dhEnabled} onChange={e => set('dhEnabled', e.target.checked)} /> 允許 DH</label>
          <label><input type="checkbox" checked={form.epAllowed} onChange={e => set('epAllowed', e.target.checked)} /> 允許 EP</label>
          <label><input type="checkbox" checked={form.reEntryAllowed} onChange={e => set('reEntryAllowed', e.target.checked)} /> 允許再上場</label>
          <label>人數基準 <input type="number" min={1} value={form.rosterSize} onChange={e => set('rosterSize', e.target.value)} style={{ width: 64 }} /></label>
        </div>
        <label>比賽日期
          <input type="date" value={form.gameDate} onChange={e => set('gameDate', e.target.value)} />
        </label>
        <label>主/客
          <select value={form.homeAway} onChange={e => set('homeAway', e.target.value)}>
            <option value="home">主場</option><option value="away">客場</option>
          </select>
        </label>
        <label className="full autocomplete">對手{form.matchMode !== 'intra_squad' ? '（必填）' : '（可空）'}
          <input value={form.opponentName} onChange={e => onOpponentInput(e.target.value)} placeholder="對手名稱" />
          {oppOptions.length > 0 && (
            <div className="options">
              {oppOptions.map(o => <div key={o} onClick={() => { set('opponentName', o); setOppOptions([]) }}>{o}</div>)}
            </div>
          )}
        </label>
        <label>地點<input value={form.venue} onChange={e => set('venue', e.target.value)} /></label>
        <label>天氣<input value={form.weather} onChange={e => set('weather', e.target.value)} /></label>
        <label>溫度(℃)<input type="number" value={form.temperatureC} onChange={e => set('temperatureC', e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={submit}>建立比賽</button>
      </div>
    </main>
  )
}

export { STATUS_LABEL }
```

- [ ] **Step 3: TeamPage 加「比賽」區塊**（在球員 table 之後、`</main>` 之前插入）

於 `TeamPage.tsx` 頂部 import：
```tsx
import { STATUS_LABEL } from './GameCreatePage'
import './games.css'
```
在 component 內加 state 與載入：
```tsx
  const [games, setGames] = useState<any[]>([])
  useEffect(() => { api.games.list(teamId!).then(setGames).catch(() => setGames([])) }, [teamId])
```
在 `</table>` 之後插入：
```tsx
      <section className="games-section">
        <div className="page-head">
          <h2>比賽</h2>
          <button className="btn btn-primary" onClick={() => nav(`/teams/${teamId}/games/new`)}>建立比賽</button>
        </div>
        <div className="game-list">
          {games.length === 0 && <p className="meta">尚無比賽</p>}
          {games.map(g => (
            <div key={g.gameId} className="game-card" onClick={() => nav(`/games/${g.gameId}`)}>
              <div>
                <strong>{g.opponentName ?? '隊內對抗'}</strong>
                <div className="meta">{g.gameDate} · {g.homeAway === 'home' ? '主場' : '客場'} · {g.matchMode}</div>
              </div>
              <span className="status-chip">{STATUS_LABEL[g.gameStatus] ?? g.gameStatus}</span>
            </div>
          ))}
        </div>
      </section>
```

- [ ] **Step 4: App.tsx 加 routes**

```tsx
import GameCreatePage from './pages/GameCreatePage'
import GamePage from './pages/GamePage'
```
在 `<Routes>` 內 `TeamPage` route 之後加：
```tsx
      <Route path="/teams/:teamId/games/new" element={<GameCreatePage />} />
      <Route path="/games/:gameId" element={<GamePage />} />
```

- [ ] **Step 5: controller 驗證編譯**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯（GamePage 在 Task 9 建立——若此時尚未建，先建一個最小 stub 或與 Task 9 合併編譯）。

> 注意：Task 8 與 Task 9 並行時，App.tsx 的 `GamePage` import 需 Task 9 完成才能編譯通過。controller 在兩者皆寫完後集中 `tsc --noEmit`。

---

## Task 9：前端 名單編輯頁 + 驗證顯示

**Files:**
- Create: `frontend/src/pages/GamePage.tsx`

- [ ] **Step 1: `GamePage.tsx`**（選註冊球員/路人、打序、守位下拉、starter/bench、validate 顯示、確認名單）

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { STATUS_LABEL } from './GameCreatePage'
import './LoginPage.css'
import './teams.css'
import './games.css'

const POSITIONS: Record<string, string[]> = {
  baseball: ['P','C','1B','2B','3B','SS','LF','CF','RF'],
  softball_fast: ['P','C','1B','2B','3B','SS','LF','CF','RF'],
  softball_slow: ['P','C','1B','2B','3B','SS','LF','CF','RF','SF'],
  teeball: ['P','C','1B','2B','3B','SS','LF','CF','RF'],
}
type Slot = { playerId?: string; guestName?: string; battingOrder?: number; fieldPosition?: string; lineupStatus: string }

export default function GamePage() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [game, setGame] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [result, setResult] = useState<{ valid: boolean; violations: { code: string; message: string }[] } | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.games.get(gameId!).then(async (g: any) => {
      setGame(g)
      const ps = await api.players.list(g.teamId).catch(() => [])
      setPlayers(ps)
      const r = await api.roster.get(gameId!).catch(() => ({ slots: [] }))
      setSlots(r.slots.length ? r.slots : [])
    }).catch(() => nav('/'))
  }, [gameId])

  const positions = game ? (POSITIONS[game.sportType] ?? POSITIONS.baseball) : []

  function addSlot() {
    setSlots(s => [...s, { lineupStatus: 'starter', battingOrder: s.filter(x => x.lineupStatus === 'starter').length + 1 }])
  }
  function update(i: number, patch: Partial<Slot>) {
    setSlots(s => s.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  }
  function removeSlot(i: number) { setSlots(s => s.filter((_, idx) => idx !== i)) }

  async function save() {
    setMsg('')
    const body = { slots: slots.map(s => ({
      playerId: s.playerId || undefined,
      guestName: s.playerId ? undefined : (s.guestName || undefined),
      battingOrder: s.battingOrder ?? undefined,
      fieldPosition: s.fieldPosition || undefined,
      lineupStatus: s.lineupStatus,
    })) }
    try { await api.roster.put(gameId!, body); setMsg('名單已儲存（草稿）'); setResult(null) }
    catch { setMsg('儲存失敗：每列需恰選一名球員或填一位路人。') }
  }
  async function validate() {
    await save()
    const r = await api.roster.validate(gameId!)
    setResult(r)
  }
  async function confirm() {
    await save()
    try {
      const g = await api.games.update(gameId!, { gameStatus: 'lineup_confirmed' })
      setGame(g); setResult({ valid: true, violations: [] }); setMsg('名單已確認')
    } catch (e: any) {
      if (e.status === 422 && e.body?.violations) setResult({ valid: false, violations: e.body.violations })
      else setMsg('確認失敗')
    }
  }

  // 前端輕量提醒
  const localWarnings: string[] = []
  if (game) {
    const starters = slots.filter(s => s.lineupStatus === 'starter')
    if (!starters.some(s => s.fieldPosition === 'P')) localWarnings.push('尚未指定投手（P）')
    const orders = starters.map(s => s.battingOrder).filter(Boolean)
    if (new Set(orders).size !== orders.length) localWarnings.push('打序有重複')
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>{game ? (game.opponentName ?? '隊內對抗') : '…'}
          {game && <span className="status-chip" style={{ marginLeft: 12 }}>{STATUS_LABEL[game.gameStatus]}</span>}
        </h1>
        <button className="btn btn-ghost" onClick={() => game && nav(`/teams/${game.teamId}`)}>← 返回球隊</button>
      </div>
      {msg && <p role="status">{msg}</p>}
      {localWarnings.length > 0 && <p role="alert" className="warn">提醒：{localWarnings.join('、')}</p>}

      <table className="table">
        <thead><tr><th>打序</th><th>球員 / 路人</th><th>守位</th><th>先發/替補</th><th></th></tr></thead>
        <tbody>
          {slots.map((s, i) => (
            <tr key={i}>
              <td><input type="number" min={1} value={s.battingOrder ?? ''} style={{ width: 56 }}
                onChange={e => update(i, { battingOrder: e.target.value ? Number(e.target.value) : undefined })} /></td>
              <td>
                <select value={s.playerId ?? '__guest'} onChange={e =>
                  update(i, e.target.value === '__guest' ? { playerId: undefined } : { playerId: e.target.value, guestName: undefined })}>
                  <option value="__guest">路人…</option>
                  {players.map(p => <option key={p.playerId} value={p.playerId}>{p.displayName}{p.uniformNumber ? ` #${p.uniformNumber}` : ''}</option>)}
                </select>
                {!s.playerId && <input placeholder="路人名稱" value={s.guestName ?? ''} onChange={e => update(i, { guestName: e.target.value })} />}
              </td>
              <td>
                <select value={s.fieldPosition ?? ''} onChange={e => update(i, { fieldPosition: e.target.value || undefined })}>
                  <option value="">（無 / 只打）</option>
                  {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td>
                <select value={s.lineupStatus} onChange={e => update(i, { lineupStatus: e.target.value })}>
                  <option value="starter">先發</option><option value="bench">替補</option>
                </select>
              </td>
              <td className="row-actions"><button className="btn btn-ghost" onClick={() => removeSlot(i)}>移除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inline-form" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={addSlot}>＋ 新增一列</button>
        <button className="btn btn-ghost" onClick={save}>儲存草稿</button>
        <button className="btn btn-ghost" onClick={validate}>驗證名單</button>
        <button className="btn btn-primary" onClick={confirm}>確認名單</button>
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
    </main>
  )
}
```

- [ ] **Step 2: controller 集中驗證前端編譯（Task 8 + 9 一起）**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 無錯、build 成功。

---

## Task 10：Playwright E2E（AC-4~7）

**Files:**
- Create: `frontend/e2e/m2-games-lineup.spec.ts`
- 前置：controller 先以 `podman-compose` 起 Postgres + 後端（5199）、`npm run dev`（5200）或 `npm run build && preview`。

- [ ] **Step 1: 寫 E2E spec**

```ts
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5200'

async function registerAndLogin(page: any) {
  const email = `e2e_${Date.now()}@x.com`
  await page.goto(BASE)
  // 假設 LoginPage 有註冊切換；若無，改打 API 註冊後 setToken。
  await page.getByRole('button', { name: /註冊|切換/ }).click().catch(() => {})
  await page.getByPlaceholder(/名稱|displayName/i).fill('E2E')
  await page.getByPlaceholder(/email|信箱/i).fill(email)
  await page.getByPlaceholder(/密碼|password/i).fill('pw123456')
  await page.getByRole('button', { name: /註冊|登入/ }).click()
  await expect(page).toHaveURL(BASE + '/')
}

test('AC-4/5：建比賽 + 合法名單確認', async ({ page }) => {
  await registerAndLogin(page)
  // 建球隊
  await page.getByPlaceholder(/球隊名稱|teamName/i).fill('E2E Tigers')
  await page.getByRole('button', { name: /建立球隊|新增球隊/ }).click()
  await page.getByText('E2E Tigers').click()

  // 加 9 名球員
  for (let i = 0; i < 9; i++) {
    await page.getByPlaceholder('球員名稱').fill(`P${i}`)
    await page.getByRole('button', { name: '新增球員' }).click()
  }
  // 建比賽
  await page.getByRole('button', { name: '建立比賽' }).click()
  await page.locator('input[type=date]').fill('2026-07-01')
  await page.getByPlaceholder('對手名稱').fill('Lions')
  await page.getByRole('button', { name: '建立比賽' }).click()

  // 編 9 人合法名單
  const positions = ['P','C','1B','2B','3B','SS','LF','CF','RF']
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: '＋ 新增一列' }).click()
    const row = page.locator('table.table tbody tr').nth(i)
    await row.locator('input[type=number]').fill(String(i + 1))
    await row.locator('select').first().selectOption({ index: 1 + i }) // 選第 i 名球員
    await row.locator('select').nth(1).selectOption(positions[i])
  }
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.getByText('名單已確認')).toBeVisible()
  await expect(page.getByText('名單已確認')).toBeVisible() // status chip
})

test('AC-6：不合法名單顯示原因', async ({ page }) => {
  await registerAndLogin(page)
  await page.getByPlaceholder(/球隊名稱|teamName/i).fill('E2E B')
  await page.getByRole('button', { name: /建立球隊|新增球隊/ }).click()
  await page.getByText('E2E B').click()
  await page.getByPlaceholder('球員名稱').fill('Solo')
  await page.getByRole('button', { name: '新增球員' }).click()
  await page.getByRole('button', { name: '建立比賽' }).click()
  await page.locator('input[type=date]').fill('2026-07-02')
  await page.getByPlaceholder('對手名稱').fill('Bears')
  await page.getByRole('button', { name: '建立比賽' }).click()
  // 只放 1 人、無投手守位 → 確認失敗顯示原因
  await page.getByRole('button', { name: '＋ 新增一列' }).click()
  const row = page.locator('table.table tbody tr').first()
  await row.locator('input[type=number]').fill('1')
  await row.locator('select').first().selectOption({ index: 1 })
  await page.getByRole('button', { name: '確認名單' }).click()
  await expect(page.getByText('名單不合法')).toBeVisible()
})
```

> 註：E2E 的 selector 依 Task 8/9 實際 DOM 微調；登入流程依 `LoginPage.tsx` 既有實作（必要時改用 API 註冊 + `localStorage.setItem('br_token', ...)` 後 `page.reload()`）。AC-7 可在後端 `LineupControllerIT.friendly_ep_exceeds_defense_confirms` 已覆蓋；E2E 視時間補一條友誼 EP。

- [ ] **Step 2: controller 跑 E2E**

Run（controller 起服務後）：`cd frontend && npx playwright test e2e/m2-games-lineup.spec.ts`
Expected: AC-4/5/6 通過。

- [ ] **Step 3: 收尾**

`taskkill //F //IM node.exe`（清殘留）、刪 `frontend/.vite`（若 vite EPERM）。

---

## Self-Review

**1. Spec coverage（design §11 測試 ↔ AC）**
- AC-4 建比賽進 scheduled → Task 4 `create_game_enters_scheduled` + E2E。✅
- AC-5 合法名單可確認 → Task 6 `validate_legal_lineup_is_valid` / `confirm_legal_lineup_moves_status` + E2E。✅
- AC-6 不合法報原因 → Task 6 `validate_illegal_lineup_lists_reasons` / `confirm_illegal_lineup_returns_422` + E2E。✅
- AC-7 友誼 EP 超守備數 → Task 2 `friendly_ep_exceeds_defense_passes` + Task 6 `friendly_ep_exceeds_defense_confirms`。✅
- 守位 enum（§5）→ Task 2 `PositionRulesTest`。✅
- 路人 / guest（§3）→ Task 6 `guest_slot_allowed`。✅
- 對手 autocomplete（§8）→ Task 4 `opponent_autocomplete`。✅
- owner-only / member 讀（§7）→ Task 4 `non_member_cannot_get_game`（policy 與 M1-B 同實作）。✅
- seed 6 presets（§3）→ Task 1 + Task 3。✅

**2. Placeholder scan**：各步驟皆含完整 code / 指令；E2E selector 標註「依實際 DOM 微調」屬已知前端慣例，非 placeholder。✅

**3. Type consistency**：`SlotView(playerId, guestName, battingOrder, fieldPosition, lineupStatus, eligible)`、`LineupView(sportType, dhEnabled, epAllowed, rosterSize, flex, slots)`、`ValidationResult(valid, violations)`、`Violation(code, message)`、`ViolationDto(code, message)` 在 Task 2/6 一致；`GameService.transition` 在 Task 4 定義、Task 6 覆寫（簽章一致 `protected void transition(Game, String)`）；前端 `api.roster/games/rulePresets` 與 Task 8/9 呼叫一致。✅

**收尾**：全綠後走 `requesting-code-review` → 確認 AC（gate③）→ `finishing-a-development-branch`（commit 由使用者決定）。
