# OPERIS CORE

**Operis Operations Core** is a backend-first, multi-tenant SaaS providing reliable foundations for internal business operations.

####  Live API Docs(Swagger): [View on Railway](https://operis-operations-core-production.up.railway.app/docs)

---

## What This Project Is

- A multi-tenant SaaS API
- Backend-first and API-only (no frontend)
- Designed around real-world operational constraints
- Built with production patterns from day one

---

## What Is Implemented

### Core Capabilities

- **Multi-Tenancy**
  - Strict tenant isolation
  - All data scoped by `tenantId`
  - Tenant-aware indexing strategy

- **RBAC (Role-Based Access Control)**
  - Role-based permissions
  - Middleware-enforced access checks
  - No route bypasses authorization

- **Authentication**
  - JWT-based authentication (Bearer tokens)
  - Refresh tokens with rotation and server-side revocation
  - Logout support

- **Product Operations**
  - Create, list, update, soft-delete products
  - Tenant-scoped access only
  - Pagination and rate limiting applied

- **Audit Logging**
  - Immutable audit trail for write operations
  - Tracks actor, action, entity, and timestamp
  - Retention policies enforced

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
  - Retry and failure handling

- **Data Retention**
  - Soft-deleted records purged automatically
  - Audit logs retained for a fixed window
  - Expired idempotency keys cleaned up
  - Expired refresh tokens purged automatically

- **Contract Testing**
  - HTTP-level contract tests
  - CI-enforced
  - OpenAPI kept in sync with behavior

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