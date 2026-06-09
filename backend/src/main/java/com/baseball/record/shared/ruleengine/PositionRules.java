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
