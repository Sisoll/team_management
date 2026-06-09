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
