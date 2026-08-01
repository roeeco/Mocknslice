# ADR 0002: Defer optional geometry libraries

- Status: Accepted
- Date: 2026-08-01

## Decision

Do not adopt `manifold-3d`, Clipper2, or another polygon boolean/offset dependency during the foundation phase.

Before adoption, run an isolated browser spike that measures compatibility, production bundle size, deterministic results, performance, hole handling, and licence compatibility. Record each candidate and representative fixture result in a follow-up ADR.

## Consequences

Phase 1 carries no premature geometry dependency. Phase 2 mesh validation and Phase 3 contour/offset work must explicitly choose between small in-house pure functions and a validated library.
