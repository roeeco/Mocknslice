import { verifySurfaceDeviation } from '../geometry/papercraft/measureSurfaceDeviation';
import { papercraftPreparationHash } from '../geometry/papercraft/workingSource';
import { compileToParts } from '../geometry/designGraph/compileToParts';
import { papercraftHalfEdges } from '../geometry/papercraft/halfEdge';
import { preflightPapercraftSource } from '../geometry/papercraft/prepareSource';
import { applyPose } from '../geometry/designGraph/poses';
import { meshVertex } from '../geometry/unfolding/meshAdjacency';
import { EPS_LENGTH_MM } from '../geometry/designGraph/tolerances';
import * as v from 'valibot';
import type { ProjectData } from './project';
import { validateGraph } from '../geometry/designGraph/validateGraph';
import { validatePapercraftNet } from '../geometry/papercraft/validateNet';
import { hashSerializable } from './canonicalHash';
import { papercraftInputHash } from '../geometry/papercraft/inputHash';

const finite = v.pipe(v.number(), v.finite()),
  positive = v.pipe(finite, v.minValue(Number.MIN_VALUE)),
  id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const point = v.object({ x: finite, y: finite }),
  vector = v.tuple([finite, finite, finite]),
  index = v.pipe(finite, v.integer(), v.minValue(0));
