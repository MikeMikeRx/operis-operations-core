# Architecture

## Overview

Operis Operations Core is a multi-tenant SaaS API for internal business operations. It is backend-only, built with Fastify and TypeScript, backed by PostgreSQL and Redis.

The system runs as two processes:
- **API server** — handles HTTP requests, authentication, and business logic
- **Worker** — processes scheduled maintenance jobs via BullMQ

---

## Directory Structure

```
backend/src/
├── server.ts                 # Entry point: starts HTTP server, schedules jobs
├── app.ts                    # Fastify app factory: registers plugins and routes
├── worker.ts                 # BullMQ worker process for background jobs
│
├── plugins/                  # Fastify plugins (registered in order)
│   ├── requestContext.ts     # Request ID generation and correlation
│   ├── db.ts                 # Prisma client injection
│   ├── jwt.ts                # JWT signing and verification
│   ├── apiAuthGuard.ts       # Auth enforcement on /api/v1/*
│   ├── rateLimit.ts          # Redis-backed per-tenant rate limiting
│   ├── idempotency.ts        # Write request deduplication
│   └── swagger.ts            # OpenAPI documentation
│
├── routes/
│   ├── auth.ts               # Login, refresh, logout endpoints
│   ├── products.ts           # Product CRUD endpoints
│   └── product.schemas.ts    # Zod validation schemas
│
├── auth/
│   ├── requireAuth.ts        # JWT verification, populates req.auth
│   ├── rbac.ts               # Permission checking (requirePerm)
│   ├── cookies.ts            # Refresh token cookie config
│   └── refreshToken.ts       # Token generation and hashing
│
├── db/
│   ├── prisma.ts             # Singleton PrismaClient with pg adapter
│   └── tenant.ts             # tenantDb() — scopes all queries to tenant
│
├── audit/
│   └── audit.ts              # writeAudit() helper
│
├── queues/
│   └── maintenance.ts        # Job scheduling (4 recurring jobs)
│
└── workers/
    ├── redis.ts              # Redis connection config
    └── jobs/
        ├── cleanupIdempotency.ts
        ├── purgeSoftDeletedProducts.ts
        ├── purgeAuditLogs.ts
        └── purgeExpiredRefreshTokens.ts
```

---

## Bootstrap Flow

```
server.ts
  └─ buildApp()                          (app.ts)
       ├─ register plugins (in order)    (plugins/)
       ├─ register cookie parser
       ├─ mount auth routes              (/api/v1/auth)
       ├─ mount product routes           (/api/v1/products)
       └─ register health + meta endpoints
  └─ app.listen({ port, host })
  └─ ensureMaintenanceJobs()             (queues/maintenance.ts)
```

---

## Plugin Chain

Plugins register in this order. Each wraps Fastify hooks that run on every request.

| # | Plugin | Hook | Purpose |
|---|--------|------|---------|
| 1 | requestContext | onRequest | Generates `x-request-id`, attaches to logger |
| 2 | db | decoration | Injects `app.prisma`, disconnects on close |
| 3 | jwt | decoration | Registers `req.jwtVerify()` and `reply.jwtSign()` |
| 4 | apiAuthGuard | onRequest | Enforces JWT auth on `/api/v1/*` (skips `/auth`, `/health`, `/docs`) |
| 5 | rateLimit | onRequest | Per-tenant Redis throttling (key: `tenant:{id}` or IP) |
| 6 | idempotency | preHandler + onSend | Deduplicates writes via `Idempotency-Key` header |
| 7 | swagger | decoration | Registers `/docs` endpoint (disabled in test) |

---

## Routes

### Auth (`/api/v1/auth`)

| Method | Path | Rate Limit | Description |
|--------|------|-----------|-------------|
| POST | /auth/login | 10/min | Verify credentials, return JWT + set refresh cookie |
| POST | /auth/refresh | 20/min | Rotate refresh token, return new JWT |
| POST | /auth/logout | 20/min | Revoke refresh tokens, clear cookie |

### Products (`/api/v1/products`)

| Method | Path | Permission | Rate Limit | Description |
|--------|------|-----------|-----------|-------------|
| GET | /products | product:read | 120/min | List products (paginated, tenant-scoped) |
| POST | /products | product:write | 60/min | Create product (idempotent, audited) |
| PATCH | /products/:id | product:write | 60/min | Update product (idempotent, audited) |
| DELETE | /products/:id | product:write | 60/min | Soft delete (idempotent, audited, returns 204) |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/v1/meta | Version, commit, build info |
| GET | /docs | Swagger UI |

