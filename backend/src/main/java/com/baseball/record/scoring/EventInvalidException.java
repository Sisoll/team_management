package com.baseball.record.scoring;

import com.baseball.record.shared.ruleengine.Violation;
import java.util.List;

public class EventInvalidException extends RuntimeException {
    private final List<Violation> violations;
    public EventInvalidException(List<Violation> violations) { super("event invalid"); this.violations = violations; }
    public List<Violation> getViolations() { return violations; }
}
