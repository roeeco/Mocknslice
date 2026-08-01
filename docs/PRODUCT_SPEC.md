# SliceFold product specification

SliceFold is a browser-based, local-first fabrication design tool for makers and students. It turns built-in primitives, imported models, and parametric templates into material-aware cutting and folding plans without requiring a login or server.

## Product principles

- Work locally in a desktop-first browser interface that remains usable on tablets.
- Use millimetres for all initial fabrication dimensions.
- Keep edits non-destructive and generated geometry reproducible from source data plus parameters.
- Distinguish cut, score, fold, perforate, engrave, and guide operations with labels as well as colour.
- Warn when geometry is invalid or output may be unreliable; never hide an automatic repair.
- Produce predictable, human-readable SVG suitable for LightBurn as the first production format.

## Primary workflow

Users can return to any earlier step: Start, Choose mode, Import or create, Configure, Inspect, Arrange, and Export.

The desktop workspace uses workflow navigation on the left, a synchronized 3D or 2D viewport in the centre, and parameters plus structured validation on the right.

For planned folding work, the user will import and orient an STL, choose a general template, fit it to a convex projected profile with explicit clearance, inspect the assembled construction and flat net, then arrange and export it. See [Shape-aware folding plan](FOLDING_PLAN.md).

## Current implementation through Phase 5

The foundation includes a generated 40 mm cube, material and mode selection, a three-column responsive shell, 3D orbit and camera presets, a 2D sheet empty state, local project autosave, project JSON import/export, undo/redo, and structured validation.

Phase 2 adds ASCII and binary STL import, explicit source-unit selection, worker-based mesh normalization, proportional dimension correction, 90° orientation controls, centred bounds, persistent normalized mesh data, 3D imported-model preview, and a model-health report for open edges, non-manifold edges, shells, and face orientation.

Phase 3 adds X/Y/Z stacked-slice generation, independent spacing and thickness controls, worker-based triangle intersection and contour reconstruction, outer/hole classification, stable part labels, structured geometry warnings, synchronized assembled and flat previews, and deterministic millimetre SVG export.

Generated parts are preserved but marked stale when source geometry or slice parameters change. Regeneration is explicit and enters undo/autosave history as one project action.

Phase 4 adds configurable sheet width, height, margins, and spacing; deterministic row placement across multiple sheets; add, duplicate, and delete sheet actions; manual drag and precise placement controls; 90° or numeric rotation; structured boundary, margin, overlap, duplicate, and unplaced-part checks; and operation-layered SVG export for the active sheet. Layout and selection stay synchronized with the assembled 3D preview. Complex polygon nesting remains deferred.

Phase 5 adds orthogonal waffle construction from any two different X/Y/Z axes. Each family has independent spacing, while material thickness plus explicit clearance determines complementary half-depth slot width. Users can alternate slot entry sides, reverse the complete assembly pattern, inspect colour-labelled families in 3D, inspect open U-shaped slot cuts in 2D, arrange all parts on sheets, and export the active sheet as layered SVG. Structured checks report missing intersections, narrow sections, slots that do not fit, overlapping slots, and hole-based entries that need manual assembly review.

## Roadmap

1. Foundation
2. STL import and inspection
3. Stacked-slice public MVP
4. Basic sheet layout
5. Orthogonal waffle slices
6. Shape-aware deterministic folding templates
7. Improved fabrication output
8. Advanced mesh unfolding research, not currently scheduled
9. Advanced fabrication modes
