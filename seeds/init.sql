CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    event_number INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT events_aggregate_id_event_number_key UNIQUE (aggregate_id, event_number)
);

CREATE INDEX IF NOT EXISTS events_aggregate_id_idx ON events (aggregate_id);

CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id UUID PRIMARY KEY NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL UNIQUE,
    snapshot_data JSONB NOT NULL,
    last_event_number INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snapshots_aggregate_id_idx ON snapshots (aggregate_id);

CREATE TABLE IF NOT EXISTS account_summaries (
    account_id VARCHAR(255) PRIMARY KEY NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    balance DECIMAL(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    version BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_history (
    transaction_id VARCHAR(255) PRIMARY KEY NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(19, 4) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS transaction_history_account_id_idx ON transaction_history (account_id);
-- Seed demo data
INSERT INTO account_summaries (account_id, owner_name, balance, currency, status, version)
VALUES ('acc-test-12345', 'Jane Doe', 1500.00, 'USD', 'OPEN', 2)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO transaction_history (transaction_id, account_id, type, amount, description, timestamp)
VALUES ('tx-seed-1', 'acc-12345', 'DEPOSIT', 1500.00, 'Initial seed deposit', NOW())
ON CONFLICT (transaction_id) DO NOTHING;

INSERT INTO events (event_id, aggregate_id, aggregate_type, event_type, event_data, event_number, timestamp, version)
VALUES 
    (uuid_generate_v4(), 'acc-test-12345', 'BankAccount', 'AccountCreated', '{"accountId": "acc-test-12345", "ownerName": "Jane Doe", "initialBalance": 1000, "currency": "USD"}'::jsonb, 1, NOW() - INTERVAL '1 hour', 1),
    (uuid_generate_v4(), 'acc-test-12345', 'BankAccount', 'MoneyDeposited', '{"amount": 500, "description": "Seed Bonus", "transactionId": "tx-seed-1"}'::jsonb, 2, NOW(), 1)
ON CONFLICT (aggregate_id, event_number) DO NOTHING;
