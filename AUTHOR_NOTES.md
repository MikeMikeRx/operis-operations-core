## What This Is

Operis is a backend only multi-tenant SaaS API. It was kept backend only intentionally to serve as a reusable core that a frontend can be built on top of, rather than coupling architecture decisions to a specific UI.

## Key Decisions

Fastify over Express — better TypeScript support, built-in schema validation, and significantly faster request handling

Idempotency required on all write endpoints — safe retries without duplicate side effects; keys are persisted and conflicts are detected

Redis backed rate limiting per tenant — prevents one tenant from affecting others under load

Refresh token rotation with server side revocation — stateless access tokens with the ability to invalidate sessions

BullMQ for background jobs — audit log purging, soft delete cleanup, and expired token/key removal run on schedule rather than inline with requests

Audit log on every write — tracks actor, action, entity, and timestamp with a 90 day retention window