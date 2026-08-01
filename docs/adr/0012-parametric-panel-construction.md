# ADR 0012: Parametric rectangular panel construction

## Status

Accepted

## Context

Phase 9 lists several unrelated advanced directions. `panel-construction` already exists as a fabrication mode and is the clearest path to a complete fabrication workflow using the established material, layout, preview, validation, and export architecture. A general panel CAD system or polygon-boolean dependency would be much larger and would not be justified by the first enclosure use case.

## Decision

Implement a bounded pure generator for rectangular five- or six-panel enclosure kits. Support straight butt joints, complementary odd-pitch fingers, and tab/through-slot joints. Derive joint depth from the material snapshot, keep slot clearance explicit, emit stable paired IDs and labels, and return nominal assembled surfaces plus exact flat fabrication paths.

Run generation through the existing cancellable worker and stale-result boundary. Persist the complete result in project version 5. Reuse existing layout, output preparation, SVG, PDF, validation, and selection contracts. Add no new runtime dependency.

## Consequences

- Phase 9 gains a complete demonstrable feature without turning SliceFold into a general CAD tool.
- Exact panel and slot geometry is deterministic and testable outside React.
- The nominal 3D preview does not show stepped fingers or insertion mechanics; the interface and issues must say so.
- Fully jointed lids may require an impractical assembly order and therefore receive a warning.
- More advanced joints and non-rectangular panels remain future generators behind the same serializable result boundary.
