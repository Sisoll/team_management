package com.baseball.record.shared.eventfold;

/** from: "B"(打者)/"1"/"2"/"3"；to: "1"/"2"/"3"/"H"(得分)/"OUT"。跑者去向由記錄員顯式產生。 */
public record RunnerMove(String from, String to) {}
