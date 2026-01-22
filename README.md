# Operis

**Operis** is a backend-first **Operations Management System (OMS)** for small to mid-sized businesses.

It provides a structured, auditable way to record and control **internal business operations** such as expenses, approvals, and operational records.  
The system is designed to start simple and evolve into a robust operational backbone.

---

## Development Status

🚧 **Under active development**

This project is in its initial phase.
Focus is on backend foundations, operational correctness, and core domain modeling.

---

## Scope & Philosophy

- Backend-first
- API-driven
- Operations over UI
- Control, traceability, and correctness as priorities
- Simple core → robust extensions

Operis is **not** a CRM and **not** a full ERP.  
It focuses on **internal operational discipline**.

---

## Current Domain (Phase 1)

### Expense Operations
- Record company expenses
- Enforce approval workflows
- Track spending by employee, department, and period
- Maintain a complete audit trail of actions

Future domains (planned, not implemented yet):
- Inventory operations
- Cost and budget control
- Operational reporting

---

## Features

- **Multi-Tenant Core** – Company-level isolation and control
- **Expense Records** – Structured expense data with lifecycle states
- **Approval Workflows** – Role-based approval and rejection
- **Audit Logging** – Immutable record of operational actions
- **API-First Design** – No UI dependency

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma 7
- **Validation**: Zod
- **API Docs**: Swagger / OpenAPI
- **Logging**: Pino

---

## Docker

### Start all services

```bash
docker-compose up -d
```

### Services

| Service  | Port | Description          |
|----------|------|----------------------|
| API      | 3000 | Fastify backend      |
| Postgres | 5432 | PostgreSQL database  |

### Rebuild after changes

```bash
docker-compose up -d --build
```

### View logs

```bash
docker-compose logs -f api
```

### Stop all services

```bash
docker-compose down
```

---

## Local Development (without Docker)

Run the API directly on your machine while using Docker for Postgres:

```bash
# Start only database
docker-compose up -d postgres

# Run API locally (uses port 4001)
cd backend && npm run dev
```

- **Local API**: `http://localhost:4001`
- **Docker API**: `http://localhost:3000`

Both can run simultaneously without conflicts.

---