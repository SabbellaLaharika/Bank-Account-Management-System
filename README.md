# Bank Account Management System with ES/CQRS

This project implements a backend API for a Bank Account Management System using Event Sourcing (ES) and Command Query Responsibility Segregation (CQRS) patterns. All changes to an account's state are stored as a sequence of immutable events, while materialized read models provide fast querying.

## Features

- **Event Sourcing (Write Side):** Stores domain events (`AccountCreated`, `MoneyDeposited`, `MoneyWithdrawn`, `AccountClosed`) in a PostgreSQL event store for a complete audit trail.
- **CQRS (Read Side):** Separate projections (`account_summaries` and `transaction_history`) optimized for queries are updated by a projector listening to the event stream.
- **Idempotency:** Command handlers (like depositing and withdrawing money) check for processed `transactionId`s to safely handle repeated requests.
- **Snapshotting Strategy:** To rapidly load account state without replaying all events from the beginning of time, a snapshot is automatically generated every 50 events. Future loads hydrate from the snapshot first.
- **Time-Travel Queries:** Reconstruct the exact account balance at any specific point in history by replaying events up to that timestamp.
- **Administrative Utilities:** An endpoint triggers a full rebuild of the projections by replaying the entire event stream.

## Setup and Installation

The system is fully containerized with Docker and Docker Compose. Ensure you have Docker Desktop installed on your system.

1.  **Environment Variables:**
    A `.env.example` file is included in the root directory. You can copy it or simply rely on it, as the variables default within the `docker-compose.yml` if not present.

2.  **Start Services:**
    Run the following command in the root of the project to build the application and start the PostgreSQL database and NodeJS server:
    ```bash
    docker-compose up --build
    ```
    - The PostgreSQL server will start and automatically run the schema creation scripts in `seeds/init.sql`.
    - The Node API server will wait for the database healthcheck to be healthy before starting.
    - The API will be accessible on `http://localhost:8080`.

## API Endpoints Overview

### Command Endpoints (Write Model)
- `POST /api/accounts` - Create a new bank account.
- `POST /api/accounts/:accountId/deposit` - Deposit money into an account.
- `POST /api/accounts/:accountId/withdraw` - Withdraw money.
- `POST /api/accounts/:accountId/close` - Close an account.

### Query Endpoints (Read Model)
- `GET /api/accounts/:accountId` - Get the current state summary of an account.
- `GET /api/accounts/:accountId/transactions` - Get a paginated list of all transactions.
- `GET /api/accounts/:accountId/events` - Get the full raw event stream for auditing.
- `GET /api/accounts/:accountId/balance-at/:timestamp` - Time-travel query for past balances.

### Projection Endpoints (Administrative)
- `GET /api/projections/status` - Check projection sync lag and statuses.
- `POST /api/projections/rebuild` - Initiate a full rebuild of the `account_summaries` and `transaction_history` tables.

## Testing Data
The `submission.json` file contains test data used for evaluating the API structure.
