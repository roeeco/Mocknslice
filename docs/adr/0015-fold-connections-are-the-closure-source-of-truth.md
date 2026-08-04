# 0015 — Fold connections are the closure source of truth

## Decision

Represent each physical panel adjacency as a serializable `FoldConnection`. Hinges describe retained material joins; required seams carry exactly one closure method and its tab identity. Fabrication paths remain derived output.

## Consequences

Template nets can validate missing, duplicate, or malformed closures before export. The present template builders still supply their existing layout specifications, but `netBuilder` converts them into connections and validates both panel boundaries and seam lengths. Future mesh panel-unfolding will emit the same graph rather than maintaining a separate tab list.
