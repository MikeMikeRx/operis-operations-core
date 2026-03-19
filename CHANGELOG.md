# Changelog

All notable changes to this project are documented in this file.

This project follows **API versioning discipline**:
- Public API lives under `/api/v{N}`
- **Never break an existing API version**
- Breaking changes require a new version (`/api/v2`, `/api/v3`, …)

---

## [Unreleased]

### Added
- Initial `/api/v1` product CRUD endpoints
- Multi-tenant support with RBAC
- Idempotency support for write operations
- Audit logging for mutating actions
- Redis-backed background worker
- OpenAPI (Swagger) documentation
- JWT authentication (Bearer tokens) for /api/v1
- Refresh tokens with rotation and server-side revocation
- Logout endpoint revoking refresh tokens
- Tenant isolation tests (cross-tenant visibility, mutations, login, forged JWT, idempotency key namespacing, `tenantDb` unit tests)
- Stock movement endpoints (`POST/GET /api/v1/stock-movements`, `GET /api/v1/stock-movements/:id`)
- `MovementType` enum: `IN`, `OUT`, `ADJUST`, `TRANSFER`
- `stockmovement:read` and `stockmovement:write` RBAC permissions

### Changed
- Enforced `/api/v1` prefix for all public routes
- Standardized write responses for idempotency safety
- Removed header-based identity (x-tenant-id, x-user-id) in favor of JWT claims
- Auth endpoints excluded from idempotency enforcement
- Authentication enforced globally for `/api/v1/*`

### Fixed
- CI pipeline stability
- Contract tests for authenticated endpoints

### Deprecated
- Nothing

### Removed
- Header-based authentication context

### Security
- Tenant isolation enforced at query layer
- Permission checks required for write operations
- Centralized auth guard for /api/v1/*
- Refresh token hashing and revocation on logout

---

## Versioning & Deprecation Policy

### API Versioning
- `/api/v1` is **stable**
- Breaking changes **must not** be introduced into `/api/v1`
- Breaking changes require a new major version (`/api/v2`)

### Deprecation
- Deprecated endpoints remain available for **90 days**
- Deprecations must be listed under **Deprecated**
- Removal must be listed under **Removed** in the next version

---

## Changelog Rules (non-negotiable)
- Every PR that changes behavior updates this file
- No silent breaking changes
- No retroactive edits to released versions
