# Testing SliceFold

## Commands

- `npm run typecheck` — strict application and configuration TypeScript checks.
- `npm run lint` — typed ESLint checks with zero warnings.
- `npm run format:check` — Prettier verification.
- `npm test` — Vitest unit and React Testing Library component tests.
- `npm run test:e2e` — Playwright Chromium smoke tests against the Vite development server.
- `npm run build` — TypeScript project build and production Vite bundle.

## Coverage through Phase 4

Tests verify default material profiles and snapshot isolation, versioned project JSON round-trips and rejection paths, IndexedDB save/list/restore/delete behaviour, parameter panel state changes and undo, ASCII and binary STL parsing, cube normalization, unit conversion, degenerate-triangle reporting, open/non-manifold/disconnected topology, scaling, orientation, and model inspection controls.

Phase 3 geometry tests slice a cube on all three axes, trace a faceted cylinder, classify a hollow-prism hole, and report open contours.

Phase 4 tests deterministic row and multi-sheet arrangement, rotate-then-translate placement semantics, boundary, overlap, and unplaced-part warnings, and byte-for-byte sheet SVG output with persisted rotation. Playwright exercises the real worker for cube slice generation, automatic placement, 2D selection, rotation, configurable sheet dimensions, multi-sheet overflow, active-sheet switching, and a sheet-specific vector SVG download.

## Planned Phase 6 folding coverage

- Assert that X, Y, and Z convex profiles enclose every projected point plus clearance for cube, cylinder, cone, asymmetric, and tapered fixtures.
- Golden-test every template family for deterministic panel outlines, shared-edge lengths, fold direction, tab placement, paired labels, and operation-layered SVG.
- Cover zero-area projections, failed offsets, visible simplification, excessive profile complexity, narrow material features, incompatible templates, tab overlap, net overlap, and off-sheet parts.
- Test worker progress, cancellation, stale-result rejection, project round trips, and undo/redo for fit settings and generated nets.
- Use Playwright for the complete import, template selection, clearance, generation, assembled/flat preview, arrangement, and export path.

## Known Phase 1 baselines

- The Three.js-enabled production chunk is about 1.16 MB minified (321 KB gzip). Bundle splitting remains a performance follow-up; Vite reports the expected large-chunk warning.
- React Three Fiber currently triggers Three.js's `Clock` deprecation warning in development. It originates in the current upstream rendering stack; recheck on dependency upgrades. No application console errors were observed.
