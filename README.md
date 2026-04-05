# Bank Account Management System (Event Sourcing & CQRS)

A fully functional bank account management API built with Node.js, Express, and PostgreSQL using **Event Sourcing** and **CQRS** (Command Query Responsibility Segregation) patterns.

## 🚀 Overview

This project implements a highly auditable and scalable banking system where:
-   **Events** are the single source of truth (Event Sourcing).
-   **Read Models** are separated from **Write Models** for optimal query performance (CQRS).
-   **Snapshots** are used to optimize aggregate state reconstruction.
-   **Projections** rebuild read-only summary views asynchronously from the event stream.

## 🏗️ Architecture

-   **Write Side (Commands):** Validates business rules against the current aggregate state and persists events.
-   **Read Side (Queries):** Serves optimized JSON views of accounts and transaction history.
-   **Event Store:** An immutable log of all state changes in PostgreSQL.
-   **Projector:** Processes events and updates the read-model tables (`account_summaries`, `transaction_history`).
-   **Snapshots:** Created every 50 events to minimize history replay time.

## 🛠️ Tech Stack

-   **Backend:** Node.js, TypeScript, Express
-   **Database:** PostgreSQL
-   **Documentation:** Swagger UI (OpenAPI 3.0)
-   **Containerization:** Docker, Docker Compose

## 📦 Setup & Installation

### Prerequisites
-   Docker and Docker Compose installed.

### 1. Configure Environment
Create a `.env` file from the example:
```bash
cp .env.example .env
```

### 2. Start the System
Run the following command to build and start all services:
```bash
docker-compose up --build
```
The API will be available at `http://localhost:8081/api` (or your configured `API_PORT`).

### 3. API Documentation
Interactive Swagger UI is available at:
**`http://localhost:8081/docs`**

## 📖 API Usage Guide

### **Commands (Write Operations)**
-   `POST /api/accounts`: Create a new account.
-   `POST /api/accounts/{id}/deposit`: Deposit funds.
-   `POST /api/accounts/{id}/withdraw`: Withdraw funds (checks for sufficient balance).
-   `POST /api/accounts/{id}/close`: Close an account (requires zero balance).

### **Queries (Read Operations)**
-   `GET /api/accounts/{id}`: Get account current status.
-   `GET /api/accounts/{id}/transactions`: Paginated history of deposits and withdrawals.
-   `GET /api/accounts/{id}/events`: Full audit trail (event stream).
-   `GET /api/accounts/{id}/balance-at/{timestamp}`: Time-travel query for historical balance.

### **Administrative**
-   `POST /api/projections/rebuild`: Triggers a full reconstruction of read-model projections from the event store.
-   `GET /api/projections/status`: Shows the lag and status of projections.

## 🧪 Testing with Demo Data
The system comes with a pre-seeded account for quick testing:
-   **Account ID:** `acc-test-12345`
-   **Owner:** Jane Doe (from `submission.json`)
-   **Initial Account:** `acc-12345` / John Doe (from seed script)
