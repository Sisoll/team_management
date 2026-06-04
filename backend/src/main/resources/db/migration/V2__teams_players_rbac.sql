CREATE TABLE teams (
    team_id      UUID PRIMARY KEY,
    team_name    VARCHAR(120) NOT NULL,
    sport_type   VARCHAR(20)  NOT NULL,
    team_status  VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_by   UUID         NOT NULL REFERENCES users(user_id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE team_memberships (
    membership_id     UUID PRIMARY KEY,
    team_id           UUID        NOT NULL REFERENCES teams(team_id),
    user_id           UUID        NOT NULL REFERENCES users(user_id),
    roles             TEXT[]      NOT NULL,
    membership_status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, user_id)
);
CREATE INDEX idx_membership_user ON team_memberships (user_id);

CREATE TABLE players (
    player_id            UUID PRIMARY KEY,
    team_id              UUID        NOT NULL REFERENCES teams(team_id),
    display_name         VARCHAR(120) NOT NULL,
    uniform_number       VARCHAR(10),
    primary_positions    TEXT[]      NOT NULL DEFAULT '{}',
    secondary_positions  TEXT[]      NOT NULL DEFAULT '{}',
    roster_status        VARCHAR(20) NOT NULL DEFAULT 'active',
    availability         VARCHAR(20) NOT NULL DEFAULT 'available',
    linked_user_id       UUID        REFERENCES users(user_id),
    linked_membership_id UUID        REFERENCES team_memberships(membership_id),
    account_link_status  VARCHAR(20) NOT NULL DEFAULT 'unlinked',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_team ON players (team_id);

CREATE TABLE player_history (
    history_id  UUID PRIMARY KEY,
    player_id   UUID        NOT NULL REFERENCES players(player_id),
    field       VARCHAR(40) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    changed_by  UUID        NOT NULL REFERENCES users(user_id),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_player ON player_history (player_id, changed_at);
