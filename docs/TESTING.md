# Testing MocknSlice

## Commands

- `npm run typecheck` — strict application and configuration TypeScript checks.
- `npm run lint` — typed ESLint checks with zero warnings.
- `npm run format:check` — Prettier verification.
- `npm test` — Vitest unit and React Testing Library component tests.
- `npm run test:e2e` — Playwright Chromium smoke tests against the Vite development server.
- `npm run build` — TypeScript project build and production Vite bundle.

## Coverage through Phase 9

Tests verify default material profiles and snapshot isolation, versioned project JSON round-trips and rejection paths, IndexedDB save/list/restore/delete behaviour, parameter panel state changes and undo, ASCII and binary STL parsing, cube normalization, unit conversion, degenerate-triangle reporting, open/non-manifold/disconnected topology, scaling, orientation, and model inspection controls.

## Architecture foundation coverage

- Static project fixtures cover every legacy file version from 1 through 7, including raw unversioned IndexedDB v6 migration, raw IndexedDB v7 migration, and current v8 round trips.
- Strict settings tests reject malformed discriminators, non-finite values, unsupported future versions, and unknown feature kinds while preserving structurally valid future features.
- Frozen physical baselines cover stacked and waffle slicing, all seven standalone folding families, mesh unfolding, and panel construction across lid, divider-family, and joint-family combinations.
- Seeded `fast-check` properties verify canonical key ordering, sorted unique seams, stable feature ordering, deterministic repeated hashes, active/inactive dependencies, irrelevant material fields, and non-finite rejection. `fast-check` is development-only.
- State tests verify typed action history, undo/redo, inactive-mode preservation, active-only stale detection, and atomic panel-settings replacement.
- Worker tests cover captured-input race rejection; migration regeneration is compared against unchanged physical geometry.
- Panel feature records round-trip in v7; malformed structure fails before dispatch while geometrically invalid records remain serializable and produce targeted issues.
- Classroom registry tests cover all five deterministic factories, localized metadata, material recommendations, fixed-role stable feature IDs, one-action apply/undo/redo, edited-settings confirmation, inactive-mode preservation, and saved-project stability when registry defaults differ.

Wizard tests cover the complete Simple/Advanced workflow matrix, dynamic numbering, the panel-construction Configure preset menu, blocking-error Inspect insertion, mode-switch remapping, generation gates, and preservation of hidden Advanced values and placements. Browser coverage asserts the accessible preset menu in English/Hebrew and narrow RTL layouts, generation stays on Configure, previews can be regenerated without navigation, Simple reaches tight Output directly, the warning badge opens an accessible issue drawer, and Advanced retains the full Inspect/Arrange workflow.

Architecture-campaign Phase 4 tests freeze deterministic rectangular, fixed-segment circular, and engraved-label geometry; stable feature ordering; exact 2D/assembled holes; kerf direction; SVG/PDF metadata; no input mutation; no non-finite output across seeded randomized cases; and every structured target, dimension, containment, edge, joint, overlap, kerf, and label issue. Survey and flash-card recipe openings generate without blocking issues. The external-library spike and rejection are recorded in ADR 0022.

Architecture-campaign Phase 5 component tests cover add/select/edit/duplicate/delete, undo/redo, one-history-entry drag commits, keyboard modifiers, Hebrew RTL coordinate invariance, recipe feature editing, selected structured issues, and Standard/Advanced control visibility. Playwright exercises a labelled Sorting tray, a Survey/ballot box with keyboard-edited slot and label through SVG/project export and v7 re-import, and a resized Flash-card notch in both 2D and 3D.

Architecture-campaign Phase 6 tests cover canonical paired-connection ordering, mixed butt/finger families, one joint ID on both participating edges, per-connection clearance, and blocking inaccessible or incompatible settings. Arch, gable, and stepped fixtures preserve side endpoints and compare fabrication outlines directly with assembled vertices. Project tests cover old-v7 defaults, round trips, and rejection of unknown connection/profile discriminators. Component and Playwright coverage exercises the disclosure UI, Advanced clearance, lid/profile explanation, worker generation, and assembled preview.

