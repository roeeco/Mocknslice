# SliceFold engineering guardrails

## Phase order

0. Repository reconnaissance
1. Foundation
2. STL import and inspection
3. Stacked-slice MVP
4. Sheet layout
5. Orthogonal waffle mode
6. Shape-aware deterministic folding templates fitted to convex STL projections
7. Improved fabrication output
8. Manual and automatic mesh unfolding with editable seams and deterministic optimization
9. Advanced features

Finish each phase with passing typecheck, lint, unit tests, production build, relevant end-to-end smoke tests, current documentation, deterministic geometry tests where applicable, and a built-in demonstration path.

## Architecture invariants

- Domain: serializable fabrication concepts; no React or rendering imports.
- Geometry: pure functions with explicit units; callable without a browser.
- State: separated concerns, command-based meaningful history, no Three.js objects in persistence.
- Presentation: shell, workflow, panels, dialogs, synchronized 3D and 2D views joined by domain IDs.
- Persistence: local-first repository interface, IndexedDB implementation, versioned project JSON and migrations.
- Validation: structured issues with severity, code, affected IDs, and optional suggested action.
- Export: deterministic millimetre geometry, stable IDs, operation groups, and explicit warnings.

## Product boundaries

- Browser-first, local-first, and no backend or login for the MVP.
- Make the working name `SliceFold` replaceable through centralized strings.
- Do not silently repair geometry or present nonfunctional placeholder controls as working.
- Prioritize predictable fabrication output and understandable warnings over CAD breadth.
- Keep optional geometry libraries behind documented technical spikes and ADRs.
