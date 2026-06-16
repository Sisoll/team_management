CREATE TABLE game_signup (
    signup_id   UUID PRIMARY KEY,
    game_id     UUID         NOT NULL REFERENCES games(game_id),
    player_id   UUID         REFERENCES players(player_id),
    guest_name  VARCHAR(120),
    status      VARCHAR(20)  NOT NULL DEFAULT 'signed_up',
    note        VARCHAR(200),
    sort_index  INT          NOT NULL DEFAULT 0,
    created_by  UUID         NOT NULL REFERENCES users(user_id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_signup_source CHECK ((player_id IS NOT NULL) <> (guest_name IS NOT NULL))
);
CREATE UNIQUE INDEX uq_signup_game_player ON game_signup (game_id, player_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_signup_game ON game_signup (game_id);
