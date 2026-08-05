# ADR 0019: Store panel features in panel-local coordinates

## Status

Accepted

## Context

Openings and labels must remain attached to a panel when sheet placement, enclosure dimensions, or assembly transforms change.

## Decision

Features target one fixed enclosure role: `base`, `front`, `back`, `left`, `right`, or `lid`. Numbered dividers are excluded initially. Position uses a normalized panel-local anchor where `u` runs left-to-right and `v` runs bottom-to-top, plus optional millimetre offsets. Rotation is counter-clockwise in the same x-right/y-up frame.

Invalid positions are preserved and reported; generation never silently clamps, moves, or deletes a feature.

## Consequences

The same serializable feature resolves predictably into fabrication paths and assembled-preview holes without depending on material-sheet placement.
