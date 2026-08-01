# ADR 0014: Unified folding path and physical closure geometry

- Status: Accepted
- Date: 2026-08-01

## Context

The wizard exposed parametric folding templates from unrelated slicing modes, while the template generator still fitted those templates to the current model. Folding tabs used an unconstrained requested depth and did not identify a receiving face, so some nets contained oversized tabs or no manufacturable mating feature. Panel-construction previews used nominal rectangles and could not show their generated fingers, slots, or internal subdivisions.

## Decision

- Present folding templates and low-poly mesh unfolding as one **Folding and unfolding** mode family. Importing an STL selects mesh unfolding; creating a template selects standalone parametric folding. Stacked and waffle modes require an imported STL, and panel construction remains model-free.
- Generate standalone templates from explicit width, length, and height. Their deterministic hash excludes the unrelated project mesh.
- Limit every folding tab to `min(requested depth, 35% of its base edge, 15 mm)` and emit `TAB_DEPTH_CLAMPED` when adjusted.
- Support glue and press-fit closures. A press-fit tab stores its receiving panel and deterministic slit endpoints; both appear in the fabrication paths and exported operation layers.
- Generate solid panel-construction previews from the exact stepped outlines and slot holes. Optional internal dividers use two material-thickness bottom tabs, alternating side fingers, and matching clearance-adjusted slots in the base and both enclosure walls.

## Consequences

The UI no longer implies that a predefined template conforms to an STL. Existing project fields remain additive and backward-compatible, while folding and panel algorithm versions advance. Press-fit geometry is deterministic but still requires a physical scrap test because material compression, grain, and cutter calibration are outside the simulation.
