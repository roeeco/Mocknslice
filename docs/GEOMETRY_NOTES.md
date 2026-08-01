# Geometry notes

## Coordinate and unit policy

All fabrication dimensions are millimetres. Imported model coordinates will remain separate from fabrication dimensions until normalization records an explicit conversion. The render layer may map these numbers directly for convenience but must never persist a Three.js object or assume an STL unit.

## Planned stacked-slice pipeline

1. Normalize a mesh with a documented vertex tolerance.
2. Intersect triangles with axis-aligned slice planes.
3. Weld segment endpoints within a configurable epsilon.
4. Trace closed contours and report open or ambiguous results.
5. Classify outer contours and holes.
6. Apply material-aware offsets only after contour validity is known.
7. Convert valid contour sets into serializable fabrication parts.

Each step will be a pure function with deterministic cube and cylinder fixtures before it is moved behind worker orchestration.

## Phase 1 status

The 40 mm cube is generated in the presentation layer using Three.js `BoxGeometry` for visual orientation only. It is not evidence of slicing support. Model normalization, validation, contouring, offsets, and export geometry begin in later phases.
