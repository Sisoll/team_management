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
