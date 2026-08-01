# Testing SliceFold

## Commands

- `npm run typecheck` — strict application and configuration TypeScript checks.
- `npm run lint` — typed ESLint checks with zero warnings.
- `npm run format:check` — Prettier verification.
- `npm test` — Vitest unit and React Testing Library component tests.
- `npm run test:e2e` — Playwright Chromium smoke tests against the Vite development server.
- `npm run build` — TypeScript project build and production Vite bundle.

## Coverage through Phase 3

Tests verify default material profiles and snapshot isolation, versioned project JSON round-trips and rejection paths, IndexedDB save/list/restore/delete behaviour, parameter panel state changes and undo, ASCII and binary STL parsing, cube normalization, unit conversion, degenerate-triangle reporting, open/non-manifold/disconnected topology, scaling, orientation, and model inspection controls.

Phase 3 geometry tests slice a cube on all three axes, trace a faceted cylinder, classify a hollow-prism hole, and report open contours. SVG output is compared byte-for-byte with a checked-in golden file. Playwright exercises the real worker for STL import and cube slice generation, 2D selection, and an SVG download whose units, operation group, contour role, and vector-only content are asserted.

## Known Phase 1 baselines

- The Three.js-enabled production chunk is about 1.16 MB minified (321 KB gzip). Bundle splitting remains a performance follow-up; Vite reports the expected large-chunk warning.
- React Three Fiber currently triggers Three.js's `Clock` deprecation warning in development. It originates in the current upstream rendering stack; recheck on dependency upgrades. No application console errors were observed.
