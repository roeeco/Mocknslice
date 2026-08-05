# Parametric folding plan

- Status: Implemented in Phase 6
- Prerequisite: Phase 4 sheet layout
- Inspiration: [Papercraft Maker](https://papercraft-maker.com/) import, process, choose, preview, and export workflow

## Product boundary

SliceFold creates deterministic folding templates directly from explicit finished dimensions. It does not fit predefined templates around an STL. Imported STL geometry belongs to the mesh-unfolding branch of the same Folding and unfolding workflow.

The user workflow is:

1. Choose Folding and unfolding, then Create from template.
2. Choose one of the seven template families.
3. Enter width, length, and height and choose glue or press-fit connections.
4. Generate the folding net explicitly.
5. Inspect the assembled template and flat net in 2D.
6. Adjust dimensions, connection depth, or family parameters and regenerate.
7. Arrange the generated parts on sheets and export operation-layered SVG.

## Geometry contract

All calculations use millimetres and pure serializable data. A standalone rectangular parameter profile supplies the requested envelope; unrelated model vertices and orientation do not affect output or its hash.

Every required connection produces a tab. Tab depth is bounded by its actual base edge and an absolute 15 mm maximum. Automatic reduction emits `TAB_DEPTH_CLAMPED`. Glue tabs retain a shouldered bonding surface. Press-fit lips additionally identify a receiving panel and add a clearance-adjusted slit cut; a missing receiver is a blocking `PRESS_FIT_RECEIVER_MISSING` issue.

The earlier convex-profile fitting contract is retained only as legacy geometry support and is no longer exposed by the template workflow.

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

| Template              | Parametric behaviour                                                        | Initial controls                        |
| --------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| Open box              | Rectangular base plus four walls sized from the requested envelope.         | Width, length, height, connection depth |
| Box with lid          | Open box plus a separate material- and clearance-adjusted lid.              | Envelope, lid depth, lid clearance      |
| Tray                  | Open-box construction using the requested shallow height.                   | Envelope, connection depth              |
| Sleeve                | A four-sided wrapping band around the requested rectangular section.        | Envelope, seam connection               |
| Envelope              | Paired rectangular faces connected by a depth band and closure flap.        | Envelope, flap depth, seam connection   |
| Regular polygon prism | Regular 3–12-sided section with the requested extrusion length.             | Envelope, side count, rotation, seam    |
| Pyramid or frustum    | Rectangular base with tapered side panels; zero top scale produces an apex. | Envelope, top scale, seam, optional cap |

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
  sizeMode?: 'auto-fit' | 'custom';
  envelopeDimensions?: {
    widthMm: number;
    lengthMm: number;
    heightMm: number;
  };
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
  style: 'glue' | 'press-fit';
  depthMm: number;
  shoulderAngleDeg: number;
  enabled: boolean;
  receiverPanelId?: string;
  slotStart?: Point2D;
  slotEnd?: Point2D;
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
- `TAB_DEPTH_CLAMPED`
- `PRESS_FIT_RECEIVER_MISSING`
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

These criteria are covered by pure geometry invariants, deterministic template fixtures, project/SVG round trips, component tests, and the browser workflow. Project format version 2 introduced persistence for the complete generation result; current version 7 retains it alongside output settings and optional advanced geometry. Versions 1–6 migrate through explicit import branches.

## Deferred work

Concave silhouettes, holes, arbitrary face unfolding, editable seams, face cut/join operations, PDO import, UV textures, texture bleed, raster print-and-cut, and cloud galleries are outside Phase 6. Advanced unfolding remains an unscheduled research revision.
