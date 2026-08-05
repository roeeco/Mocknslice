# ADR 0017: Derive generation signatures from canonical active input

## Status

Accepted

## Context

Generation provenance currently hashes the complete settings bag, material profile, and model for every mode. Unrelated edits therefore make valid output stale, while worker-result checks duplicate conversion logic.

## Decision

Each mode has one pure canonical input builder. Its normalized output is both the worker payload and the source of the generation signature. Object keys are stable, semantically unordered collections are sorted, and non-finite or undefined values are rejected before hashing.

Model-based modes include their model inputs. Standalone templates and panel construction exclude unrelated model data. Worker results are accepted only when the current canonical input hash still matches the dispatched hash.

## Consequences

Stale detection reflects physical generation dependencies, and the worker, provenance record, and UI share one definition of active input.
