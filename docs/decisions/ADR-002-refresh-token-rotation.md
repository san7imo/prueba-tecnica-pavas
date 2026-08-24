# ADR-002: Persisted Refresh-Token Rotation

## Status

Accepted

## Context

Short-lived access tokens limit exposure but require a secure renewal mechanism. Sessions must be revocable, logout must invalidate the current session and reuse of an already rotated credential must be treated as possible theft.

## Decision

Use signed refresh JWTs delivered only through an HttpOnly cookie. Persist only their deterministic SHA-256 digest together with expiration, revocation, replacement and UUID family metadata.

Every refresh locks the token row in a MySQL transaction, creates one replacement in the same family, revokes the predecessor and links it through `replaced_by_token_id`. Presenting a rotated predecessor revokes only the active tokens in that family. Each login starts a separate family.

## Alternatives Considered

- Long-lived access tokens: rejected because they enlarge the non-revocable exposure window.
- Stateless refresh JWTs without persistence: rejected because logout, targeted revocation and replay detection would be ineffective.
- Storing raw refresh tokens: rejected because a database disclosure would immediately expose bearer credentials.

## Consequences

- Refresh and logout require a database lookup.
- Sessions can be revoked independently and replay can be detected.
- Row locking prevents two successful descendants from one token.
- A concurrent second use is treated as replay; after one response rotates successfully, the family is revoked defensively.
- Token lifecycle and cleanup add implementation and operational complexity.
