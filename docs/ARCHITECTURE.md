# SliceFold architecture

## Layer boundaries

### Domain

`src/domain/` contains serializable TypeScript types for projects, models, materials, fabrication parts, sheet layouts, operations, exports, and validation. It imports neither React nor Three.js. Fabrication dimensions have `Mm` names or use the `Millimetres` alias.

### Geometry engine

Future code under `src/geometry/` will expose pure functions for normalization, intersection, contour reconstruction, offsets, slices, slots, folding, and layout. Functions must run in unit tests without a browser. Expensive orchestration will use typed messages under `src/workers/` while calling the same pure functions.

No production geometry engine is implemented in Phase 1.

### Application state

`src/state/` composes separate Zustand slices for project lifecycle, model inspection, fabrication settings, viewport state, selection, material library, history, export settings, and validation. Persistent state contains plain data only. Project-changing actions record undo history and mark autosave pending; camera and viewport changes do not enter history.

### Presentation

`src/app/`, `src/components/`, and `src/viewports/` implement the shell and views. Three.js objects are created inside the 3D presentation boundary from serializable model dimensions. Selection is synchronized through domain IDs.

### Persistence and file exchange

`src/persistence/` defines a repository interface and IndexedDB implementation. `src/exporters/` owns versioned project serialization, validation, and migration entry points. The browser stores named project data and the last autosave pointer in separate object stores.

## Data flow

User input updates a focused Zustand action. Meaningful project actions record a previous project snapshot, update the serializable project, and schedule repository autosave. Presentation selectors reconstruct view data. Project JSON export serializes the same project data; import validates and replaces it through history.

## Dependency rules

- Domain code may not import React, browser APIs, Zustand, or Three.js.
- Geometry may import domain types but not state or presentation code.
- Persistence works through `ProjectRepository` so a future storage adapter does not affect UI code.
- Optional polygon or solid geometry libraries require a browser spike and ADR before adoption.
