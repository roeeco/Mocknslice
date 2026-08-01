# SliceFold architecture

## Layer boundaries

### Domain

`src/domain/` contains serializable TypeScript types for projects, models, materials, fabrication parts, sheet layouts, operations, exports, and validation. Planned folding types add projected profiles, panels, fold edges, and tabs without render objects. The domain imports neither React nor Three.js. Fabrication dimensions have `Mm` names or use the `Millimetres` alias.

### Geometry engine

`src/geometry/` exposes pure functions for mesh normalization, topology validation, model transforms, plane placement, triangle-plane intersection, endpoint welding, contour tracing, outer/hole classification, stacked and orthogonal waffle generation, slot construction, part transforms, deterministic row layout, and sheet validation. Future modules add offsets and folding. Functions run in unit tests without a browser. Expensive orchestration uses typed messages under `src/workers/` while calling the same pure functions; inexpensive sheet arrangement remains synchronous.

Phase 6 shape fitting will add deterministic axis projection, convex hull, convex offset, visible simplification, and template generators. These functions return serializable source/fitted profiles, panels, fold edges, tabs, fabrication parts, and structured issues. The worker will orchestrate fitting and generation with progress, cancellation, input hashes, and stale-result rejection.

STL parsing/normalization, stacked-slice generation, and two-family waffle generation run as cancellable Web Worker requests. The worker returns plain serializable mesh, bounds, health data, parts, slot metadata, and validation issues; it does not return Three.js objects.

### Application state

`src/state/` composes separate Zustand slices for project lifecycle, model import and inspection, fabrication settings, sheet layout, viewport state, selection, material library, history, export settings, and validation. Persistent state contains plain data only. Imported mesh positions and indices are plain arrays. Project-changing actions record undo history and mark autosave pending; camera, active-sheet selection, and viewport changes do not enter history. A pointer drag previews locally and commits one placement change when released.

### Presentation

`src/app/`, `src/components/`, and `src/viewports/` implement the shell and views. Three.js buffer and extruded part geometry is recreated and disposed inside the 3D presentation boundary from serializable mesh and contour data. The 2D preview renders the same paths as SVG. Selection is synchronized through domain IDs. A viewport error boundary prevents a rendering failure from removing project and inspection controls.

### Persistence and file exchange

`src/persistence/` defines a repository interface and IndexedDB implementation. `src/exporters/` owns versioned project serialization, validation, and migration entry points. The browser stores named project data and the last autosave pointer in separate object stores.

## Data flow

User input updates a focused Zustand action. Meaningful project actions record a previous project snapshot, update the serializable project, and schedule repository autosave. Parameter, material, mode, or model changes preserve generated geometry but mark it stale. Stacked or waffle generation creates a deterministic initial layout from the first sheet's settings. Presentation selectors reconstruct transformed geometry from persisted placements. Project JSON export serializes the same project data; import validates and replaces it through history. Fabrication SVG exports only the active sheet using those same numeric transforms.

## Dependency rules

- Domain code may not import React, browser APIs, Zustand, or Three.js.
- Geometry may import domain types but not state or presentation code.
- Persistence works through `ProjectRepository` so a future storage adapter does not affect UI code.
- Optional polygon or solid geometry libraries require a browser spike and ADR before adoption.