const bounded = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
  max = 10000,
) => v.pipe(v.array(schema), v.maxLength(max));
const issue = v.object({
  id,
  code: id,
  severity: v.picklist(['error', 'warning', 'info']),
  message: v.string(),
  affectedEntityIds: bounded(id),
  suggestedAction: v.optional(v.string()),
  messageArgs: v.optional(v.record(v.string(), v.union([v.string(), finite]))),
});
const tabPreference = v.object({
  owner: v.picklist(['face-a', 'face-b', 'none']),
  targetDepthMm: positive,
  shoulderAngleDeg: v.pipe(positive, v.maxValue(89.999)),
});
const settings = v.object({
  algorithmVersion: v.literal('papercraft-v2'),
  sourceMeshHash: id,
  faceTarget: v.pipe(index, v.minValue(4), v.maxValue(200)),
  maximumDeviationMm: v.pipe(finite, v.minValue(0)),
  mergePlanarFaces: v.boolean(),
  optimizer: v.picklist(['balanced', 'few-pieces', 'compact', 'preserve-sharp-edges']),
  maxCandidates: v.pipe(index, v.minValue(1), v.maxValue(32)),
  tabDefaultDepthMm: positive,
  tabShoulderAngleDeg: v.pipe(positive, v.maxValue(89.999)),
  edgeEdits: bounded(
    v.object({ id, intent: v.picklist(['auto', 'must-cut', 'must-join']), tab: tabPreference }),
    300,
  ),
  islandEdits: bounded(
    v.object({
      id,
      rootFaceId: id,
      sourceFaceIds: v.optional(bounded(id, 200)),
      translationMm: v.tuple([finite, finite]),
      rotationDeg: finite,
      layoutLocked: v.boolean(),
    }),
    200,
  ),
});
const path = v.object({
  id,
  operation: v.picklist([
    'cut',
    'score',
    'mountain-fold',
    'valley-fold',
    'perforate',
    'engrave',
    'guide',
  ]),
  closed: v.boolean(),
  points: bounded(point),
  contourRole: v.optional(v.picklist(['outer', 'hole'])),
  panelId: v.optional(id),
  edgeId: v.optional(id),
  tabId: v.optional(id),
  featureId: v.optional(id),
});
const label = v.object({
  id,
  text: v.string(),
  position: point,
  operation: v.picklist(['engrave', 'guide']),
  entityId: v.optional(id),
  featureId: v.optional(id),
  fontSizeMm: v.optional(positive),
  rotationDeg: v.optional(finite),
});
const part = v.object({
  id,
  name: v.string(),
  label: v.optional(v.string()),
  paths: bounded(path),
  labels: v.optional(bounded(label)),
  thicknessMm: positive,
  sourceReference: v.optional(id),
  unfolding: v.optional(v.object({ islandIndex: index, faceIds: bounded(id, 200) })),
});
const mesh = v.object({ positionsMm: bounded(finite, 300000), indices: bounded(index, 300000) });
const source = v.object({
  mesh,
  sourceMeshHash: id,
  faces: bounded(
    v.object({
      id,
      index,
      vertexIds: v.tuple([index, index, index]),
      normal: vector,
      sourceFaceIds: bounded(id, 200),
    }),
    200,
  ),
  halfEdges: bounded(
    v.object({
      id,
      edgeKey: id,
      faceId: id,
      faceIndex: index,
      startVertex: index,
      endVertex: index,
      nextId: id,
      oppositeId: v.optional(id),
      lengthMm: positive,
      signedDihedralDeg: v.optional(finite),
      joinable: v.boolean(),
      softCoplanar: v.boolean(),
    }),
    600,
  ),
  panels: bounded(
    v.object({
      id,
      faceIds: bounded(id, 200),
      boundaryVertexIds: bounded(index, 600),
      verified: v.boolean(),
    }),
    200,
  ),
  issues: bounded(issue),
  metrics: v.object({
    beforeFaceCount: index,
    afterFaceCount: index,
    maximumDeviationMm: finite,
    simplified: v.boolean(),
  }),
});
const flatFace = v.object({
  id,
  sourceFaceIndex: index,
  vertexIds: v.tuple([index, index, index]),
  points: v.tuple([point, point, point]),
});
const tab = v.object({
  id,
  edgeKey: id,
  ownerFaceId: id,
  receiverFaceId: id,
  islandId: id,
  depthMm: positive,
  shoulderAngleDeg: positive,
  outline: v.tuple([point, point, point, point]),
  status: v.picklist(['enabled', 'unresolved', 'suppressed']),
});
const edgeRef = v.object({ a: id, b: id });
const pathMetadata = v.omit(path, ['points']);
const labelMetadata = v.omit(label, ['position']);
export const designGraphSchema = v.object({
  schemaVersion: v.literal(1),
  units: v.literal('mm'),
  source: v.object({
    kind: v.picklist(['mesh', 'template', 'panel-construction', 'slicing']),
    sourceId: id,
    algorithmVersion: id,
    inputHash: id,
  }),
  panels: bounded(
    v.object({
      id,
      pieceId: id,
      name: v.string(),
      vertices: bounded(v.object({ id, x: finite, y: finite })),
      boundary: bounded(id),
      holes: bounded(bounded(id)),
      materialThicknessMm: positive,
      sourceFaceIds: v.optional(bounded(id)),
      assembledPose: v.optional(v.pipe(v.array(finite), v.length(16))),
      assemblyBoundary: v.optional(bounded(id)),
    }),
    200,
  ),
  connections: bounded(
    v.object({
      id,
      panelAId: id,
      panelBId: v.optional(id),
      edgeA: edgeRef,
      edgeB: v.optional(edgeRef),
      treatment: v.picklist(['hinge', 'seam', 'finger', 'butt']),
      flatJoined: v.boolean(),
      foldAngleDeg: v.optional(finite),
      closure: v.picklist(['none', 'glue-tab', 'press-fit']),
      tabOwnerPanelId: v.optional(id),
      required: v.boolean(),
    }),
    600,
  ),
  features: bounded(
    v.object({
      id,
      pieceId: id,
      hostPanelId: v.optional(id),
      kind: v.picklist(['contour', 'hole', 'tab', 'score', 'engrave', 'notch', 'slot', 'guide']),
      operation: v.picklist([
        'cut',
        'score',
        'mountain-fold',
        'valley-fold',
        'perforate',
        'engrave',
        'guide',
      ]),
      geometry2D: bounded(point),
      path: v.optional(pathMetadata),
      label: v.optional(labelMetadata),
    }),
  ),
  pieces: bounded(
    v.object({
      id,
      metadata: v.omit(part, ['paths', 'labels']),
      pathIds: bounded(id),
      labelIds: bounded(id),
      labelsPresent: v.optional(v.boolean()),
    }),
    200,
  ),
  issues: bounded(issue),
  manufacturingStatus: v.picklist(['validated', 'legacy-unverified']),
});
// The compatibility renderer is also validated by the existing mesh-unfold import guard.
const result = v.object({
  algorithmVersion: v.literal('papercraft-v2'),
  inputHash: id,
  source,
  faces: bounded(flatFace, 200),
  hingeKeys: bounded(id, 200),
  islands: bounded(v.object({ id, rootFaceId: id, faceIds: bounded(id, 200) }), 200),
  issues: bounded(issue),
  score: v.pipe(v.array(finite), v.length(6)),
  searchExhausted: v.boolean(),
  tabs: bounded(tab, 300),
  graph: v.pipe(
    designGraphSchema,
    v.check((g) => g.source.kind === 'mesh' && g.source.algorithmVersion === 'papercraft-v2'),
  ),
  parts: bounded(part, 200),
  unfolding: v.unknown(),
});
export const papercraftWorkingSourceSchema = v.object({
  mesh: source.entries.mesh,
  meshHash: id,
  preparationHash: id,
  maximumDeviationMm: v.pipe(finite, v.minValue(0)),
});
const schema = v.object({
  settings,
  acceptSimplification: v.boolean(),
  workingSource: v.optional(papercraftWorkingSourceSchema),
  result: v.optional(result),
});
export function parsePapercraftRecord(
  value: unknown,
  project: ProjectData,
  isUnfolding: (value: unknown) => boolean,
): ProjectData['papercraft'] {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success) throw new Error('Papercraft data is malformed or exceeds supported limits.');
  const record = parsed.output as NonNullable<ProjectData['papercraft']>;
  if (
    new Set(record.settings.edgeEdits.map((e) => e.id)).size !== record.settings.edgeEdits.length ||
    new Set(record.settings.islandEdits.map((i) => i.id)).size !==
      record.settings.islandEdits.length
  )
    throw new Error('Duplicate papercraft edits.');
  if (record.workingSource) {
    const working = record.workingSource;
    if (
      hashSerializable(working.mesh) !== working.meshHash ||
      preflightPapercraftSource(working.mesh).length
    )
      throw new Error('Accepted mesh cache is invalid.');
    if (
      project.model.mesh &&
      working.preparationHash ===
        papercraftPreparationHash({ mesh: project.model.mesh, settings: record.settings })
    ) {
      const bound = verifySurfaceDeviation(
        project.model.mesh,
        working.mesh,
        record.settings.maximumDeviationMm,
      );
      if (!bound.verified || bound.maximumDeviationMm > working.maximumDeviationMm + EPS_LENGTH_MM)
        throw new Error('Accepted mesh exceeds its source deviation bound.');
    }
  }
  const saved = record.result;
  if (saved) {
    if (
      !isUnfolding(saved.unfolding) ||
      saved.faces.some(
        (f) =>
          f.sourceFaceIndex >= saved.source.faces.length ||
          f.vertexIds.some((i) => i * 3 + 2 >= saved.source.mesh.positionsMm.length),
      ) ||
      saved.source.halfEdges.some((e) => !saved.faces.some((f) => f.id === e.faceId))
    )
      throw new Error('Papercraft result references invalid source entities.');
    const topology = papercraftHalfEdges(saved.source.mesh);
    if (
      preflightPapercraftSource(saved.source.mesh).length ||
      saved.faces.length !== topology.faces.length ||
      saved.source.faces.length !== topology.faces.length ||
      saved.source.halfEdges.length !== topology.halfEdges.length ||
      new Set(saved.hingeKeys).size !== saved.hingeKeys.length
    )
      throw new Error('Papercraft source topology is invalid.');
    const expectedEdges = new Map(topology.halfEdges.map((e) => [e.id, e]));
    for (const edge of saved.source.halfEdges) {
      const expected = expectedEdges.get(edge.id);
      if (
        !expected ||
        expected.faceId !== edge.faceId ||
        expected.startVertex !== edge.startVertex ||
        expected.endVertex !== edge.endVertex ||
        expected.oppositeId !== edge.oppositeId ||
        expected.nextId !== edge.nextId ||
        Math.abs(expected.lengthMm - edge.lengthMm) > EPS_LENGTH_MM ||
        Math.abs((expected.signedDihedralDeg ?? 0) - (edge.signedDihedralDeg ?? 0)) > 1e-6
      )
        throw new Error('Papercraft half-edge differs from source geometry.');
    }
    for (const face of saved.faces) {
      const sourceFace = topology.faces[face.sourceFaceIndex],
        panel = saved.graph.panels.find((p) => p.id === face.id);
      if (
        !sourceFace ||
        sourceFace.id !== face.id ||
        sourceFace.vertexIds.some((id, i) => id !== face.vertexIds[i]) ||
        !panel?.assembledPose
      )
        throw new Error('Papercraft face identity differs from source geometry.');
      for (let i = 0; i < 3; i++) {
        const point = face.points[i]!,
          next = face.points[(i + 1) % 3]!,
          world = meshVertex(saved.source.mesh, face.vertexIds[i]!),
          worldNext = meshVertex(saved.source.mesh, face.vertexIds[(i + 1) % 3]!),
          posed = applyPose(point, panel.assembledPose),
          vertex = panel.vertices.find((v) => v.id === `${face.id}:vertex-${face.vertexIds[i]}`);
        if (
          !vertex ||
          Math.hypot(vertex.x - point.x, vertex.y - point.y) > EPS_LENGTH_MM ||
          Math.abs(
            Math.hypot(next.x - point.x, next.y - point.y) -
              Math.hypot(...world.map((v, k) => v - worldNext[k]!)),
          ) > EPS_LENGTH_MM ||
          Math.hypot(...world.map((v, k) => v - posed[k]!)) > EPS_LENGTH_MM
        )
          throw new Error('Papercraft flat and assembled geometry disagree with the source.');
      }
    }
    const issues = [
      ...validateGraph(saved.graph),
      ...validatePapercraftNet(saved, saved.tabs, saved.graph),
    ];
    if (issues.some((i) => i.severity === 'error'))
      throw new Error('Saved papercraft result fails geometry validation.');
    if (hashSerializable(compileToParts(saved.graph).parts) !== hashSerializable(saved.parts))
      throw new Error('Papercraft compiled parts disagree with graph authority.');
    if (
      project.fabricationMode === 'mesh-unfold' &&
      (hashSerializable(saved.parts) !== hashSerializable(project.generatedParts) ||
        hashSerializable(saved.unfolding) !== hashSerializable(project.unfoldingResult))
    )
      throw new Error('Papercraft compatibility artifacts disagree.');
    // A stale intent is valid to save: retain the last valid result and let currentness block cutting.
    if (saved.inputHash !== saved.graph.source.inputHash)
      throw new Error('Papercraft graph hash disagrees with result.');
    if (
      project.model.mesh &&
      record.settings.sourceMeshHash === hashSerializable(project.model.mesh)
    )
      papercraftInputHash({
        mesh: project.model.mesh,
        settings: record.settings,
        materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
        acceptSimplification: record.acceptSimplification,
        workingSource: record.workingSource,
      });
  }
  return record;
}
