# SliceFold architecture

## Layer boundaries

### Domain

`src/domain/` contains serializable TypeScript types for projects, models, materials, fabrication parts, sheet layouts, operations, exports, validation, projected profiles, fold panels, fold edges, tabs, mesh-unfold faces, seams, hinges, islands, overlaps, and assembled-preview data. The domain imports neither React nor Three.js. Fabrication dimensions have `Mm` names or use the `Millimetres` alias.

### Geometry engine

`src/geometry/` exposes pure functions for mesh normalization, topology validation, model transforms, plane placement, triangle-plane intersection, endpoint welding, contour tracing, outer/hole classification, stacked and orthogonal waffle generation, slot construction, convex profile fitting, folding-template generation, part transforms, deterministic row layout, sheet validation, and fabrication-output preparation. Functions run in unit tests without a browser. Expensive orchestration uses typed messages under `src/workers/` while calling the same pure functions; inexpensive sheet arrangement and output preparation remain synchronous.

Phase 6 shape fitting implements deterministic axis projection, convex hull, convex offset, visible enclosure-preserving simplification, and fixed-topology template generators. These functions return serializable source/fitted profiles, panels, fold edges, tabs, fabrication parts, assembled panel data, and structured issues. The worker orchestrates fitting and generation with cancellation, input hashes, and stale-result rejection.

Phase 8 topology and unfolding remain pure geometry. The engine builds indexed triangle adjacency, rejects unsupported topology, derives a deterministic acyclic hinge forest, flattens rigid triangles, scores face overlaps, adds paired seams and tabs, and returns a stable hash. The fold-preview helper derives animated vertices without mutating the stored result.

Phase 9 panel construction is another pure generator. It converts inside dimensions, a material snapshot, joint family, target pitch, clearance, and lid choice into serializable panel outlines, slot holes, paired joints, labels, nominal assembled surfaces, issues, and an input hash. It adds no polygon or solid dependency.

STL parsing/normalization, stacked-slice generation, two-family waffle generation, folding-template generation, low-poly mesh unfolding, and panel construction run as cancellable Web Worker requests. The worker returns plain serializable geometry and validation data; it does not return Three.js objects.

### Application state

`src/state/` composes separate Zustand slices for project lifecycle, model import and inspection, fabrication settings, sheet layout, viewport state, selection, material library, history, export settings, and validation. Persistent state contains plain data only. Imported mesh positions and indices are plain arrays. Project-changing actions record undo history and mark autosave pending; camera, active-sheet selection, and viewport changes do not enter history. A pointer drag previews locally and commits one placement change when released.

### Presentation

`src/app/`, `src/components/`, and `src/viewports/` implement the shell and views. Three.js buffer and extruded part geometry is recreated and disposed inside the 3D presentation boundary from serializable mesh and contour data. The 2D preview renders the same paths as SVG. Selection is synchronized through domain IDs. A viewport error boundary prevents a rendering failure from removing project and inspection controls.

### Persistence and file exchange

`src/persistence/` defines a repository interface and IndexedDB implementation. `src/exporters/` owns versioned project serialization, validation, and migration entry points. The browser stores named project data and the last autosave pointer in separate object stores.

Phase 7 derives prepared parts at export/preview time from generated parts plus serializable output settings. Kerf offsets and fold-line conversion never replace generated source geometry. The 2D viewport, SVG exporter, and PDF exporter call the same pure preparation function. PDF objects and content streams are emitted directly as deterministic vector data; no canvas capture or raster content is used. Project version 5 adds the optional Phase 9 construction result while versions 1–4 migrate through the same validation boundary.

## Data flow

User input updates a focused Zustand action. Meaningful project actions record a previous project snapshot, update the serializable project, and schedule repository autosave. Parameter, material, mode, or model changes preserve generated geometry but mark it stale. Stacked, waffle, template, mesh-unfold, and panel construction generation create a deterministic initial layout from the first sheet's settings. Presentation selectors reconstruct transformed geometry from persisted placements, assembled panels, or unfolded triangle hinges. Project JSON export serializes the same project data; import validates and replaces it through history. Fabrication SVG exports the active sheet and PDF exports all used sheets using those same numeric transforms and prepared paths.

## Dependency rules

- Domain code may not import React, browser APIs, Zustand, or Three.js.
- Geometry may import domain types but not state or presentation code.
- Persistence works through `ProjectRepository` so a future storage adapter does not affect UI code.
- Optional polygon or solid geometry libraries require a browser spike and ADR before adoption.
