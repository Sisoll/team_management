-- V4__game_events.sql

ALTER TABLE games ADD COLUMN recording_detail   VARCHAR(4)  NOT NULL DEFAULT 'L2';
ALTER TABLE games ADD COLUMN symmetric_opponent BOOLEAN     NOT NULL DEFAULT false;

CREATE TABLE game_event (
    event_id        UUID PRIMARY KEY,
    game_id         UUID         NOT NULL REFERENCES games(game_id),
    inning          INT          NOT NULL,
    half            VARCHAR(10)  NOT NULL,                 -- top / bottom
    sequence_no     INT          NOT NULL,                 -- 全場單調遞增，定義順序與重算起點
    event_type      VARCHAR(30)  NOT NULL,
    actor_player_id UUID,                                  -- 進攻打者；守備半局匿名對手 = null
    related_players UUID[]       NOT NULL DEFAULT '{}',    -- 被換者/投手/受影響跑者
    payload         JSONB        NOT NULL DEFAULT '{}',    -- runnerMoves / pitches / fieldPosition / guestBatterName
    score_delta     INT          NOT NULL DEFAULT 0,
    outs_after      INT          NOT NULL,
    bases_after     JSONB        NOT NULL DEFAULT '{}',    -- {first,second,third}
    snapshot_after  JSONB        NOT NULL DEFAULT '{}',    -- 完整 GameState
    capture_source  VARCHAR(20)  NOT NULL DEFAULT 'manual',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_game_seq UNIQUE (game_id, sequence_no)
);
CREATE INDEX idx_event_game_seq ON game_event (game_id, sequence_no);
