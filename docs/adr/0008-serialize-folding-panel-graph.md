# ADR 0008: Serialize the folding panel graph in project version 2

- Status: Accepted
- Date: 2026-08-01

## Context

The assembled 3D construction, flat fabrication net, selection model, regeneration checks, and SVG labels must refer to the same panels, hinges, seams, and tabs. Reconstructing those relationships from cut paths would be ambiguous and would make saved projects dependent on presentation code.

## Decision

Persist the complete pure `TemplateGenerationResult`: fit settings, source and fitted profiles, panels, edge definitions, tabs, fabrication parts, assembled-preview panel vertices, structured issues, algorithm version, and deterministic input hash. Fabrication paths and labels carry optional stable panel, edge, and tab references.

This schema was introduced in SliceFold project version 2. The importer keeps explicit legacy branches, validates all optional folding structures as untrusted input, and returns the current `ProjectData` shape. Version 3 retains the graph unchanged while adding fabrication-output settings. Three.js geometry is never persisted; the viewport recreates disposable buffer geometry from assembled panel vertices.

## Consequences

- 2D, 3D, project JSON, undo/autosave, and SVG share stable domain identities.
- A saved folding result remains inspectable without rerunning the geometry worker.
- Project files are larger, especially for profiles with many panels, but remain plain local JSON.
- Any incompatible future folding schema requires another explicit version and migration branch.
