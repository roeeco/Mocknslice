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

## Planned stacked-slice pipeline

1. Normalize a mesh with a documented vertex tolerance.
2. Intersect triangles with axis-aligned slice planes.
3. Weld segment endpoints within a configurable epsilon.
4. Trace closed contours and report open or ambiguous results.
5. Classify outer contours and holes.
6. Apply material-aware offsets only after contour validity is known.
7. Convert valid contour sets into serializable fabrication parts.

Each step will be a pure function with deterministic cube and cylinder fixtures before it is moved behind worker orchestration.

## Phase 2 limitations

- Shells are edge-connected components; faces touching at only one vertex remain separate shells.
- Face inversion is a best-effort signed-volume check and is withheld for an already invalid topology.
- The normalized mesh is persisted, but original STL bytes are not embedded in the project file.
- Import shows active/cancelled state but not percentage progress because parsing and normalization are currently one deterministic worker operation.
- No automatic repair, contouring, offsets, or fabrication output is implemented.
