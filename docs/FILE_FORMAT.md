# MocknSlice project file format

Project exports use formatted JSON with the suffix `.mocknslice.json`. Legacy `.slicefold.json` files remain import-compatible.

```json
{
  "format": "mocknslice-project",
  "version": 7,
  "project": {}
}
```

Version 8 stores project metadata, a serializable source model and transform, optional normalized mesh positions and triangle indices, centred bounds, model-health data, import settings, fabrication mode, complete typed settings for every mode, a material profile snapshot, generated parts, optional folding, mesh-unfold, or panel-construction result, canonical generation provenance, sheet layouts, export settings, and acknowledged warning IDs. Structured generation issues are persisted with the output.

Each Phase 4 sheet stores its millimetre width, height, safe margin, part spacing, and ordered placements. A placement references one part and stores `x`, `y`, and `rotationDeg`. The transform convention is rotate the part's 2D points around the part origin, then translate by `x` and `y`. Sheet and placement data were already required version 1 fields, so Phase 4 needs no schema migration.

Phase 5 waffle parts optionally store a family identifier and slot count. Slot cut paths remain ordinary fabrication paths with `operation: "cut"` and `closed: false`, plus serializable metadata for paired part ID, physical intersection axis, centre, width, depth, and start/end direction. These additions are optional version 1 fields, so older projects remain valid and no migration is required.

The importer parses untrusted JSON as `unknown`, validates a minimal envelope, dispatches by version, validates legacy structure, migrates versions 1–7, applies strict Valibot validation to version 8 settings, and then prepares runtime-only built-in geometry. Future schema versions must add an explicit migration branch rather than mutating old files silently.

Large embedded source models remain allowed by the domain. Phase 2 stores normalized geometry and the source filename rather than embedding the original STL bytes. IndexedDB persists the same project payload and a separate last-autosave project ID.

The Simple/Advanced experience preference is intentionally not serialized in project files. Simple tight output placements are ephemeral derived data; only Advanced manual `sheetLayouts` remain in `ProjectData`. Validation issues may include optional serializable `messageArgs` for localized interpolation; the existing English `message` fallback remains supported, so this additive field does not require a format bump.

Older built-in-cube projects are enriched in memory with deterministic primitive mesh data. SliceFold versions 1–5 and MocknSlice versions 6–7 remain import-compatible, but new exports always use MocknSlice version 8. Every migration starts with complete material/model-aware defaults and overlays known legacy fields, including sorted unique seam arrays and width/depth divider counts. V7 panel `{jointKind, clearanceMm}` overrides become treatment records; manual boundary tabs start empty and both manual tab depths start at 8 mm. Existing generated topology remains inspectable but is marked stale with an explicit regeneration notice.

Version 8 `modeSettings` contains `stackedSlices`, `waffleSlices`, `foldTemplate`, `meshUnfold`, and `panelConstruction`. Panel settings persist treatments for 12 shell/lid connection keys (`finger`, `butt`, or `crease`), optional finger clearance or butt-tab owner, stable free-boundary tabs, and one glue-tab depth. Folding overrides are keyed by template kind and stable generated connection ID, with `crease`/`cut` treatment, `none`/`glue-tab`/`press-fit` closure, and an explicit owner where applicable. Inactive-template records remain persisted but are excluded from the active canonical signature. Generated results may include deterministic assembled edge references for 3D hit-testing; current selection is never serialized.

Current panel settings also persist `panelThicknessMm`, `dividerThicknessMm`, and `lidThicknessMm`, each constrained to 1–10 mm. Older version-7 files without these fields receive clamped defaults from their material snapshot. The retired `tab-slot` setting is accepted for compatibility, converted to `finger`, and accompanied by a structured warning; current exports never emit `tab-slot` as the active panel setting.

Phase 6 adds optional `connectionOverrides` keyed by one of eight stable physical pairings (`base-front`, `base-back`, `base-left`, `base-right`, `front-left`, `front-right`, `back-left`, and `back-right`). Each record contains the shared butt/finger family and may contain a non-negative finger-joint `clearanceMm`; it never stores unrelated edge settings. `panelProfiles` contains complete `front` and `back` choices from `flat`, `arch`, `gable`, or `stepped`. Older version-7 files default to no overrides and two flat profiles. Raised profiles with a lid are structurally serializable but generation blocks them as geometrically incompatible.

Structurally valid features remain serializable even when geometry validation rejects them. Generation preserves those records and returns structured issues for missing targets, invalid dimensions, panel containment, edge or joint clearance, feature collisions, kerf-sensitive openings, and excessive label length. Rectangular and circular cutouts become closed hole paths; circles use a fixed 48-segment approximation. Engraved labels retain feature ID, size, and counter-clockwise rotation in generated parts and vector exports.

## Fabrication SVG

SVG export receives an explicit effective layout. Advanced exports one selected persisted sheet at its configured physical dimensions. Simple exports its derived single-sheet canvas whose width, height, and `viewBox` wrap the packed parts with a 5 mm margin. Both forms include project and sheet metadata, a group for every supported operation, stable path IDs, part IDs, contour roles, configured operation strokes, and optional engraved labels and boundary. Every path contains transformed numeric coordinates rather than an opaque SVG transform. Complex polygon nesting is not implied.

Waffle slot paths are emitted in the cut operation group without a closing `Z`. Their endpoints coincide with the outer contour, so the outer cut plus the three-sided slot path encloses removable slot waste without requiring SVG transforms or a polygon-boolean dependency.

Phase 7 SVG metadata includes project format version, applied kerf, and fold-line output. Optional registration crosses are emitted in the guide group. Printable part and panel labels use the configured physical font size.

## Folding data in version 2

Phase 6 shape-aware folding adds fit settings, projected/fitted profiles, panels, fold edges, tabs, assembled-preview panels, algorithm version, input hash, and generation issues. Fabrication paths may reference panel, edge, and tab IDs; fabrication parts may carry engraved/guide labels and folding topology metadata. This data shipped behind the explicit version 2 bump and is documented in [FOLDING_PLAN.md](FOLDING_PLAN.md).

## Fabrication output settings in version 3

Version 3 adds kerf mode and custom kerf, fold-line output mode, perforation dash/gap dimensions, and printable-label size. Existing operation styles and label, registration-mark, and boundary toggles remain in the same `exportSettings` object. Prepared paths are not persisted: they are deterministically derived from generated parts, the material snapshot, and these settings.

## Mesh-unfold data in version 4

Version 4 adds optional automatic/manual settings, stable edge keys, flat and source triangle coordinates, seam and hinge definitions, islands, overlap pairs, tabs, generated parts, algorithm version, and input hash. Fabrication parts can reference their island and face IDs. All arrays are plain serializable data; the 3D fold-preview vertices are derived and are not persisted.

## Panel-construction data in version 5

Version 5 adds optional inside dimensions, joint settings, material inputs, exact panel outlines, paired joint definitions, generated parts, nominal assembled surfaces, issues, algorithm version, and input hash. Construction parts reference their panel role and stable joint IDs. The result remains inspectable without rerunning the worker.

## Assembly PDF

The PDF exporter writes one vector page for each sheet containing placements. Each page uses the configured millimetre dimensions converted to PDF points, prepared operation paths and styles, registration marks, printable labels, sheet identity, and a text operation legend. No raster preview or canvas snapshot is embedded.
