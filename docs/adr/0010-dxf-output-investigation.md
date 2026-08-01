# ADR 0010: Defer production DXF export pending round-trip fixtures

- Status: Accepted
- Date: 2026-08-01

## Context

Phase 7 calls for a DXF investigation. A useful fabrication DXF must preserve millimetre units, open versus closed paths, operation layers, stable identities, labels, and compatibility with LightBurn and common CAD importers. Merely emitting syntactically plausible entities would create an unreliable production control.

## Investigation result

An ASCII DXF profile based on `HEADER` units, named `LAYER` records, `LWPOLYLINE`/`LINE` entities, and optional `TEXT` entities can represent SliceFold's current 2D domain without a geometry dependency. The unresolved risk is importer behaviour: unit handling, colour/layer mapping, polyline closure, text scale, and duplicate-vertex tolerance differ across target applications.

## Decision

Do not expose a DXF button in Phase 7. First add canonical DXF fixtures and verify round trips through at least LightBurn plus an independent parser or CAD importer. The spike must confirm physical dimensions, layer names, closed flags, open slot paths, and labels before production export is enabled.

SVG remains the cutter-oriented production format. Vector PDF is the printable assembly-sheet format. No DXF library is adopted at this stage.

## Consequences

- The interface contains no placeholder control that implies unverified DXF support.
- The domain and prepared-output layer are ready to feed a later DXF serializer.
- Phase 7's DXF investigation is complete, while production DXF remains a bounded follow-up rather than part of advanced unfolding.
