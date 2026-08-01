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

## Phase 1 scope

The current foundation includes a generated 40 mm cube, material and mode selection, a three-column responsive shell, 3D orbit and camera presets, a 2D sheet empty state, local project autosave, project JSON import/export, undo/redo, and structured foundation notices.

Production slicing, imported model inspection, generated fabrication parts, sheet arrangement, and SVG export are intentionally unavailable. They follow in Phases 2–4.

## Roadmap

1. Foundation
2. STL import and inspection
3. Stacked-slice public MVP
4. Basic sheet layout
5. Orthogonal waffle slices
6. Deterministic folding templates
7. Improved fabrication output
8. Low-poly mesh unfolding after a feasibility spike
9. Advanced fabrication modes
