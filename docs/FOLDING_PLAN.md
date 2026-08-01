# Shape-aware folding plan

- Status: Implemented in Phase 6
- Prerequisite: Phase 4 sheet layout
- Inspiration: [Papercraft Maker](https://papercraft-maker.com/) import, process, choose, preview, and export workflow

## Product boundary

SliceFold will fit deterministic folding templates around an imported, normalized STL. It will not unfold arbitrary mesh faces, expose a seam editor, import PDO files, or preserve UV textures in this phase.

The user workflow is:

1. Import, normalize, orient, and inspect an STL.
2. Choose a template family and fitting axis.
3. Preview the source projection, convex fitted profile, and clearance.
4. Generate the folding net explicitly.
5. Inspect the model inside the assembled template and the flat net in 2D.
6. Adjust clearance or template parameters and regenerate.
7. Arrange the generated parts on sheets and export operation-layered SVG.

## Fit contract

All calculations use millimetres and pure serializable data.

- X-axis fitting projects vertices to Z/Y, Y-axis fitting to X/Z, and Z-axis fitting to X/Y.
- Sort projected points deterministically, remove duplicates within the configured tolerance, and calculate a monotone-chain convex hull.
- Offset the convex hull outward by `clearanceMm` using intersections of shifted edge lines, and add the same clearance at both ends of the fitting-axis extent. Clearance must be zero or greater.
- Default clearance comes from the selected material profile. The user can override it without changing the source mesh.
- Default profile simplification tolerance is `1 mm`. The effective minimum profile edge is `max(2 mm, material thickness × 2)`.
- Simplification must preserve a convex enclosure. Display the source projection and final profile together and emit `PROFILE_SIMPLIFIED` whenever vertices are removed.
- More than 24 final profile edges emits `PROFILE_COMPLEXITY_HIGH`; generation remains available unless a material minimum is violated.
- Identical mesh data, orientation, material, and fit settings must produce byte-equivalent domain output. Persist an algorithm version and deterministic input hash with the result.

Profile extraction and template generation run through the geometry worker with cancellation and stale-result rejection. They do not create Three.js objects.

## Template families

| Template              | Shape-fitting behaviour                                                                                                                                                                             | Initial controls                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Open box              | Rectangular panels use the oriented fitted-profile extents and model axis depth.                                                                                                                    | Clearance, wall height, tab depth                 |
| Box with lid          | Box rules plus a separate lid enlarged for material thickness and lid clearance.                                                                                                                    | Clearance, wall height, lid depth, tab depth      |
| Tray                  | Open-box base with independently adjustable shallow walls.                                                                                                                                          | Clearance, wall height, corner-tab style          |
| Sleeve                | A segmented perimeter band wraps the convex profile and remains open at both fitting-axis ends.                                                                                                     | Clearance, seam position, glue-tab depth          |
| Envelope              | Two convex profile faces joined by a gusset sized from model depth.                                                                                                                                 | Clearance, gusset depth, closure flap             |
| Regular polygon prism | Circumscribe a regular polygon around the fitted profile and use axis extent for length.                                                                                                            | Side count 3–12, rotation, clearance, seam tab    |
| Pyramid or frustum    | Use convex profiles from the lower and upper axial quarters, resample them to a shared stable vertex count, and connect corresponding edges with trapezoidal panels. An apex uses a zero top scale. | Clearance, apex/frustum mode, top scale, seam tab |

If a template cannot maintain matching shared-edge lengths or a physically connected net, return `TEMPLATE_INCOMPATIBLE` instead of silently changing the requested template.

## Serializable domain

```ts
type TemplateKind =
  | 'open-box'
  | 'box-with-lid'
  | 'tray'
  | 'sleeve'
  | 'envelope'
  | 'regular-prism'
  | 'pyramid-frustum';

interface TemplateFitSettings {
  templateKind: TemplateKind;
  fitAxis: 'x' | 'y' | 'z';
  clearanceMm: number;
  profileToleranceMm: number;
  parameters: Record<string, number | string | boolean>;
}

interface ProjectedProfile {
  sourceModelId: string;
  fitAxis: 'x' | 'y' | 'z';
  sourceHullPoints: Point2D[];
  fittedPoints: Point2D[];
  clearanceMm: number;
  simplificationToleranceMm: number;
}

interface FoldPanel {
  id: string;
  name: string;
  outline: Point2D[];
}

interface FoldEdgeDefinition {
  id: string;
  panelAId: string;
  panelBId?: string;
  disposition: 'boundary' | 'hinge' | 'seam';
  foldDirection?: 'mountain' | 'valley';
  targetAngleDeg?: number;
  pairLabel?: string;
}

interface FoldTab {
  id: string;
  edgeId: string;
  ownerPanelId: string;
  style: 'glue';
  depthMm: number;
  shoulderAngleDeg: number;
  enabled: boolean;
}

interface TemplateGenerationResult {
  profile: ProjectedProfile;
  panels: FoldPanel[];
  edges: FoldEdgeDefinition[];
  tabs: FoldTab[];
  parts: FabricationPart[];
  issues: ValidationIssue[];
  algorithmVersion: string;
  inputHash: string;
}
```

Generated fabrication paths preserve `cut`, `score`, `mountain-fold`, `valley-fold`, `engrave`, and `guide` operations. Domain panels and edges drive both the flat net and assembled preview; render-specific geometry is recreated in the viewport.

## Validation

Generation uses structured issues with affected model, panel, edge, tab, or part IDs:

- `PROFILE_ZERO_AREA`
- `PROFILE_OFFSET_FAILED`
- `PROFILE_SIMPLIFIED`
- `PROFILE_COMPLEXITY_HIGH`
- `PROFILE_FEATURE_TOO_NARROW`
- `TEMPLATE_INCOMPATIBLE`
- `SHARED_EDGE_LENGTH_MISMATCH`
- `TAB_OVERLAP`
- `NET_OVERLAP`
- `PART_EXCEEDS_SHEET`

Only definitely unusable geometry blocks export. Simplification and complexity remain visible warnings.

## Phase 6 completion criteria

- Every template is a pure generator with deterministic fixtures and golden fabrication paths.
- All shared panel edges have matching lengths and stable paired labels.
- The fitted profile encloses every projected source point plus clearance within tolerance.
- The assembled preview shows the imported model ghosted inside the generated construction.
- 2D and 3D selection use the same panel, edge, tab, and part IDs.
- Project persistence, undo/redo, regeneration, cancellation, and stale-result handling cover all fit settings.
- Playwright demonstrates STL import, template selection, clearance adjustment, generation, both previews, sheet arrangement, and SVG export.

These criteria are covered by pure geometry invariants, deterministic template fixtures, project/SVG round trips, component tests, and the browser workflow. Project format version 2 persists the complete generation result; version 1 files migrate through the explicit import branch.

## Deferred work

Concave silhouettes, holes, arbitrary face unfolding, editable seams, face cut/join operations, PDO import, UV textures, texture bleed, raster print-and-cut, and cloud galleries are outside Phase 6. Advanced unfolding remains an unscheduled research revision.
