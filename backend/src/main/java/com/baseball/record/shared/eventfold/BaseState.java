package com.baseball.record.shared.eventfold;

public record BaseState(String first, String second, String third) {
    public static BaseState empty() { return new BaseState(null, null, null); }
    public String at(String base) {
        return switch (base) { case "1" -> first; case "2" -> second; case "3" -> third; default -> null; };
    }
    public BaseState with(String base, String runner) {
        return switch (base) {
            case "1" -> new BaseState(runner, second, third);
            case "2" -> new BaseState(first, runner, third);
            case "3" -> new BaseState(first, second, runner);
            default -> this;
        };
    }
}
