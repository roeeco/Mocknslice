# ADR 0005: Fit deterministic templates to convex model profiles

- Status: Accepted
- Date: 2026-08-01

## Context

Papercraft tools often turn mesh faces directly into editable nets. That workflow requires seam selection, graph unfolding, overlap search, texture handling, and extensive manual repair. SliceFold needs a simpler path for makers who want a predictable folding construction around an imported object.

## Decision

Phase 6 will fit known parametric templates to a convex orthographic profile of the normalized STL. The user chooses the fitting axis, clearance, and template. The engine projects model vertices, builds and visibly simplifies a deterministic convex hull, offsets it by clearance, and passes that profile to a pure template generator.

Rectangular box families use profile extents. Sleeves, envelopes, regular prisms, and tapered forms may follow a simplified convex profile where their fixed construction topology remains physically valid. Every result contains serializable panels, fold edges, glue tabs, fabrication paths, validation issues, an algorithm version, and an input hash.

The first folding release prioritizes cut, score, fold, tab, and label output. It will not perform generic face unfolding or add editable seams, PDO import, textures, or raster print-and-cut.

## Consequences

- Generation is deterministic, testable, worker-compatible, and understandable to non-CAD users.
- Convex fitting cannot follow deep concavities or internal holes and may use more material than a custom shell.
- Automated simplification must be shown in the preview and reported as structured validation data.
- Phase 4 sheet layout must support irregular nets, operation layers, labels, and stable transforms before Phase 6 begins.
- Advanced mesh unfolding remains a separate, unscheduled research direction and cannot silently expand Phase 6 scope.