Version 8 connection-editor tests cover panel crease components, folding cut splits, seam-to-crease rebuilding, deterministic editable-edge references, paired and free glue tabs, direct score metadata, cycle and overlap rejection, thickness mismatches, invalid ownership, canonical ordering, and v1-v8 migration. Component coverage verifies expandable Configure sections, compact keyboard selection, floating treatment and ownership actions, explicit stale-result regeneration, empty-space editor dismissal, selection retention, single-entry setting edits, and retained invalid edits. The panel-local editor tests live rectangle and circle dimensions, Shift-constrained drag movement, and the opening/label regeneration reminder. Playwright edits and re-imports a cardboard panel enclosure and a split folding template through the real worker, verifies persistent 3D treatment/tab badges, dismisses the edge editor through empty 3D space, verifies whole-document 2D zoom, and inspects exported cut and score layers. Finger-joint fixtures verify inner-footprint base/lid panels, outside-width front/back panels, full-span alternating plate/wall fingers, matched vertical receiver/tab relief, one-thickness side-finger corner extensions, non-self-intersecting outlines, and all individually creased shell edges.

Tight-layout fixtures verify deterministic 0°/90° placement, 3 mm separation, exact 5 mm wrapping bounds, and source/manual-layout immutability. SVG and PDF tests pass explicit Simple layouts to verify tight physical dimensions while retaining Advanced sheet dimensions. Localization coverage verifies every emitted validation/runtime code has English and Hebrew catalogue entries and that Hebrew never exposes raw exception text.

Phase 3 geometry tests slice a cube on all three axes, trace a faceted cylinder, classify a hollow-prism hole, and report open contours.

Phase 4 tests deterministic row and multi-sheet arrangement, rotate-then-translate placement semantics, boundary, overlap, and unplaced-part warnings, and byte-for-byte sheet SVG output with persisted rotation. Playwright exercises the real worker for cube slice generation, automatic placement, 2D selection, rotation, configurable sheet dimensions, multi-sheet overflow, active-sheet switching, and a sheet-specific vector SVG download.

Phase 5 geometry tests cover X/Y, X/Z, and Y/Z cube families, deterministic complementary slot counts, exact thickness-plus-clearance width, alternating and reversed directions, overlapping slot warnings, parallel-axis rejection, and manual review for hole-based slot entries. Component tests cover material-aware defaults and serializable waffle controls. Project and golden SVG tests round-trip and export open slot metadata. Playwright uses the real waffle worker to generate the built-in cube, verifies both 3D families and eight 2D slot paths, and inspects the downloaded active-sheet SVG.

## Phase 6 folding coverage

- X, Y, and Z convex-profile fixtures assert requested clearance around cube, cylinder, cone, asymmetric tetrahedron, and tapered prism projections.
- Every template family has deterministic topology tests covering panel/part counts, shared hinge endpoints, fold direction, stable pair labels, tab ownership and placement, assembled panels, and output hashing.
- Focused tests cover zero-area projections, visible enclosure-preserving simplification, incompatible short walls, pyramid/frustum variants, material warnings, project version migration, and operation-layered SVG metadata.
- Component tests cover conditional family controls and simultaneous source/fitted profile inspection.
- Playwright imports a real STL, selects and adjusts a template, generates through the real worker, verifies assembled and flat previews, and inspects the downloaded layered SVG.
- Custom-envelope fixtures cover all fitting axes, deterministic resolved dimensions, source-mesh immutability, and undersized rejection.

## Phase 7 output coverage

- Pure geometry tests verify half-kerf direction for outer and hole contours, source immutability, degenerate rejection, open-path notices, score conversion, deterministic perforation dashes, invalid pattern errors, material estimates, cut length, and registration marks.
- SVG tests verify prepared coordinates, editable operation styles, printable-label size, registration marks, preparation metadata, and stable operation groups.
- PDF tests verify deterministic bytes, physical page sizes, multiple page objects, vector content streams, labels, document metadata, and an explicit no-placement error.
- Project migration tests verify version 2 output settings acquire later defaults while new exports declare version 8.
- Component tests cover every output setting category and accessible operation colour/width labels.
- Playwright generates a folding net, previews material kerf and perforations, edits cut styling, shows registration marks, and inspects both downloaded SVG and PDF files.

## Phase 8 unfolding coverage

- Topology fixtures verify stable cube adjacency plus open and non-manifold rejection.
- Pure geometry tests cover deterministic cube and asymmetric tetrahedron nets, manual all-seam islands, explicit face limits, stable hashes, paired labels, tab counts, and preservation of every source triangle edge length.
- Kinematic tests exercise flat, half-folded, and folded states, asserting rigid triangle dimensions and coincident hinge endpoints at every progress value.
- Project-format tests round-trip the complete serializable result through version 4. SVG tests verify cut/fold groups, panel/edge/tab references, triangle and seam labels, and version metadata.
- Component tests cover bounded settings, manual seam editing, stale status, result summaries, and preview progress.
- Playwright imports a real tetrahedron through the worker, generates an automatic net, edits a manual seam, regenerates, moves between 3D and 2D, and inspects the downloaded layered SVG.

