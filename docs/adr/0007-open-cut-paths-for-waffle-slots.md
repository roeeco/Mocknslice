# ADR 0007: Open cut paths for orthogonal waffle slots

- Status: Accepted
- Date: 2026-08-01

## Decision

Build orthogonal waffle geometry by reusing the deterministic stacked-slice pipeline for two perpendicular families, then scan and intersect their filled contour intervals along the common physical axis. Generate complementary half-depth slots whose width is material thickness plus user clearance.

Represent each slot as a three-sided open U-shaped cut path whose endpoints lie on the part's existing contour. Persist explicit pair, axis, centre, width, depth, and direction metadata. Keep the outer contour unchanged as the canonical panel outline used by the assembled preview. Run complete waffle generation in the geometry worker and preserve the existing cancellation and stale-result checks.

Use even/odd scan-line intervals with hole subtraction instead of adding a polygon-boolean dependency. Warn when holes could become slot entries, when the complete width does not fit, when the shared section is narrow, when two slots overlap, or when paired slices do not intersect. Provide family-based, alternating, and globally reversed direction patterns.

## Consequences

The resulting SVG is directly fabricable: the outer boundary segment plus the open U cut encloses removable slot waste. Slot paths remain operation-layered, stable, serializable, and independently testable. The approach works for convex and many concave slice contours without a new geometry library.

The 3D extrusion retains the unslotted canonical outline and visualizes family assembly rather than exact removed material. Hole-origin entries need manual review, and insertion order or structural fit is not simulated. A future polygon-boolean spike may replace presentation geometry without changing persisted slot metadata or fabrication paths.
