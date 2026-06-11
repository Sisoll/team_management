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
