# SliceFold project file format

Project exports use formatted JSON with the suffix `.slicefold.json`.

```json
{
  "format": "slicefold-project",
  "version": 1,
  "project": {}
}
```

Version 1 stores project metadata, a serializable source model and transform, optional normalized mesh positions and triangle indices, centred bounds, model-health data, import settings, fabrication mode and parameters, a material profile snapshot, generated parts, sheet layouts, export settings, and acknowledged warning IDs.

The importer parses untrusted JSON as `unknown`, verifies the format and supported version, validates required project structure, and returns understandable errors. Future schema versions must add an explicit migration branch rather than mutating old files silently.

Large embedded source models remain allowed by the domain. Phase 2 stores normalized geometry and the source filename rather than embedding the original STL bytes. IndexedDB persists the same project payload and a separate last-autosave project ID.
