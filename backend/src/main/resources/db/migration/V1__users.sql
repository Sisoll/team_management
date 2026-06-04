CREATE TABLE users (
    user_id        UUID PRIMARY KEY,
    display_name   VARCHAR(120) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    account_status VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
