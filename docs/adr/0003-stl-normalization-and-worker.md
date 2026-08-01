# ADR 0003: Deterministic STL normalization in a worker

- Status: Accepted
- Date: 2026-08-01

## Decision

Parse ASCII and little-endian binary STL with a small local parser, then run pure normalization and topology inspection in a cancellable module Web Worker. Do not use Three.js `STLLoader` in the worker.

Convert from a user-selected source unit to millimetres before welding. Use a `0.00001 mm` merge tolerance with neighbouring spatial-hash-cell checks. Remove and report zero-area or welding-collapsed triangles, centre the mesh, and return serializable indexed geometry, bounds, import settings, and structured health data.

Persist normalized mesh arrays in the project. Recreate Three.js buffer geometry only in the viewport and contain viewport errors so model data remains accessible.

## Consequences

The worker bundle remains small and avoids loading a second Three.js graph or triggering development-time dependency optimization on the first import. Parsing and geometry tests are deterministic and browser-independent. Original STL bytes are not yet embedded, and health analysis reports rather than repairs topology.
