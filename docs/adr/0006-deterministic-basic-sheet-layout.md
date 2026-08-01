# ADR 0006: Deterministic basic sheet layout

- Status: Accepted
- Date: 2026-08-01

## Decision

Implement Phase 4 as a pure, deterministic first-fit row arranger with persisted per-sheet transforms. Preserve input part order, do not automatically rotate parts, start at the configured safe margin, and create additional sheets when the next row cannot fit. Keep the algorithm synchronous because it is linear in part count and inexpensive compared with mesh processing.

Define a placement as rotation around the fabrication part's 2D origin followed by millimetre translation. Reuse that transform in the interactive viewport, validation, labels, and SVG coordinate generation. Manual drags remain transient presentation state until pointer release, when one undoable project change is recorded.

Validate sheet dimensions, boundary and margin crossings, pairwise axis-aligned bounding-box overlaps, missing references, unplaced parts, and duplicate placements as structured issues. Export one selected sheet with its configured physical dimensions and all operation groups. Add and duplicate actions create empty sheets so one fabrication part is not silently emitted multiple times.

## Consequences

Layout is predictable, serializable, and easy to inspect or reproduce. Multiple physical sheets and manual correction are usable without introducing a nesting dependency or worker protocol. The initial arrangement can waste material, and axis-aligned overlap warnings are conservative for irregular parts. Polygon nesting, automatic rotation optimization, and precise contour separation remain later improvements that can replace the arranger without changing the placement contract.
