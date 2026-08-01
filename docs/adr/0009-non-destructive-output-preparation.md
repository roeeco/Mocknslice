# ADR 0009: Prepare fabrication output without mutating generated geometry

- Status: Accepted
- Date: 2026-08-01

## Context

Kerf, cutter-specific fold-line treatment, registration marks, printable labels, and visual operation styles affect production output but do not redefine the source slices, slots, panels, or tabs. Baking those choices into generated parts would make regeneration and undo ambiguous and could cause repeated kerf offsets.

## Decision

Persist Phase 7 output settings in project version 3 and derive prepared fabrication parts through a pure function. The 2D sheet viewport, structured validation, material estimate, SVG exporter, and PDF exporter consume this same derivative.

Closed cut polygons may receive a deterministic mitered half-kerf offset. Outer contours move outward and holes inward. The implementation validates its result and preserves the original with a structured error when it cannot guarantee a simple contour. Open cut paths remain unchanged with a visible notice. Mountain/valley fold paths may remain distinct, become score paths, or become explicit dash segments on the perforation layer.

## Consequences

- Generated parts remain reproducible from model and fabrication settings.
- Output changes participate in history/autosave without making slice or template results stale.
- All vector previews and downloads share identical prepared coordinates.
- Complex offset topology changes remain unsupported until a polygon-library spike is accepted.
- Version 3 is required because output preparation settings must round-trip predictably.
