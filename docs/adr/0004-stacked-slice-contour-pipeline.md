# ADR 0004: Serializable stacked-slice contour pipeline

- Status: Accepted
- Date: 2026-08-01

## Decision

Implement axis-aligned stacked slicing as pure TypeScript geometry stages: midpoint-offset plane placement, triangle-plane intersection, epsilon-based endpoint welding, graph contour tracing, containment-based outer/hole classification, and fabrication-part construction. Run the orchestration through the existing cancellable geometry worker.

Keep spacing and physical part thickness independent. Preserve valid closed islands, report open, branching, coplanar, multiple-island, overlap, and empty-output conditions as structured validation issues, and never close or repair a contour silently. Store only plain arrays, paths, slice metadata, and issues in project state.

Use the same fabrication paths to build Three.js extrusions, 2D previews, and SVG. Phase 3 SVG uses deterministic row placement with millimetre dimensions, operation groups, stable IDs, contour roles, metadata, labels, and no raster content. It intentionally does not apply kerf or claim to perform sheet nesting.

## Consequences

The slicing engine is browser-independent, deterministic, testable against generated fixtures, and safe to persist or move between workers. Changing parameters can leave old output visible but explicitly stale until regeneration. Highly degenerate, self-intersecting, or coplanar source geometry may require user adjustment because automatic repair is outside this phase. Phase 4 can replace row placement without changing contour generation or the part schema.
