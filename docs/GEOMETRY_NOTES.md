# Geometry notes

## Coordinate and unit policy

All fabrication dimensions are millimetres. Imported model coordinates will remain separate from fabrication dimensions until normalization records an explicit conversion. The render layer may map these numbers directly for convenience but must never persist a Three.js object or assume an STL unit.

## STL normalization

Phase 2 accepts ASCII and little-endian binary STL. Because STL has no reliable unit metadata, the user chooses millimetres, centimetres, metres, or inches before import. The choice and source-to-mm factor are persisted.

Normalization:

1. Parse triangle coordinates without relying on header metadata or normals.
2. Convert coordinates to millimetres.
3. Remove zero-area triangles and report the count.
4. Weld vertices within `0.00001 mm`, including adjacent spatial hash cells.
5. Remove triangles collapsed by welding.
6. Calculate source bounds and centre the usable mesh at the origin.
7. Reconstruct indexed triangles and calculate topology health.

Health inspection counts undirected edge uses, open edges, edges shared by more than two faces, edge-connected shells, and inconsistent directions across two-face edges. Signed volume identifies likely inversion only for a closed, manifold, consistently oriented mesh. SliceFold reports these properties but does not repair them silently.

Dimension correction uniformly scales all positions. Orientation controls apply deterministic 90° rotations to positions, then recalculate bounds and health data. Both operations participate in project undo/redo.

## Stacked-slice pipeline

1. Normalize a mesh with a documented vertex tolerance.
2. Intersect triangles with axis-aligned slice planes.
3. Weld segment endpoints within a configurable epsilon.
4. Trace closed contours and report open or ambiguous results.
5. Classify outer contours and holes.
6. Normalize outer contours counter-clockwise and holes clockwise.
7. Convert each outer island plus its contained holes into a serializable fabrication part.

Each step is a pure function. Worker orchestration calls the same pipeline used by deterministic cube, cylinder, hollow-prism, and open-mesh tests.

Slice planes begin half a spacing interval inside the model bounds and repeat at the requested spacing. If spacing is at least the model extent, one plane is placed at the midpoint. This avoids generating faces directly on model boundary planes. X planes project to Z/Y part coordinates, Y planes to X/Z, and Z planes to X/Y.

Triangle intersections within the contour epsilon are welded through neighbouring spatial-hash cells. Duplicate graph edges are discarded. Degree-one nodes form open contours and nodes with degree above two are ambiguous; both conditions produce structured warnings rather than automatic closure. Closed contour nesting depth determines outer/hole roles.

Part thickness controls the extruded assembled preview and fabrication metadata. It does not change plane spacing. Thickness greater than spacing is allowed but reported because assembled parts overlap.

## Planned shape-aware template fitting

Phase 6 will fit fixed folding-template topologies to an imported model without unfolding its faces. The selected axis determines an orthographic projection using the same axis mapping as slicing. The pure fitting pipeline will:

1. Deduplicate and deterministically sort projected mesh vertices.
2. Build a monotone-chain convex hull.
3. Offset the convex hull outward by explicit clearance.
4. Simplify short edges while preserving a convex enclosure.
5. Pass the fitted profile and axial extent to a pure template generator.
6. Validate shared-edge lengths, material minimums, tabs, net overlap, and sheet bounds.

Default simplification tolerance is `1 mm`; the effective minimum edge is `max(2 mm, material thickness × 2)`. The source projection and fitted outline remain separately serializable so the interface can show every automated change. Detailed template rules and planned types are in [FOLDING_PLAN.md](FOLDING_PLAN.md).

Concave silhouettes, projection holes, and arbitrary face unfolding are deliberately excluded. A template incompatibility is reported rather than repaired by changing topology.

## Phase 3 limitations

- Shells are edge-connected components; faces touching at only one vertex remain separate shells.
- Face inversion is a best-effort signed-volume check and is withheld for an already invalid topology.
- The normalized mesh is persisted, but original STL bytes are not embedded in the project file.
- Import shows active/cancelled state but not percentage progress because parsing and normalization are currently one deterministic worker operation.
- Slice planes are axis-aligned; arbitrary planes and orthogonal waffle intersections come later.
- No automatic repair, kerf offset, clearance offset, simplification, or smoothing is applied.
- A plane exactly coplanar with model faces is reported and may require a spacing adjustment.
- Self-intersecting source contours are not repaired.
- The assembled preview is visual verification, not a collision or structural simulation.
