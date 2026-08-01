# Geometry notes

## Coordinate and unit policy

All fabrication dimensions are millimetres. Imported model coordinates will remain separate from fabrication dimensions until normalization records an explicit conversion. The render layer may map these numbers directly for convenience but must never persist a Three.js object or assume an STL unit.

## STL normalization

Phase 2 accepts ASCII and little-endian binary STL. Because STL has no reliable unit metadata, the user chooses millimetres, centimetres, metres, or inches before import. The choice and source-to-mm factor are persisted.

Normalization:

1. Parse triangle coordinates without relying on header metadata or normals.
2. Convert coordinates to millimetres.
3. Remove zero-area triangles and report the count.
4. Weld vertices within `0.00001 mm`, including adjacent spatial hash cells.
5. Remove triangles collapsed by welding.
6. Calculate source bounds and centre the usable mesh at the origin.
7. Reconstruct indexed triangles and calculate topology health.

Health inspection counts undirected edge uses, open edges, edges shared by more than two faces, edge-connected shells, and inconsistent directions across two-face edges. Signed volume identifies likely inversion only for a closed, manifold, consistently oriented mesh. SliceFold reports these properties but does not repair them silently.

Dimension correction uniformly scales all positions. Orientation controls apply deterministic 90° rotations to positions, then recalculate bounds and health data. Both operations participate in project undo/redo.

## Stacked-slice pipeline

1. Normalize a mesh with a documented vertex tolerance.
2. Intersect triangles with axis-aligned slice planes.
3. Weld segment endpoints within a configurable epsilon.
4. Trace closed contours and report open or ambiguous results.
5. Classify outer contours and holes.
6. Normalize outer contours counter-clockwise and holes clockwise.
7. Convert each outer island plus its contained holes into a serializable fabrication part.

Each step is a pure function. Worker orchestration calls the same pipeline used by deterministic cube, cylinder, hollow-prism, and open-mesh tests.

Slice planes begin half a spacing interval inside the model bounds and repeat at the requested spacing. If spacing is at least the model extent, one plane is placed at the midpoint. This avoids generating faces directly on model boundary planes. X planes project to Z/Y part coordinates, Y planes to X/Z, and Z planes to X/Y.

Triangle intersections within the contour epsilon are welded through neighbouring spatial-hash cells. Duplicate graph edges are discarded. Degree-one nodes form open contours and nodes with degree above two are ambiguous; both conditions produce structured warnings rather than automatic closure. Closed contour nesting depth determines outer/hole roles.

Part thickness controls the extruded assembled preview and fabrication metadata. It does not change plane spacing. Thickness greater than spacing is allowed but reported because assembled parts overlap.

## Orthogonal waffle pipeline

1. Validate two different axis-aligned slice families and generate each through the existing stacked-slice contour pipeline.
2. Map each slice's 2D coordinates back to its two global in-plane axes.
3. Scan the filled contour at the paired plane position, pairing even/odd boundary crossings and subtracting hole intervals.
4. Intersect both parts' usable intervals along their shared physical axis.
5. Set slot width to material thickness plus explicit non-negative clearance.
6. Split every shared interval at its midpoint and assign complementary start/end entries.
7. Sample the slot-width edges against the usable contour and create a deterministic open U-shaped cut path.
8. Add stable family, pair, direction, width, depth, and intersection metadata, then validate all slots on each part.

The `by-family` pattern sends all family A slots from one side and family B slots from the other. The `alternating` pattern flips the complementary pair based on the two plane indices. Reversal inverts every pair without changing plane or part order.

An open U path is intentional: its endpoints lie on the existing outer or hole contour. Together those cuts enclose the removable slot waste while preserving the original contour as the canonical assembled panel outline. The 3D preview therefore shows positioned intersecting panels and family relationships; the production slot cuts are verified in 2D and SVG.

Validation reports family contour problems inherited from stacked slicing, pairs with no usable shared interval, full-width slots that cannot remain inside both contours, half-depth slots shorter than two slot widths, overlapping slot bands, and any part whose holes could provide an inaccessible slot entry.

## Basic sheet layout

Phase 4 uses deterministic first-fit rows. Parts retain generation order and start unrotated at the safe margin. A row advances by the part's axis-aligned width plus configured spacing; overflow starts a new row, and vertical overflow starts another sheet with stable derived IDs. A part too large for the usable area remains placed and receives a structured boundary or margin warning so the problem stays visible.

