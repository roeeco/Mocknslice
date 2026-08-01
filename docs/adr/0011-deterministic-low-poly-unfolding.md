# ADR 0011: Deterministic spanning-tree mesh unfolding

## Status

Accepted

## Context

Phase 8 needs useful manual and automatic unfolding without implying that SliceFold can repair or globally optimize arbitrary organic meshes. The existing normalized model is an indexed triangular mesh, geometry work already runs in cancellable workers, and SVG/PDF/layout consume serializable fabrication paths. Adding a broad geometry dependency would expand browser bundle, validation, and licensing risk before the supported topology is proven.

## Decision

Use a pure in-repository triangle adjacency and spanning-forest engine. Require closed, manifold, consistently oriented input under an explicit face limit. Manual seam keys forbid hinges; automatic mode tries a deterministic bounded family of roots and edge orders. Flatten rigid triangles across tree hinges, rank candidates by overlap/islands/footprint, emit every excluded shared edge as a paired seam, and retain any remaining overlap as a structured warning.

Persist the complete result in project version 4. Derive fold-preview positions by rotating child subtrees around current hinge axes; do not persist animated vertices or Three.js objects. Reuse existing fabrication parts, layout, output preparation, SVG, and PDF paths. Add no new runtime geometry dependency.

## Consequences

- Identical inputs are reproducible and testable without a browser.
- Manual editing remains bounded to stable seam constraints; the graph may still require visible automatic cycle cuts.
- The search can fail to find an overlap-free net even when one exists. The interface must report this clearly.
- High-poly, open, non-manifold, inconsistently oriented, textured, or repair-needing models are excluded rather than approximated silently.
- A future optimizer or polygon-panel workflow can replace the candidate generator behind the serializable contract after its own spike and ADR.
