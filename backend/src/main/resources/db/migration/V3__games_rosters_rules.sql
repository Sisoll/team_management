CREATE TABLE rule_preset (
    preset_id           VARCHAR(40) PRIMARY KEY,
    label               VARCHAR(60)  NOT NULL,
    sport_type          VARCHAR(20)  NOT NULL,
    match_mode          VARCHAR(20)  NOT NULL,
    dh_allowed          BOOLEAN      NOT NULL,
    ep_allowed          BOOLEAN      NOT NULL,
    default_roster_size INT          NOT NULL,
    re_entry_allowed    BOOLEAN      NOT NULL,
    roster_flex         BOOLEAN      NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO rule_preset
    (preset_id, label, sport_type, match_mode, dh_allowed, ep_allowed, default_roster_size, re_entry_allowed, roster_flex)
VALUES
    ('baseball-formal-9',          '棒球正式賽 9 人',      'baseball',      'formal',   false, false, 9,  false, false),
    ('baseball-formal-dh',         '棒球正式賽 9 人+DH',   'baseball',      'formal',   true,  false, 9,  false, false),
    ('softball-slow-formal-10',    '慢壘正式賽 10 人',      'softball_slow', 'formal',   false, false, 10, true,  false),
    ('softball-slow-formal-ep-11', '慢壘正式賽 10 人+EP',  'softball_slow', 'formal',   false, true,  10, true,  false),
    ('softball-friendly-ep',       '壘球友誼賽（EP/彈性）', 'softball_slow', 'friendly', false, true,  10, true,  true),
    ('teeball-friendly',           '樂樂棒友誼賽（彈性）',  'teeball',       'friendly', false, true,  9,  true,  true);

CREATE TABLE games (
    game_id          UUID PRIMARY KEY,
    team_id          UUID         NOT NULL REFERENCES teams(team_id),
    sport_type       VARCHAR(20)  NOT NULL,
    match_mode       VARCHAR(20)  NOT NULL,
    base_preset_id   VARCHAR(40)  REFERENCES rule_preset(preset_id),
    dh_enabled       BOOLEAN      NOT NULL,
    ep_allowed       BOOLEAN      NOT NULL,
    roster_size      INT          NOT NULL,
    re_entry_allowed BOOLEAN      NOT NULL,
    game_date        DATE         NOT NULL,
    home_away        VARCHAR(10)  NOT NULL,
    opponent_name    VARCHAR(120),
    venue            VARCHAR(120),
    weather          VARCHAR(40),
    temperature_c    INT,
    game_status      VARCHAR(20)  NOT NULL DEFAULT 'draft',
    created_by       UUID         NOT NULL REFERENCES users(user_id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_games_team     ON games (team_id);
CREATE INDEX idx_games_opponent ON games (team_id, opponent_name);

CREATE TABLE game_roster (
    game_roster_id UUID PRIMARY KEY,
    game_id        UUID        NOT NULL UNIQUE REFERENCES games(game_id),
    confirmed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE lineup_slot (
    slot_id        UUID PRIMARY KEY,
    game_roster_id UUID        NOT NULL REFERENCES game_roster(game_roster_id),
    player_id      UUID        REFERENCES players(player_id),
    guest_name     VARCHAR(120),
    batting_order  INT,
    field_position VARCHAR(10),
    lineup_status  VARCHAR(20) NOT NULL DEFAULT 'starter',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_slot_source CHECK ((player_id IS NOT NULL) <> (guest_name IS NOT NULL))
);
CREATE INDEX idx_slot_roster ON lineup_slot (game_roster_id);
