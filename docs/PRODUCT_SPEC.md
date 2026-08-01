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

For folding work, the user imports and orients an STL, chooses a general template, fits it to a convex projected profile with explicit clearance, inspects the assembled construction and flat net, then arranges and exports it. See [Shape-aware folding plan](FOLDING_PLAN.md).

## Current implementation through Phase 9

The foundation includes a generated 40 mm cube, material and mode selection, a three-column responsive shell, 3D orbit and camera presets, a 2D sheet empty state, local project autosave, project JSON import/export, undo/redo, and structured validation.

Phase 2 adds ASCII and binary STL import, explicit source-unit selection, worker-based mesh normalization, proportional dimension correction, 90° orientation controls, centred bounds, persistent normalized mesh data, 3D imported-model preview, and a model-health report for open edges, non-manifold edges, shells, and face orientation.

Phase 3 adds X/Y/Z stacked-slice generation, independent spacing and thickness controls, worker-based triangle intersection and contour reconstruction, outer/hole classification, stable part labels, structured geometry warnings, synchronized assembled and flat previews, and deterministic millimetre SVG export.

Generated parts are preserved but marked stale when source geometry or slice parameters change. Regeneration is explicit and enters undo/autosave history as one project action.

Phase 4 adds configurable sheet width, height, margins, and spacing; deterministic row placement across multiple sheets; add, duplicate, and delete sheet actions; manual drag and precise placement controls; 90° or numeric rotation; structured boundary, margin, overlap, duplicate, and unplaced-part checks; and operation-layered SVG export for the active sheet. Layout and selection stay synchronized with the assembled 3D preview. Complex polygon nesting remains deferred.

Phase 5 adds orthogonal waffle construction from any two different X/Y/Z axes. Each family has independent spacing, while material thickness plus explicit clearance determines complementary half-depth slot width. Users can alternate slot entry sides, reverse the complete assembly pattern, inspect colour-labelled families in 3D, inspect open U-shaped slot cuts in 2D, arrange all parts on sheets, and export the active sheet as layered SVG. Structured checks report missing intersections, narrow sections, slots that do not fit, overlapping slots, and hole-based entries that need manual assembly review.

Phase 6 adds deterministic X/Y/Z projection, convex hull offset and visible simplification, seven shape-aware template families, material-aware fit warnings, stable panel/edge/tab IDs, an explicit worker-based Generate/Regenerate action, source-versus-fitted profile inspection, the imported model ghosted inside an assembled panel preview, selectable and labelled 2D nets, multi-sheet arrangement, and cut/score/mountain/valley/engrave/guide SVG layers. Project version 2 introduced persistence for the complete result; current version 5 retains it through explicit migrations.

Phase 7 adds a non-destructive fabrication-output preparation layer. Users choose material or custom kerf, preserve fold layers or convert them to score/perforation output, configure perforation dash and gap lengths, edit every operation colour and width, size printable labels, add registration marks and sheet boundaries, and inspect the prepared result directly in 2D. The output panel reports placed material area, estimated waste, utilization, and cut length. SVG includes project-format and preparation metadata; deterministic vector PDF assembly sheets export all placed sheets with operation legends and labels. Project version 3 persists these settings and explicitly migrates versions 1 and 2.

Phase 8 adds a deliberately bounded low-poly unfolding workflow for closed, manifold, consistently oriented triangular meshes. Users choose deterministic automatic seam-tree search or mark manual seam constraints, generate one or more labelled islands, inspect reported face and glue-tab overlaps, animate the fold tree in 3D, arrange nets, and export cuts, mountain/valley folds, scores, tabs, and paired labels. Project version 4 persists source references, settings, topology, flat/source triangle coordinates, hinges, islands, issues, and hashes. See [Low-poly unfolding plan](UNFOLDING_PLAN.md).

Phase 9 begins the advanced-feature roadmap with parametric panel construction. Users enter inside enclosure dimensions, select butt, complementary finger, or tab-and-slot joints, optionally close the kit with a fully jointed lid, and generate material-thickness-aware panels. The assembled 3D preview uses nominal surfaces while the 2D sheet and exports retain exact stepped outlines, through-slots, paired joint labels, and structured material/assembly warnings. Project version 5 persists the complete construction result. See [Panel construction plan](PANEL_CONSTRUCTION_PLAN.md).

## Roadmap

1. Foundation
2. STL import and inspection
3. Stacked-slice public MVP
4. Basic sheet layout
5. Orthogonal waffle slices
6. Shape-aware deterministic folding templates
7. Improved fabrication output — implemented
8. Bounded low-poly mesh unfolding — implemented
9. Advanced features — panel construction implemented; radial slicing, nesting, living hinges, guided assembly, PWA, cloud, and localization remain follow-ups
