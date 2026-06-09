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
