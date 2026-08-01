# Bounded low-poly unfolding plan

## Release scope

Phase 8 adds manual and automatic triangle-mesh unfolding after the source model has been normalized. It is intentionally narrower than a general papercraft editor: it provides stable seam constraints, deterministic tree search, visible overlap checks, paired labels, glue tabs, rigid fold preview, layout, and layered export for small valid meshes.

The feature is enabled only for closed, edge-manifold, consistently oriented triangular meshes within an explicit face limit. Unsupported input receives a structured blocking issue and remains available for the existing slicing and shape-aware template workflows.

## User workflow

1. Import, normalize, inspect, and orient an STL.
2. Choose **Unfold a 3D model**.
3. Choose automatic tree search or manual seam constraints, a root triangle, face limit, search budget, and tab depth.
4. Generate or regenerate through the cancellable geometry worker.
5. Review island, fold, seam, tab, and overlap counts.
6. In manual mode, mark shared edges that must be seams. The generator adds any further cycle-breaking seams visibly.
7. Scrub the 3D flat-to-folded preview and inspect the labelled 2D net.
8. Arrange islands and export operation-layered SVG or vector PDF.

## Determinism contract

Identical indexed mesh coordinates, model ID, material thickness, and settings produce identical topology ordering, tree candidates, face placement, labels, tabs, issues, and `sf8-` input hash. Automatic candidates use bounded, fixed root and edge-order variations. Candidate ranking is overlap count, island count, then planar bounding area.

Manual seams are constraints. They can split the graph into multiple islands; every remaining graph cycle still needs an automatically labelled seam because a flat fold graph must be acyclic.

## Safety and fabrication contract

- No unsupported topology is silently repaired.
- No overlap is silently removed. Face and tab collisions are structured warnings with affected IDs.
- Source edge lengths define every flattened triangle; generated and animated triangles remain rigid.
- Cut, score, mountain-fold, valley-fold, engrave, guide, tab, panel, and edge identities flow through layout and export.
- Output preparation remains non-destructive. Open net cuts stay on their centreline when kerf is enabled and produce the existing notice.

## Deferred work

Global-optimum seam search, arbitrary face or polygon editing, interactive 3D edge picking, remeshing, coplanar panel merging, concave tabs, bend allowance, collision-aware folding, assembly sequencing, texture/UV workflows, PDO import, and organic high-poly unfolding remain future research.
