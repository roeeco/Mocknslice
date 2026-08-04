# Parametric panel construction plan

## Phase 9 release scope

The first Phase 9 advanced feature generates a rectangular enclosure as separate material-aware panels. The release supports an open five-panel kit or a closed six-panel kit with one of three edge systems: straight butt joints, complementary fingers, or tabs with through-slots.

This is a fabrication generator, not a general solid modeller. The source model remains available to other modes but does not drive the enclosure dimensions.

## Workflow

1. Choose **Panel construction** and a material profile.
2. Enter inside width, depth, and height.
3. Select butt, finger, or tab-slot joints.
4. For formed joints, choose a target finger width. For tab-slot joints, also choose slot clearance.
5. Optionally add a fully jointed lid and up to six evenly spaced dividers in each direction.
6. Generate through the cancellable geometry worker.
7. Inspect exact stepped outlines, slot holes, and dividers in both the assembled 3D preview and 2D layout.
8. Review structured fit, material, and assembly warnings; arrange panels; export SVG or PDF.

## Geometry contract

- Every paired edge has one stable joint ID and label on both panels.
- Paired edges use the same odd segment count derived from their shared nominal length.
- Finger joints alternate complementary protruding segments at material thickness.
- Tab-slot joints place tabs on panel A and clearance-expanded closed holes on panel B.
- Butt joints preserve straight outlines and explicitly require a separate fastening method.
- Each internal divider receives two material-thickness bottom tabs and alternating side fingers. The base and both intersected enclosure walls receive matching clearance-expanded closed slots.
- Width and depth divider families can be generated together. Every crossing receives complementary half-height notches, and bottom-tab positions move deterministically when needed to keep them clear of crossing slots.
- Divider-to-wall connections remain finger-and-slot joints even when the enclosure perimeter uses butt or tab-slot joints.
- Outer outlines and slot holes remain normal fabrication paths, so layout, validation, kerf preparation, material usage, SVG, and PDF need no private export path.
- Identical model reference, material input, and settings produce the same `sf9-` hash and byte-stable geometry.

## Deferred advanced features

Radial slicing, polygon nesting, angled or freeform panel editing, locking tabs, living hinges, fold-over reinforcement, fastener patterns, dog-bones, assembly sequencing, PWA installation, and cloud projects remain separate follow-ups.
