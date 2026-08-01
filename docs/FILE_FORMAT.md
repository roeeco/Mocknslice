# SliceFold project file format

Project exports use formatted JSON with the suffix `.slicefold.json`.

```json
{
  "format": "slicefold-project",
  "version": 1,
  "project": {}
}
```

Version 1 stores project metadata, a serializable source model and transform, optional normalized mesh positions and triangle indices, centred bounds, model-health data, import settings, fabrication mode and parameters, a material profile snapshot, generated parts, sheet layouts, export settings, and acknowledged warning IDs. Phase 3 parts may include an outer/hole role per path plus slice axis, plane index, and millimetre position. Structured generation issues are persisted with the output.

The importer parses untrusted JSON as `unknown`, verifies the format and supported version, validates required project structure, and returns understandable errors. Future schema versions must add an explicit migration branch rather than mutating old files silently.

Large embedded source models remain allowed by the domain. Phase 2 stores normalized geometry and the source filename rather than embedding the original STL bytes. IndexedDB persists the same project payload and a separate last-autosave project ID.

Older version 1 built-in-cube projects are enriched in memory with deterministic primitive mesh data and Phase 3 parameter defaults. Optional Phase 3 fields remain backward compatible within version 1.

## Fabrication SVG

Phase 3 exports a standalone, vector-only SVG with millimetre `width` and `height`, a matching `viewBox`, project metadata, a group for every supported operation, stable path IDs, part IDs, contour roles, configured operation strokes, and optional engraved labels and boundary. Parts use a deterministic row preview with 5 mm margins and gaps. Proper sheet placement and nesting belong to Phase 4.
