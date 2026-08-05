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
- General-purpose organic unfolding, textures, PDO import, and arbitrary panel editing remain deferred beyond the bounded Phase 8 triangle workflow.

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

## Fabrication-output preparation

Phase 7 keeps generated geometry canonical and creates a prepared derivative for the live 2D preview, SVG, PDF, warnings, and usage estimates.

1. Resolve kerf from `none`, the material snapshot, or a custom non-negative value.
2. Offset eligible closed cut contours by half the kerf: outer contours outward and hole contours inward.
3. Validate winding, finite intersections, miter length, area preservation, and self-intersection. Preserve the source path and emit `KERF_OFFSET_FAILED` if a reliable result cannot be produced.
4. Keep open cut paths on their centreline and emit `KERF_OPEN_PATH_SKIPPED`; this includes waffle slots and segmented folding-net boundaries.
5. Preserve mountain/valley operations, combine them as score lines, or split them into stable dash/gap perforation paths.
6. Add optional guide-layer registration crosses directly in sheet coordinates.

The built-in offset is intended for simple polygon contours and avoids a new polygon-boolean dependency. It does not silently trim self-intersections or join independent open cut segments into a closed boundary.

Material usage sums exact outer-minus-hole area for closed contours. Folding nets use the sum of serializable panel and enabled-tab areas. Other open-path-only parts fall back to their planar bounding footprint. Waste and utilization compare that estimate with every sheet containing placements; cut length is calculated from prepared cut paths.

## Bounded low-poly mesh unfolding

Phase 8 operates on the normalized indexed triangle mesh and intentionally fails closed when topology is outside its supported domain.

1. Build stable undirected edge keys and record the oriented use from every incident triangle.
2. Reject empty, over-limit, open, non-manifold, or inconsistently oriented meshes.
3. Treat user-selected manual edges as forbidden hinges, or search a deterministic set of roots and edge orderings automatically.
4. Build an acyclic spanning forest. Shared edges excluded from the forest become explicit seams; manual mode distinguishes required cycle cuts from user constraints.
5. Flatten each root triangle from exact source lengths, then place each child triangle on the opposite side of its parent hinge. Separate trees become stable horizontal islands.
6. Detect positive-area triangle overlaps, score candidates by overlap count, island count, then bounding area, and retain the best attempted tree.
7. Emit one glue tab per paired seam, stable triangle/seam labels, explicit mountain/valley folds, assembled hinge data, source and flat triangle coordinates, and structured issues.
8. Derive 3D preview positions by applying rigid Rodrigues rotations to every hinge subtree. Preview progress is transient viewport state; the generated geometry remains canonical.

Automatic search is deterministic optimization, not a global optimum guarantee. Manual seams are constraints rather than arbitrary mesh surgery: extra cycle-breaking seams are still required. Face and tab overlaps are warnings and stay visible in the 2D sheet/export data. See [Low-poly unfolding plan](UNFOLDING_PLAN.md) and [ADR 0011](adr/0011-deterministic-low-poly-unfolding.md).

## Phase 8 limitations

- Input must be a closed, edge-manifold, consistently oriented triangular mesh within the explicit face limit (default 200).
- The engine does not triangulate, decimate, repair, remesh, merge coplanar faces, preserve textures, or import PDO data.
- Automatic seam-tree attempts are bounded and may leave overlaps. The engine reports them instead of silently moving faces or splitting more islands.
- Glue tabs use a deterministic shouldered shape and may require depth or seam changes when overlap warnings occur.
- The fold slider is rigid kinematic preview only. It does not simulate thickness, bend allowance, collision, glue order, material grain, or structural behaviour.
- Disconnected closed shells produce multiple labelled islands. Paired labels guide assembly but do not establish a physical assembly sequence.

## Parametric panel construction

Panel construction builds an enclosure from five or six separate nominal panels.

1. Use explicit inside width, depth, and height plus the selected material thickness.
2. Pair the base to four walls, pair adjacent vertical wall edges, and optionally pair a lid to all four top edges.
3. Choose an odd segment count nearest the target finger width so reversing edge direction preserves alternating parity.
4. For finger joints, protrude material-thickness fingers on alternating complementary segments of both paired outlines.
5. Boundary tab-slot generation is retired. Legacy requests return a structured unsupported-joint issue rather than geometry.
6. For butt joints, retain straight nominal outlines and report the need for adhesive or separate fasteners.
7. Add stable `Jn` labels to both panels, exact outer/hole contour roles, panel/joint IDs, exact assembled outlines and holes, structured issues, and an `sf9-` input hash.
8. Optional dividers use two bottom tabs plus alternating fingers on both vertical sides. The base and intersected enclosure walls receive matching clearance-expanded slots.
9. The assembled preview extrudes those exact outlines and holes at material thickness. Enclosure panels extrude outward from the requested inside dimensions, while dividers remain centred on their section planes.
10. Resolve each optional base/wall override from one stable connection key before emitting either panel edge. Per-connection finger clearance shortens both complementary finger sets symmetrically.
11. For open tops, replace the front/back nominal top segment with a deterministic arch, gable, or stepped row while preserving both vertical side-joint endpoints.

The target finger width chooses a stable segment count; it is not silently substituted as the final pitch. Divider clearance affects base, wall, and crossing receiver slots. Finger-joint fit is controlled by exact outlines plus the existing kerf-output settings, so a physical scrap test remains required.

## Panel-construction limitations

- The generator produces rectangular open or closed enclosure kits; only open front/back panels receive bounded profiles.
- The assembled preview displays exact zero-thickness outlines and slot holes, but does not simulate material volume, collision, flex, or insertion order.
- A jointed lid receives an assembly-order warning because all closing edges may not be simultaneously insertable in rigid material.
- Finger joints on paper/card receive a material warning; the generator does not replace them automatically.
- Width and depth dividers may cross with deterministic half-lap notches. Angled panels, arbitrary profile nodes, ribs, locking tabs, hinges, reinforcement folds, fastener holes, dog-bones, and CNC tool-radius compensation remain deferred.
- Kerf, grain, glue, press-fit tolerance, and real material variation require a physical fit test.

## Phase 7 limitations

- Kerf compensation is not applied to open slot or folding-net cut paths; the interface reports every affected part.
- Concave offsets that require topology changes or polygon booleans are rejected rather than repaired.
- Material usage does not account for grain constraints, spacing corridors, overlapping folding panels/tabs, or scrap reuse.
- PDF uses vector paths and a built-in Helvetica font. Non-ASCII label characters are replaced with `?` until embedded-font support is added.
- PDF pages use the configured physical sheet size and are assembly/print guides, not a substitute for confirming cutter-driver scale settings.