## Phase 9 panel-construction coverage

- Pure geometry tests cover deterministic butt and complementary finger output; explicit rejection of retired tab-slot generation; stable joint labels; odd matched segment counts; exact assembled outlines and holes; independent base/wall, divider, and lid thickness; internal divider bottom tabs, side fingers, receiver slots on both axes, simultaneous divider grids with complementary half-laps; optional lid topology; material warnings; and blocking dimension validation.
- Component tests cover inside dimensions, joint family, target pitch, slot clearance, lid and independent width/depth divider selection, and generated panel/joint/slot summaries.
- Project and SVG tests round-trip the version 5 construction result and verify panel, joint, hole, and label metadata.
- Playwright sets mixed panel/divider/lid stock through range controls, generates a divided finger-joint kit through the real worker, checks the assembled 3D legend and flat panel/slot paths, and inspects divider geometry in the downloaded layered SVG.

## Known build warnings

- The Three.js-enabled production chunk remains above Vite's 500 KB warning threshold. Bundle splitting remains a performance follow-up.
- React Three Fiber currently triggers Three.js's `Clock` deprecation warning in development. It originates in the current upstream rendering stack; recheck on dependency upgrades. No application console errors were observed.

## Architecture campaign bundle record

Raw and gzip byte counts were measured directly from the minified production assets. Phase 0 made no production changes. The Phase 2 delta includes Valibot plus the v7 validation and migration code; `fast-check` remained absent from production assets. Phase 3 adds only the localized recipe registry, workflow presentation, and settings-state integration; the geometry worker is unchanged. Phase 4 adds the pure feature predicates and generated cut/engrave metadata after rejecting `@flatten-js/core`; Phase 5 adds the focused bilingual composer while leaving worker geometry unchanged.

| Gate                     |  Main raw | Main gzip | Worker raw | Worker gzip |
| ------------------------ | --------: | --------: | ---------: | ----------: |
| Phase 0                  | 1,328,089 |   359,188 |     85,915 |      26,368 |
| Phase 1                  | 1,330,633 |   359,883 |     86,211 |      26,532 |
| Phase 2                  | 1,339,437 |   361,997 |     86,556 |      26,663 |
| Phase 3                  | 1,347,996 |   364,819 |     86,556 |      26,663 |
| Phase 4                  | 1,350,671 |   365,588 |     93,054 |      28,782 |
| Phase 5                  | 1,370,253 |   370,701 |     93,054 |      28,782 |
| Panel controls follow-up | 1,376,683 |   372,116 |     92,669 |      28,765 |
| Phase 6                  | 1,384,709 |   373,021 |     96,223 |      29,696 |
| Connection editor v8     | 1,411,687 |   381,318 |    116,939 |      35,677 |

Phase 1 changed main by +2,544 raw / +695 gzip and worker by +296 raw / +164 gzip. Phase 2 changed main by +8,804 raw / +2,114 gzip and worker by +345 raw / +131 gzip relative to Phase 1. Phase 3 changed main by +8,559 raw / +2,822 gzip and changed the worker by 0 bytes relative to Phase 2. Phase 4 changed main by +2,675 raw / +769 gzip and worker by +6,498 raw / +2,119 gzip. Phase 5 changed main by +19,582 raw / +5,113 gzip and changed the worker by 0 bytes relative to Phase 4.

The panel-controls follow-up changed main by +6,430 raw / +1,415 gzip and reduced the worker by 385 raw / 17 gzip relative to Phase 5. The worker reduction comes from removing through-slot generation; the main delta covers current-v7 compatibility, stock/cell controls, and localized migration feedback.

Phase 6 changed main by +8,026 raw / +905 gzip and worker by +3,554 raw / +931 gzip relative to the panel-controls follow-up. The delta covers paired-connection controls and validation plus deterministic bounded-profile geometry shared by fabrication and assembly previews.

The version 8 connection editor changed main by +26,978 raw / +8,297 gzip and worker by +20,716 raw / +5,981 gzip relative to Phase 6. The delta covers strict v8 migration, the anchored 3D editor, x-ray highlighting, treatment/tab markers, explicit stale-result regeneration, topology components, deterministic contour tracing, glue-tab geometry, extended side-finger corner geometry, and connection validation for panel construction and folding.
