# MocknSlice product specification

MocknSlice is a browser-based, local-first fabrication design tool for makers and students. It turns built-in primitives, imported models, and parametric templates into material-aware cutting and folding plans without requiring a login or server.

## Product principles

- Work locally in a desktop-first browser interface that remains usable on tablets.
- Use millimetres for all initial fabrication dimensions.
- Keep edits non-destructive and generated geometry reproducible from source data plus parameters.
- Distinguish cut, score, fold, perforate, engrave, and guide operations with labels as well as colour.
- Warn when geometry is invalid or output may be unreliable; never hide an automatic repair.
- Produce predictable, human-readable SVG suitable for LightBurn as the first production format.

## Primary workflow

Users choose a local Simple or Advanced experience above the workflow rail. Simple defaults to Start, Choose mode, Import or create, Configure, and Export; panel construction omits Import or create. A blocking generation error inserts Inspect, while warnings remain accessible from the workspace issue drawer. Advanced adds the persistent Inspect and Arrange steps. Step numbers are derived from the visible workflow rather than fixed phases.

Configure has separate Generate/Regenerate and Next actions. Generation refreshes both previews without navigating or changing the selected viewport. Simple output derives a deterministic one-sheet layout using 0°/90° candidates, 3 mm spacing, and a 5 mm outer margin. Advanced continues to use editable persisted sheet layouts, and switching modes never replaces those manual placements.

The workspace reserves its left side for a progress rail and its right side for one contextual step panel with sticky generation/navigation actions. The persistent synchronized 3D or 2D viewport occupies the centre. In narrow embedded panes the progress rail becomes horizontal, but the wizard and preview remain side by side.

Folding templates and low-poly mesh unfolding share one mode family. Importing an STL opens mesh unfolding; choosing Create from template opens seven standalone parametric forms sized directly by width, length, and height. Other model-based manufacturing modes require an imported STL. See [Parametric folding plan](FOLDING_PLAN.md).

## Current implementation through Phase 9

The foundation includes a generated 40 mm cube, material and mode selection, a three-column responsive shell, 3D orbit and camera presets, a 2D sheet empty state, local project autosave, project JSON import/export, undo/redo, and structured validation.

Phase 2 adds ASCII and binary STL import, explicit source-unit selection, worker-based mesh normalization, uniform longest-dimension correction with read-only axis dimensions, 90° orientation controls, centred bounds, persistent normalized mesh data, 3D imported-model preview, and a model-health report for open edges, non-manifold edges, shells, and face orientation.

Phase 3 adds X/Y/Z stacked-slice generation, independent spacing and thickness controls, worker-based triangle intersection and contour reconstruction, outer/hole classification, stable part labels, structured geometry warnings, synchronized assembled and flat previews, and deterministic millimetre SVG export.

Generated parts are preserved but marked stale when source geometry or slice parameters change. Regeneration is explicit and enters undo/autosave history as one project action.

Phase 4 adds configurable sheet width, height, margins, and spacing; deterministic row placement across multiple sheets; add, duplicate, and delete sheet actions; manual drag and precise placement controls; 90° or numeric rotation; structured boundary, margin, overlap, duplicate, and unplaced-part checks; and operation-layered SVG export for the active sheet. Layout and selection stay synchronized with the assembled 3D preview. Complex polygon nesting remains deferred.

Phase 5 adds orthogonal waffle construction from any two different X/Y/Z axes. Each family has independent spacing, while material thickness plus explicit clearance determines complementary half-depth slot width. Users can alternate slot entry sides, reverse the complete assembly pattern, inspect colour-labelled families in 3D, inspect open U-shaped slot cuts in 2D, arrange all parts on sheets, and export the active sheet as layered SVG. Structured checks report missing intersections, narrow sections, slots that do not fit, overlapping slots, and hole-based entries that need manual assembly review.

Phase 6 now exposes seven standalone parametric template families with explicit width/length/height envelopes, glue or press-fit closures, edge-bounded tab depth, stable receiving slits, deterministic worker generation, assembled previews, selectable labelled 2D nets, multi-sheet arrangement, and cut/score/mountain/valley/engrave/guide SVG layers. Legacy convex-profile geometry remains internal compatibility code. Project version 2 introduced persistence for the complete result; current version 7 retains it through explicit migrations.

