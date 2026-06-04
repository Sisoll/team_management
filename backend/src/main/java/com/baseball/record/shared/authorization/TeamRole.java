package com.baseball.record.shared.authorization;

public enum TeamRole {
    OWNER("owner"), MANAGER("manager"), COACH("coach"),
    SCORER("scorer"), MEMBER("member"), STAFF("staff");

    private final String code;
    TeamRole(String code) { this.code = code; }
    public String code() { return code; }
}