---

## Database

### Models (Prisma)

| Model | Purpose | Key Constraints |
|-------|---------|----------------|
| Tenant | Multi-tenancy root | — |
| User | Credentials + role assignment | Unique `[tenantId, email]` |
| Role | RBAC with permissions array | Per-tenant |
| Product | Inventory items | Unique `[tenantId, sku]`, soft delete via `deletedAt` |
| StockMovement | Stock change audit trail | Types: IN, OUT, ADJUST |
| AuditLog | Immutable action log | Tracks actor, action, entity, metadata |
| IdempotencyKey | Request deduplication cache | 24h TTL, stores response |
| RefreshToken | Token rotation tracking | Stores SHA-256 hash, supports revocation |

### Tenant Scoping

All data queries go through `tenantDb()`, which wraps Prisma to automatically inject `tenantId` and filter out soft-deleted records:

```typescript
const db = tenantDb(app.prisma, req.auth.tenantId);
const products = await db.product.findMany({ take: 20 });
// Automatically: WHERE tenantId = ? AND deletedAt IS NULL
```

---

## Authentication

### Flow

```
Login:
  POST /auth/login { tenantId, email, password }
    → bcrypt.compare(password, hash)
    → Sign JWT { userId, tenantId, roleId } (15min TTL)
    → Generate refresh token (crypto.randomBytes)
    → Store SHA-256(token) in DB
    → Set httpOnly cookie
    → Return { accessToken }

Refresh:
  POST /auth/refresh (reads cookie)
    → Hash cookie value → find token in DB
    → Transaction: revoke old + create new
    → Return new JWT

Logout:
  POST /auth/logout
    → Revoke all user's refresh tokens
    → Clear cookie
```

### Cookie Config

- `httpOnly: true` — not accessible to JavaScript
- `sameSite: lax` — CSRF protection
- `secure: true` in production — HTTPS only
- `path: /api/v1/auth` — only sent to auth endpoints

### RBAC

Permissions are stored as string arrays on the Role model. Route handlers use `requirePerm("product:write")` as a preHandler hook that queries the user's role and checks for the permission.

---

## Background Workers

The worker process runs separately from the API server, connected to the same Redis and PostgreSQL instances.

### Scheduled Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| cleanup-idempotency | Hourly | Delete expired idempotency keys |
| purge-soft-deleted-products | Daily | Hard-delete products soft-deleted 30+ days ago |
| purge-audit-logs | Daily | Delete audit logs older than 90 days |
| purge-expired-refresh-tokens | Daily | Delete expired refresh tokens |

Jobs are scheduled by the API server on startup via `ensureMaintenanceJobs()` and processed by the worker via BullMQ.

---

## Request Lifecycle

```
Request arrives
  │
  ├─ 1. requestContext    → Generate/extract x-request-id
  ├─ 2. cookie parser     → Parse cookies
  ├─ 3. apiAuthGuard      → Verify JWT, populate req.auth
  ├─ 4. rateLimit         → Check tenant quota in Redis
  ├─ 5. idempotency       → Check for duplicate write (preHandler)
  ├─ 6. requirePerm       → Check RBAC permission (preHandler)
  │
  ├─ Handler executes
  │
  ├─ 7. idempotency       → Cache response for future dedup (onSend)
  │
  └─ Response sent with x-request-id header
```

---

## Key Design Decisions

### Multi-Tenancy
All models include `tenantId`. The `tenantDb()` wrapper makes cross-tenant queries structurally impossible. Tenant ID comes from the verified JWT, not from user input.

### Soft Deletes
Products use a `deletedAt` timestamp instead of hard deletion. All queries filter out soft-deleted records automatically. A background job hard-deletes records after 30 days.

### Idempotency
All write endpoints require an `Idempotency-Key` header. The server hashes the request body and caches the response for 24 hours. Replayed requests with the same key return the cached response. Mismatched request bodies on the same key return 409 Conflict.

### Audit Logging
Every write operation (create, update, delete) appends to an immutable audit log recording the actor, action, entity, and metadata. Logs are retained for 90 days.

### Rate Limiting
Throttling is per-tenant (not per-IP) using Redis counters. This prevents one tenant from consuming another's quota. Unauthenticated endpoints fall back to IP-based limiting.

### Token Security
Refresh tokens are never stored in plain text — only their SHA-256 hash is persisted. Every refresh rotates the token atomically (revoke old + issue new in a transaction) to prevent reuse of stolen tokens.
