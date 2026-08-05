# ADR 0020: Give panel features stable identities and deterministic order

## Status

Accepted

## Context

Feature editing, issue references, selection, undo, and deterministic output require identity independent of array position.

## Decision

Every feature has a stable string ID. Recipe-created IDs are deterministic; user-created IDs use the application's UUID convention. Feature arrays have no insertion-order semantics and are sorted by ID before hashing and geometry generation.

Duplicate IDs are structurally invalid. Invalid feature geometry remains stored under its original ID and receives structured issues referencing that ID.

## Consequences

Equivalent projects generate identical signatures regardless of insertion order, and UI selection survives edits and regeneration.
