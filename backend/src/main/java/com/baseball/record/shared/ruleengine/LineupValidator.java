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
