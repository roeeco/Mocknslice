# Testing SliceFold

## Commands

- `npm run typecheck` — strict application and configuration TypeScript checks.
- `npm run lint` — typed ESLint checks with zero warnings.
- `npm run format:check` — Prettier verification.
- `npm test` — Vitest unit and React Testing Library component tests.
- `npm run test:e2e` — Playwright Chromium smoke tests against the Vite development server.
- `npm run build` — TypeScript project build and production Vite bundle.

## Coverage through Phase 6

Tests verify default material profiles and snapshot isolation, versioned project JSON round-trips and rejection paths, IndexedDB save/list/restore/delete behaviour, parameter panel state changes and undo, ASCII and binary STL parsing, cube normalization, unit conversion, degenerate-triangle reporting, open/non-manifold/disconnected topology, scaling, orientation, and model inspection controls.

Phase 3 geometry tests slice a cube on all three axes, trace a faceted cylinder, classify a hollow-prism hole, and report open contours.

Phase 4 tests deterministic row and multi-sheet arrangement, rotate-then-translate placement semantics, boundary, overlap, and unplaced-part warnings, and byte-for-byte sheet SVG output with persisted rotation. Playwright exercises the real worker for cube slice generation, automatic placement, 2D selection, rotation, configurable sheet dimensions, multi-sheet overflow, active-sheet switching, and a sheet-specific vector SVG download.

Phase 5 geometry tests cover X/Y, X/Z, and Y/Z cube families, deterministic complementary slot counts, exact thickness-plus-clearance width, alternating and reversed directions, overlapping slot warnings, parallel-axis rejection, and manual review for hole-based slot entries. Component tests cover material-aware defaults and serializable waffle controls. Project and golden SVG tests round-trip and export open slot metadata. Playwright uses the real waffle worker to generate the built-in cube, verifies both 3D families and eight 2D slot paths, and inspects the downloaded active-sheet SVG.

## Phase 6 folding coverage

- X, Y, and Z convex-profile fixtures assert requested clearance around cube, cylinder, cone, asymmetric tetrahedron, and tapered prism projections.
- Every template family has deterministic topology tests covering panel/part counts, shared hinge endpoints, fold direction, stable pair labels, tab ownership and placement, assembled panels, and output hashing.
- Focused tests cover zero-area projections, visible enclosure-preserving simplification, incompatible short walls, pyramid/frustum variants, material warnings, project version migration, and operation-layered SVG metadata.
- Component tests cover conditional family controls and simultaneous source/fitted profile inspection.
- Playwright imports a real STL, selects and adjusts a template, generates through the real worker, verifies assembled and flat previews, and inspects the downloaded layered SVG.

## Known Phase 1 baselines

- The Three.js-enabled production chunk is about 1.16 MB minified (321 KB gzip). Bundle splitting remains a performance follow-up; Vite reports the expected large-chunk warning.
- React Three Fiber currently triggers Three.js's `Clock` deprecation warning in development. It originates in the current upstream rendering stack; recheck on dependency upgrades. No application console errors were observed.
