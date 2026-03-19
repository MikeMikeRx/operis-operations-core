# OPERIS CORE

**Operis Operations Core** is a portfolio project exploring backend fundamentals: a multi-tenant API with auth, RBAC, idempotency, rate limiting, and background workers.


#### Live API Docs(Swagger): [View on Railway](https://operis-operations-core-production.up.railway.app/docs)
- To login use: [Demo Credentials](#demo-credentials)

📕 Author notes: See [AUTHOR_NOTES.md](/AUTHOR_NOTES.md) for the motivation, background, and design decisions behind this project.

---

## What This Project Is

- A backend foundation for a multi-tenant SaaS system
- Backend-first and API-only (no frontend)
- Implements RBAC, idempotency, and background jobs

---

## What Is Implemented

### Core Capabilities

- **Multi-Tenancy**
  - All data scoped by `tenantId`
  - Composite indexes on `tenantId` + entity keys

- **RBAC (Role-Based Access Control)**
  - Role-based permissions stored in the database
  - Permission check runs as a preHandler on protected routes

- **Authentication**
  - JWT-based authentication (Bearer tokens)
  - Refresh tokens with rotation and server-side revocation
  - Logout support

- **Product Operations**
  - Create, list (with limit), update, soft-delete products
  - Tenant-scoped access only
  - Rate limiting applied per route

- **Stock Movements**
  - Record inventory movements: `IN`, `OUT`, `ADJUST`, `TRANSFER`
  - List and retrieve movements, scoped by tenant
  - Optional `reason` and `reference` fields

- **Audit Logging**
  - Audit record written on every write operation
  - Tracks actor, action, entity, and timestamp
  - Records older than 90 days are purged automatically

- **Idempotency**
  - Required for all write requests
  - Safe retries with persisted responses
  - Conflict detection on key reuse

- **Rate Limiting**
  - Redis-backed
  - Per-tenant request quotas
  - Enforced at route level

- **Background Workers**
  - BullMQ + Redis
  - Scheduled maintenance and cleanup jobs
  - Failed jobs retained in queue (BullMQ defaults)

- **Data Retention**
  - Soft-deleted records purged automatically
  - Audit logs retained for a fixed window
  - Expired idempotency keys cleaned up
  - Expired refresh tokens purged automatically

- **Testing**
  - HTTP-level integration tests against real Postgres and Redis
  - Covers auth flow, product endpoints, stock movement endpoints, and tenant isolation
  - Runs in CI via GitHub Actions

---

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL
- **ORM**: Prisma 7
- **Cache / Queue**: Redis + BullMQ
- **Validation**: Zod
- **API Docs**: OpenAPI (Swagger)
- **Logging**: Pino
- **Testing**: Vitest + Supertest
- **CI**: GitHub Actions
- **Containerization**: Docker
- **Deployment**: Railway

---

## API

- Base path: `/api/v1`
- OpenAPI docs: `/docs`
- Health check: `/health`
- Meta endpoint: `/api/v1/meta`

Authentication:
- JWT Bearer access tokens (`Authorization: Bearer <token>`)
- Refresh tokens for session continuation
- Logout endpoint revoking refresh tokens

All write endpoints require:
- `Idempotency-Key`

---

## Docker

### Start all services

```bash
docker compose up -d
```

### Services

| Service  | Port | Description              |
|----------|------|--------------------------|
| API      | 3000 | Fastify backend          |
| Worker   | -    | BullMQ background jobs   |
| Postgres | 5432 | PostgreSQL database      |
| Redis    | 6379 | Cache and job queue      |

### Rebuild after changes

```bash
docker compose up -d --build
```

### View logs

```bash
docker compose logs -f api
```

### Stop all services

```bash
docker compose down
```

---

## Local Development (without Docker)

By default, the API runs on port 3000.

If port 3000 is already in use (for example, by the Docker API container), you can override the port locally using the PORT environment variable.

```bash
# Start database and Redis
docker compose up -d postgres redis

# Run API locally (port configurable via PORT)
cd backend && npm run dev
```

- **Local API**(optional override): `http://localhost:4001`
- **Docker API**(default): `http://localhost:3000`

Example backend/.env:
```bash
PORT=4001
```
Both can run simultaneously without conflicts.

---

## Deployed Demo

- **Base URL:** https://operis-operations-core-production.up.railway.app
- **Swagger UI:** /docs
- **Health:** /health

---

##  Demo Credentials

Use these with `POST /api/v1/auth/login` to get an access token, then use the token in the `Authorization: Bearer <token>` header to access protected endpoints.

```json
{
  "tenantId": "t1",
  "email": "user@test.local",
  "password": "password123"
}
```

---