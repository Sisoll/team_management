-- V5__er_override.sql：投手自責分(ER)手動覆寫（box score 預設 ER=R，可由 owner 改）
CREATE TABLE er_override (
    id         UUID PRIMARY KEY,
    game_id    UUID NOT NULL REFERENCES games(game_id),
    pitcher_id UUID NOT NULL,
    er         INT  NOT NULL,
    CONSTRAINT uq_er_game_pitcher UNIQUE (game_id, pitcher_id)
);
CREATE INDEX idx_er_game ON er_override (game_id);
