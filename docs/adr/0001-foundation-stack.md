# ADR 0001: Phase 1 browser foundation

- Status: Accepted
- Date: 2026-08-01

## Decision

Use React 19, strict TypeScript 6, Vite 8, Three.js through React Three Fiber and Drei, Zustand, and `idb`. Use Vitest with React Testing Library for unit/component tests and Playwright for browser smoke tests.

TypeScript is pinned to the newest 6.x line because the current TypeScript 7 release is outside the supported range of the current typed ESLint toolchain. This preserves typed linting without an unsafe peer-dependency override.

## Consequences

The app stays static-hostable and local-first. Domain and future geometry functions remain testable outside React. IndexedDB is isolated behind a repository interface. Dependency versions are locked by `package-lock.json`.