Persisted placement means: rotate each part point around `(0, 0)`, then translate by the placement's `x` and `y` values in millimetres. The 2D viewport, bounds checks, overlap checks, labels, project JSON, and sheet SVG all use this same pure transform. Manual dragging previews without mutating project state and records one undoable placement change on release.

Validation uses transformed axis-aligned bounds for sheet boundaries, margins, and pairwise overlap. It also reports invalid sheet dimensions, missing placement references, unplaced parts, and parts placed more than once.

## Shape-aware template fitting

Phase 6 fits fixed folding-template topologies to an imported model without unfolding its faces. The selected axis determines an orthographic projection using the same axis mapping as slicing. The pure fitting pipeline:

1. Deduplicate and deterministically sort projected mesh vertices.
2. Build a monotone-chain convex hull.
3. Offset the convex hull outward by explicit clearance.
4. Simplify short edges while preserving a convex enclosure.
5. Pass the fitted profile and axial extent to a pure template generator.
6. Validate shared-edge lengths, material minimums, tabs, net overlap, and sheet bounds.

Default simplification tolerance is `1 mm`; the effective minimum edge is `max(2 mm, material thickness × 2)`. The source projection and fitted outline remain separately serializable so the interface can show every automated change. Detailed template rules and planned types are in [FOLDING_PLAN.md](FOLDING_PLAN.md).

Concave silhouettes, projection holes, and arbitrary face unfolding are deliberately excluded. A template incompatibility is reported rather than repaired by changing topology.

Open boxes, lidded boxes, and trays use fitted profile extents. Sleeves use the convex perimeter as a segmented band. Envelopes and regular prisms add matched convex faces, while pyramids and frustums connect corresponding sampled end profiles. The flat-net builder removes shared hinges from cut paths, emits explicit mountain/valley or score paths, creates shouldered glue tabs, assigns stable pair labels, and validates panel/tab overlap.

## Phase 6 limitations

- Convex fitting encloses concavities and holes instead of following them.
- The assembled preview displays the final panel positions; it is not a folding animation, collision solver, or structural simulation.
- Glue-tab and panel-overlap checks are geometric and do not model material grain, bend allowance, glue access, or assembly order.
- Profile simplification is enclosure-preserving and deterministic, but it is not a user-editable curve or seam workflow.
- Arbitrary face unfolding, textures, PDO import, and editable mesh seams remain deferred research.

## Phase 3 limitations

- Shells are edge-connected components; faces touching at only one vertex remain separate shells.
- Face inversion is a best-effort signed-volume check and is withheld for an already invalid topology.
- The normalized mesh is persisted, but original STL bytes are not embedded in the project file.
- Import shows active/cancelled state but not percentage progress because parsing and normalization are currently one deterministic worker operation.
- Slice planes are axis-aligned; arbitrary planes and orthogonal waffle intersections come later.
- No automatic repair, kerf offset, clearance offset, simplification, or smoothing is applied.
- A plane exactly coplanar with model faces is reported and may require a spacing adjustment.
- Self-intersecting source contours are not repaired.
- The assembled preview is visual verification, not a collision or structural simulation.

## Phase 4 limitations

- Initial placement is row-based, not polygon nesting or material optimization.
- Automatic arrangement does not rotate parts; users control rotation explicitly.
- Overlap checks use transformed axis-aligned bounds and can conservatively flag irregular contours whose boxes overlap.
- Configured spacing guides automatic placement but is not yet enforced as a separate manual-placement warning.
- Sheets share the same fabrication parts; duplicating a sheet copies setup only, not placements.

## Phase 5 limitations

- Slice families are orthogonal and axis-aligned; radial or arbitrary-angle waffle systems remain deferred.
- Slots are fixed at half the shared usable depth. Custom depths and stepped joints are not yet exposed.
- The 3D preview shows intersecting family panels but does not subtract the U-shaped slot waste from the rendered extrusion.
- Hole-aware scan intervals are supported, but entries that may originate from an internal hole receive a manual-review warning.
- Slot-fit validation is geometric only; it does not simulate flex, kerf, grain, insertion order, or structural strength.
