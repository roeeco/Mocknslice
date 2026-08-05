# Parametric panel construction plan

## Phase 9 release scope

The panel-construction workflow generates a rectangular enclosure as separate material-aware panels. The current release supports an open five-panel kit or a closed six-panel kit with straight butt joints or complementary fingers. Open kits may use bounded arch, gable, or stepped front/back profiles, and the eight base/wall connections may override the enclosure joint family as shared physical pairs. Tabs with through-slots are retired pending a reliable redesign.

This is a fabrication generator, not a general solid modeller. The source model remains available to other modes but does not drive the enclosure dimensions.

## Workflow

1. Choose **Panel construction** and a material profile.
2. Enter inside width, depth, and height.
3. Select butt or finger joints.
4. Choose 1–10 mm base/wall, divider, and optional lid stock, then choose a target finger width for formed joints.
5. Optionally add a fully jointed lid and evenly spaced dividers up to the calculated physical maximum in each direction.
6. For an open kit, optionally choose a bounded front and back profile.
7. Optionally override any base/wall connection once; Advanced mode also permits a per-connection finger clearance.
8. Generate through the cancellable geometry worker.
9. Inspect exact stepped outlines, slot holes, and dividers in both the assembled 3D preview and 2D layout.
10. Review structured fit, material, and assembly warnings; arrange panels; export SVG or PDF.

## Geometry contract

- Every paired edge has one stable joint ID and label on both panels.
- Paired edges use the same odd segment count derived from their shared nominal length.
- Finger joints alternate complementary protruding segments at material thickness.
- Connection overrides are keyed by a physical panel pair, so both participating edges always resolve from the same family, pitch, and clearance specification.
- Per-connection finger clearance shortens complementary fingers symmetrically without changing side-joint length.
- Butt joints preserve straight outlines and explicitly require a separate fastening method.
- Arch, gable, and stepped profiles alter only the open top edge of front/back panels. Their side endpoints remain at the nominal wall height, and the same outline drives fabrication and assembly geometry.
- Each internal divider receives two material-thickness bottom tabs and alternating side fingers. The base and both intersected enclosure walls receive matching clearance-expanded closed slots.
- Width and depth divider families can be generated together. Every crossing receives complementary half-height notches, and bottom-tab positions move deterministically when needed to keep them clear of crossing slots.
- Divider-to-wall connections remain finger-and-slot joints even when the enclosure perimeter uses butt joints.
- Outer outlines and slot holes remain normal fabrication paths, so layout, validation, kerf preparation, material usage, SVG, and PDF need no private export path.
- Identical model reference, material input, and settings produce the same `sf9-` hash and byte-stable geometry.

## Deferred advanced features

Radial slicing, polygon nesting, angled or freeform panel editing, arbitrary profile nodes, tab-slot joints, locking tabs, living hinges, fold-over reinforcement, fastener patterns, dog-bones, assembly sequencing, PWA installation, and cloud projects remain separate follow-ups.
