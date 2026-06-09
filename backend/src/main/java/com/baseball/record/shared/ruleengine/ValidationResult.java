package com.baseball.record.shared.ruleengine;
import java.util.List;
public record ValidationResult(boolean valid, List<Violation> violations) {}
