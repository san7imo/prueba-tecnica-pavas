# Security

## Security boundary

The Express API is the authoritative security boundary. Browser route guards and hidden controls improve UX, but authentication, authorization, workflow rules, validation and persistence constraints are all enforced again on the backend. The global request order is Helmet → restricted credentialed CORS → bounded JSON parsing → route authentication/authorization → validation → controller/service/repository → not-found/error handling.

## Authentication and passwords

Passwords are hashed with `bcrypt`; `BCRYPT_ROUNDS` is constrained to 10–15 and defaults to 12. Only `password_hash` is persisted. Explicit serializers, repository attribute lists and model serialization prevent hashes from entering API responses.

Login normalizes email and gives the same `401 INVALID_CREDENTIALS` response for an unknown email, wrong password or inactive user. It is protected by an environment-configured, process-local rate limiter scoped only to `POST /api/auth/login`, with a stable `429 LOGIN_RATE_LIMITED` response.

## Access-token boundary

Access JWTs use only HS256, a dedicated secret and a short lifetime (15 minutes by default). Claims are limited to `sub`, `role`, `iat` and `exp`. Verification explicitly allows only HS256, reloads the user from MySQL, rejects inactive/missing users and rejects a token whose embedded role no longer matches persistence. Refresh tokens and JWTs signed with another algorithm cannot cross this boundary.

The middleware accepts only `Authorization: Bearer`. Missing credentials return `AUTHENTICATION_REQUIRED`; malformed, expired, wrong-signature, wrong-purpose, stale-role and inactive-user tokens return the same safe `INVALID_ACCESS_TOKEN` class.

## Refresh lifecycle and replay response

Refresh JWTs use a distinct secret, HS256 and a longer lifetime. Their raw values exist only in the HttpOnly cookie and transient request processing; the API never returns them in JSON. MySQL stores a SHA-256 digest suitable for exact lookup of this high-entropy signed bearer value.

Each login creates an independent UUID family. Refresh rotation locks the presented database row, creates one replacement, revokes its predecessor and records `replaced_by_token_id` in one transaction. Use of an already-rotated token revokes every active descendant in that family before returning `401 INVALID_REFRESH_TOKEN`; other login families remain usable. Concurrent use is deliberately handled as possible replay.

Logout revokes the current token when present, always clears the browser cookie and is client-idempotent. Logout-all-devices is outside this MVP.

## Cookie policy

The refresh cookie is:

- `HttpOnly`;
- scoped narrowly to `/api/auth`;
- `SameSite=Lax` by default;
- `Secure` in production;
- given a lifetime matching the configured refresh-token duration.

The clear-cookie response reuses the same `Path`, `HttpOnly`, `SameSite` and `Secure` attributes, so the browser targets the cookie that was set. Startup rejects `SameSite=None` without `Secure=true` and rejects non-secure production cookies.

## CORS and CSRF posture

`FRONTEND_ORIGIN` is one exact HTTP(S) origin, never `*`. Credentialed requests from that origin are allowed; any other browser origin receives a safe 403. Requests without `Origin` remain available to non-browser clients such as Postman and server health probes. Allowed methods and `Authorization`/`Content-Type` headers are explicit, and preflight behavior is tested.

Production requires an HTTPS frontend origin. Business mutations require an in-memory Bearer token, while the cookie is scoped only to auth endpoints. SameSite, exact-origin credentialed CORS and the narrow cookie path reduce CSRF exposure for refresh/logout; logout is idempotent. This MVP does not add a CSRF token because no general business mutation relies on cookie authentication. If the deployment later broadens cookie scope, supports cross-site embedding or adds cookie-authenticated mutations, a synchronizer/double-submit token must be reconsidered.

## HTTP headers

Helmet is installed before all routes. Its defaults include MIME sniffing protection, framing protection, a no-referrer policy and related defensive headers. `X-Powered-By` is disabled. HSTS is emitted only in production, where HTTPS is required; it uses a one-year lifetime without preload or an unverified subdomain commitment.

Content Security Policy is deliberately disabled on this JSON-only API because the API serves no executable HTML. The separately built React application must define its own deployment CSP at its hosting layer. `Cross-Origin-Resource-Policy: cross-origin` is intentional for a separately hosted frontend; CORS remains the control governing whether browser JavaScript may read API responses.

