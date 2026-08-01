# Testing SliceFold

## Commands

- `npm run typecheck` — strict application and configuration TypeScript checks.
- `npm run lint` — typed ESLint checks with zero warnings.
- `npm run format:check` — Prettier verification.
- `npm test` — Vitest unit and React Testing Library component tests.
- `npm run test:e2e` — Playwright Chromium smoke tests against the Vite development server.
- `npm run build` — TypeScript project build and production Vite bundle.

## Phase 1 coverage

Tests verify default material profiles and snapshot isolation, versioned project JSON round-trips and rejection paths, IndexedDB save/list/restore/delete behaviour, parameter panel state changes and undo, and browser smoke flows for the shell, project editing, and 2D sheet view.

Future geometry tests must use deterministic generated fixtures and assert contour closure, dimensions, hole classification, offset direction, slot width, and operation-layered export output.

## Known Phase 1 baselines

- The initial Three.js-enabled production chunk is about 1.13 MB minified (312 KB gzip). Split the 3D viewport bundle before the first public MVP and track the result in a performance fixture.
- React Three Fiber currently triggers Three.js's `Clock` deprecation warning in development. It originates in the current upstream rendering stack; recheck on dependency upgrades. No application console errors were observed.