Phase 7 adds a non-destructive fabrication-output preparation layer. Users choose material or custom kerf, preserve fold layers or convert them to score/perforation output, configure perforation dash and gap lengths, edit every operation colour and width, size printable labels, add registration marks and sheet boundaries, and inspect the prepared result directly in 2D. The output panel reports placed material area, estimated waste, utilization, and cut length. SVG includes project-format and preparation metadata; deterministic vector PDF assembly sheets export all placed sheets with operation legends and labels. Project version 3 persists these settings and explicitly migrates versions 1 and 2.

Phase 8 adds a deliberately bounded low-poly unfolding workflow for closed, manifold, consistently oriented triangular meshes. Users choose deterministic automatic seam-tree search or mark manual seam constraints, generate one or more labelled islands, inspect reported face and glue-tab overlaps, animate the fold tree in 3D, arrange nets, and export cuts, mountain/valley folds, scores, tabs, and paired labels. Project version 4 persists source references, settings, topology, flat/source triangle coordinates, hinges, islands, issues, and hashes. See [Low-poly unfolding plan](UNFOLDING_PLAN.md).

Panel construction lets users enter inside enclosure dimensions, select butt or complementary finger joints, optionally add a lid and independent width/depth divider families, and generate material-thickness-aware panels. A compact Configure preset menu replaces the former Choose-kit step. Direct 1–10 mm sliders separately define base/wall, divider, and lid stock; divider ranges stop at the physical maximum that preserves four divider-thicknesses of clear space per cell. The UI reports equalized cell count and clear width × depth × height. Base/lid panels retain the inner footprint, front/back panels span the outside width, and side panels fit between them. Base/lid fingers and wall fingers alternate across each complete shared edge, while vertical front/back receiver intervals alternate with side-panel fingers. The outermost side-panel fingers extend by exactly one wall thickness to close the three-panel corners without enlarging the base or lid. Open kits can use flat, arch, gable, or stepped front/back profiles. After generation, all 12 shell/lid connection pairs are selectable in the assembled 3D view and compact keyboard selector. Treatment and tab actions appear in a floating editor over the selected edge, with persistent 3D badges and tab markers; clicking empty 3D space closes that editor, and the side inspector retains per-edge fit clearance and mode-wide tab depth. Generation-input edits mark an existing result stale and require an explicit Regenerate action while retaining edge selection; opening and label edits also show a nearby Generate/Regenerate reminder. A connection can use finger, butt, or scored-crease treatment; butt connections can assign one panel as glue-tab owner, while eligible straight free edges can receive manual tabs. Creases merge panels into scored fabrication components and reject cycles or unlike stock thicknesses. Dividers remain outside connection editing and continue to use bottom tabs, wall slots, and complementary half-laps. Legacy through-slot settings migrate visibly to finger joints. Project version 8 persists typed connection and boundary-tab records. See [Panel construction plan](PANEL_CONSTRUCTION_PLAN.md).

The architecture foundation now uses canonical per-mode generation inputs, signature-version-2 provenance, complete typed per-mode settings, and MocknSlice project format version 8. The classroom recipe registry offers localized survey/ballot box, sorting tray, flash-card holder, game-component box, and blank panel box starting points. Applying a recipe is one undoable replacement of ordinary panel settings; resolved values and optional recipe ID/revision are persisted, and loading never re-runs a registry factory.

The panel composer adds stable-ID rectangular and circular cutouts plus engraved labels to fixed panel roles. Users select a panel, add or select a feature in a native SVG panel-local preview, drag with pointer capture, move by keyboard, and use exact numeric controls; Advanced mode adds normalized anchors, rotation, duplication, and purpose metadata. Horizontal coordinates always run left-to-right and vertical coordinates bottom-to-top, including in Hebrew RTL. Each gesture commits one undoable project change. The same feature IDs synchronize the editor, 2D output, and owning 3D panel.

Generation places features against exact jointed panel outlines, emits cutout holes or engrave labels, carries holes into the assembled preview, and reports structured containment, clearance, collision, kerf, dimension, target, and label issues without clamping or deleting invalid input. Survey and flash-card recipe openings now produce complete geometry. These checks are digital proxies only; real material fit, laser cutting, and assembly quality remain unverified.

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
