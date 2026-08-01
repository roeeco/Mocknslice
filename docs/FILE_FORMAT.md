# SliceFold project file format

Project exports use formatted JSON with the suffix `.slicefold.json`.

```json
{
  "format": "slicefold-project",
  "version": 1,
  "project": {}
}
```

Version 1 stores project metadata, a serializable source model and transform, fabrication mode and parameters, a material profile snapshot, generated parts, sheet layouts, export settings, and acknowledged warning IDs.

The importer parses untrusted JSON as `unknown`, verifies the format and supported version, validates required project structure, and returns understandable errors. Future schema versions must add an explicit migration branch rather than mutating old files silently.

Large embedded source models are allowed by the domain but are not yet imported in Phase 1. IndexedDB persists the same project payload and a separate last-autosave project ID.
