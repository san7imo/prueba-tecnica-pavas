# Security

## Implemented authentication and authorization

Passwords are hashed with `bcrypt`; `BCRYPT_ROUNDS` is validated between 10 and 15 and defaults to 12. Only `password_hash` is persisted. User model serialization, API serializers and explicit repository attribute lists prevent the hash from entering responses.

Login normalizes email and returns the same `401 INVALID_CREDENTIALS` response for an unknown email, wrong password or inactive account. A dedicated in-memory limiter protects only `POST /api/auth/login`; its window and maximum are environment-driven and it returns the standard API envelope with HTTP 429.

## Access tokens

Access JWTs use HS256, `JWT_ACCESS_SECRET` and a short configurable lifetime (15 minutes by default). Claims are limited to `sub`, `role`, `iat` and `exp`. The `authenticate` middleware accepts only `Authorization: Bearer`, verifies the signature/expiry and reloads the user from MySQL on every request. Missing credentials return `AUTHENTICATION_REQUIRED`; malformed, expired, absent-user, role-stale and inactive-user tokens return `INVALID_ACCESS_TOKEN`.

## Refresh tokens

Refresh JWTs use a separate secret and longer lifetime. The raw value exists only in the client cookie and during request processing; the API never returns it in JSON and MySQL stores only a deterministic SHA-256 digest. SHA-256 is appropriate here as a lookup digest over a high-entropy signed token: it allows exact lookup without retaining the bearer credential.

Each login creates an independent UUID family. Refresh rotation runs in one transaction and locks the presented row with `SELECT ... FOR UPDATE`; it creates one replacement in the same family, revokes the old row and records `replaced_by_token_id`. Reuse of a rotated token revokes all still-active rows in that family before returning `401 INVALID_REFRESH_TOKEN`. Other families for the same user remain active.

Logout looks up the current cookie by digest, revokes that token if active, and always clears the cookie. It is client-idempotent and does not implement logout-all-devices.

## Cookie and secrets

The refresh cookie is `HttpOnly`, scoped to `/api/auth`, uses configured `SameSite` (default `lax`) and is `Secure` in production. `SameSite=none` is rejected unless `Secure=true`. Secret configuration is validated at API startup: both secrets require at least 32 characters, must differ, refresh lifetime must exceed access lifetime, and known example markers are rejected in production.

No token, password, hash or secret is intentionally logged. Public auth errors do not include JWT, SQL or persistence details.

## Deferred hardening

HITO 8 adds a reusable `authorize(...roles)` boundary. Business routers execute authentication and role authorization before validators, so unauthenticated/forbidden callers do not receive body, ID or resource validation details. Health, login, refresh and logout remain public; `/me` remains authenticated.

Users and registration are ADMIN-only. MECANICO cannot administer users, delete items, deliver or cancel orders. Status authorization is evaluated in the locked WorkOrder transaction after workflow validity, preserving 400 for an invalid graph edge and 403 for a valid target forbidden to the actor.

HITO 9 derives every audit actor from the authenticated request, never from body input. Both roles may read work-order history, but its explicit serializer exposes only actor `id` and `name`; email, role, active state, password hashes and token fields are excluded. The database restricts deletion of an order or user referenced by immutable history.

Because authentication reloads the user and compares the JWT role on every request, deactivation and role changes invalidate existing access tokens immediately. Self-deactivation and self-role changes are allowed by the contract; last-ADMIN protection is explicitly outside this MVP milestone.

HITO 11 retains the global Helmet/restricted-CORS review, broader security-header checks, dependency remediation and production deployment review. The local frontend currently uses Vite's same-origin `/api` proxy, so no broad CORS policy was introduced in this milestone.
