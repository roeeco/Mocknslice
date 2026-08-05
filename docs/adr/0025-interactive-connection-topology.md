# ADR 0025: Persist connection intent, not editor selection

## Status

Accepted.

## Context

Panel construction and folding need one assembled-edge editor while retaining deterministic worker generation, project migration, undo/redo, and accessible non-pointer operation. A selected 3D edge is transient UI state; its treatment and glue-tab intent affect fabrication geometry.

## Decision

- Project format v8 persists stable connection overrides and stable boundary-tab records in each mode's typed settings.
- Panel treatments are `finger`, `butt`, or `crease`; folding treatments are `crease` or `cut`.
- Closure ownership is explicit. Free tabs target stable generated boundary-edge IDs.
- Selection remains outside `ProjectData` and canonical generation signatures.
- Canonical builders sort active overrides and tabs by stable ID. Folding excludes records for inactive template families.
- Crease-connected panels form an acyclic graph. Generation aligns shared edges rigidly, removes internal cuts, emits direct score paths, and creates one fabrication part per connected component.
- Invalid cycles, owners, stock mismatches, missing edges, shaped free edges, and unsafe tab dimensions remain persisted but block regeneration. The previous valid artifact is retained.
- 3D hit targets and a keyboard list select the same generated assembled-edge references; the 2D layout remains output inspection rather than an editor.

## Consequences

Default no-override fabrication geometry remains unchanged. Migrated topology artifacts stay inspectable but lose verified generation provenance and carry a regeneration notice. Nominal crease placement does not claim bend allowance or physical cardboard fit.