## Input, payload and error handling

All write endpoints validate allowlisted fields and bounded lengths/ranges before services execute. IDs and pagination are bounded; work-order descriptions and audit notes have explicit maxima. Express accepts JSON bodies up to 100 KiB. Malformed JSON returns `400 INVALID_JSON`; oversized JSON returns `413 PAYLOAD_TOO_LARGE`.

Expected application errors use stable public codes/messages. Unexpected exceptions always become `500 INTERNAL_ERROR` with `An unexpected error occurred.` Stack traces, SQL errors, JWT internals, paths, environment values, cookies, hashes and secrets are not serialized. Startup emits controlled configuration messages, but database initialization failures are generic so driver/connection details are not logged.

## Authorization, database integrity and audit

Every Client, Bike and WorkOrder route authenticates first. ADMIN/MECANICO permissions are enforced in route middleware and, for state targets, inside the locked domain transaction. Unauthorized callers receive 401/403 before validation or resource details. User administration is ADMIN-only; MECANICO cannot delete items, deliver or cancel orders.

Sequelize parameter binding/model APIs are used for user-controlled queries. The only production SQL literal is the fixed server-owned decimal total expression; no input is interpolated into it. Database UNIQUE, foreign-key, CHECK and ENUM constraints provide defense in depth. Multi-write totals, refresh rotation, order creation/audit and status/audit operations are transactional and use row locks where required.

Status-history records are append-only through the API. Audit actor identity comes from the authenticated request, not request data, and history serializers expose only actor ID/name.

## Frontend session, XSS and sensitive storage

The frontend holds access tokens only in module/context memory and never writes either token to `localStorage` or `sessionStorage`. JavaScript cannot read the HttpOnly refresh cookie. A dedicated auth client avoids interceptor recursion; one shared refresh promise coordinates concurrent 401 responses and each business request retries at most once. Explicit logout clears memory even after network failure, and stale in-flight refreshes cannot restore a cleared session.

React's normal text escaping renders user/domain values. The source does not use `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function`. Avoid adding any of those sinks; if rich HTML ever becomes required, it needs an explicit sanitizer and threat review.

## Configuration validation

Startup fails before connecting or listening when:

- `NODE_ENV` is not `development`, `test` or `production`;
- `FRONTEND_ORIGIN` is missing, malformed, contains a path/query/fragment or is non-HTTPS in production;
- JWT secrets are shorter than 32 characters, equal, or recognizable examples in production;
- refresh lifetime is not longer than access lifetime;
- production cookies are not secure;
- `SameSite=None` is configured without `Secure`.

Only safe examples are versioned. Real `.env` files, secrets and credentials must be supplied by the runtime and never committed.

## Dependency security review

On 2026-08-24, both frontend audits (all dependencies and production-only) reported zero findings. Backend audits reported two moderate records for one transitive chain: Sequelize 6.37.8 depends on `uuid` 8.3.2, affected by a bounds-check advisory when callers supply a buffer to UUID v3/v5/v6 generation. The application does not call those APIs, and Sequelize 6.37.8 is the newest v6 release. npm's proposed automatic remediation is a semver-major downgrade to Sequelize 3.30.0, which would be materially unsafe and architecturally incompatible, so no forced fix was applied.

This is an accepted, documented residual dependency risk for the assessment. Recheck for a maintained Sequelize v6 patch or a planned compatible upgrade before production release. `npm audit fix --force` is prohibited as a substitute for review.

## Residual risks and production recommendations

- The login limiter is process-local; multi-instance production should use an approved shared limiter or edge/WAF control.
- There is no MFA, account lockout workflow, password reset or centralized secret manager in this scoped MVP.
- Symmetric JWT secrets require disciplined rotation and secret distribution; production should use a managed secret store and documented rotation procedure.
- CORS is not authentication and non-browser clients can omit `Origin`; all authorization controls must remain intact.
- The frontend CSP belongs to its deployment host and is not supplied by this JSON API.
- Last-ADMIN protection is outside scope, so operational procedures must preserve at least one active ADMIN.
- The accepted Sequelize/uuid advisory must remain visible in release review.
- Production should terminate TLS at a trusted proxy, set an explicit proxy policy before relying on client IP, centralize redacted security logs, monitor 401/403/429/replay signals, back up MySQL and rerun both audits in CI/release gates.
