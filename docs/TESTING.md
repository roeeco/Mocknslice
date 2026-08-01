# Testing SliceFold

## Commands

- `npm run typecheck` — strict application and configuration TypeScript checks.
- `npm run lint` — typed ESLint checks with zero warnings.
- `npm run format:check` — Prettier verification.
- `npm test` — Vitest unit and React Testing Library component tests.
- `npm run test:e2e` — Playwright Chromium smoke tests against the Vite development server.
- `npm run build` — TypeScript project build and production Vite bundle.

## Coverage through Phase 9

Tests verify default material profiles and snapshot isolation, versioned project JSON round-trips and rejection paths, IndexedDB save/list/restore/delete behaviour, parameter panel state changes and undo, ASCII and binary STL parsing, cube normalization, unit conversion, degenerate-triangle reporting, open/non-manifold/disconnected topology, scaling, orientation, and model inspection controls.

Wizard component tests verify contextual mounting, linear advancement, completed-step revisiting, and blocking validation. Browser coverage asserts the live 3D canvas does not enter a React external-store update loop, exercises generated previews, and checks that compact controls precede the preview at the 720 px breakpoint.

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
- Project migration tests verify version 2 output settings acquire version 3 defaults while new exports declare version 5.
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

- Pure geometry tests cover deterministic butt, complementary finger, and tab-slot output; stable joint labels; odd matched segment counts; exact assembled outlines and holes; internal divider bottom tabs, side fingers, and receiver slots on both axes; optional lid topology; material warnings; and blocking dimension validation.
- Component tests cover inside dimensions, joint family, target pitch, slot clearance, lid and divider selection, and generated panel/joint/slot summaries.
- Project and SVG tests round-trip the version 5 construction result and verify panel, joint, hole, and label metadata.
- Playwright selects plywood, generates a divided tab-slot kit through the real worker, checks the assembled 3D legend and flat panel/slot paths, and inspects divider geometry in the downloaded layered SVG.

## Known Phase 1 baselines

- The Three.js-enabled production chunk is about 1.16 MB minified (321 KB gzip). Bundle splitting remains a performance follow-up; Vite reports the expected large-chunk warning.
- React Three Fiber currently triggers Three.js's `Clock` deprecation warning in development. It originates in the current upstream rendering stack; recheck on dependency upgrades. No application console errors were observed.
