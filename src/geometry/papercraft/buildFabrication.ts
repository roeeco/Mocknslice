import type { DesignFeature, FabricationDesignGraph } from '../../domain/designGraph';
import type {
  PapercraftKernelInput,
  PapercraftKernelResult,
  PapercraftResult,
  PapercraftRunHooks,
  PapercraftTab,
} from '../../domain/papercraft';
import type { MeshUnfoldHinge, MeshUnfoldResult } from '../../domain/unfolding';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import { meshVertex } from '../unfolding/meshAdjacency';
import { poseFromCorrespondence } from '../designGraph/poses';
import { compileToParts } from '../designGraph/compileToParts';
import { flatEdge } from './edgeGeometry';
import { optimizePapercraft } from './optimizeSeams';
import { buildPapercraftTabs, contoursWithTabs } from './tabs';
import { tracePapercraftPerimeter } from './tracePerimeter';
import { uniqueSourceEdges } from './unfoldForest';
import { validatePapercraftNet } from './validateNet';

function normalizeWithTabs(
  kernel: PapercraftKernelResult,
  tabs: PapercraftTab[],
): PapercraftKernelResult {
  const result = structuredClone(kernel);
  for (const island of result.islands) {
    const points = [
        ...result.faces.filter((f) => island.faceIds.includes(f.id)).flatMap((f) => f.points),
        ...tabs
          .filter((t) => t.islandId === island.id && t.status === 'enabled')
          .flatMap((t) => t.outline),
      ],
      x = Math.min(...points.map((p) => p.x)),
      y = Math.min(...points.map((p) => p.y));
    const shift = (p: Point2D) => ({ x: p.x - x, y: p.y - y });
    for (const face of result.faces.filter((f) => island.faceIds.includes(f.id)))
      face.points = face.points.map(shift) as typeof face.points;
    for (const tab of tabs.filter((t) => t.islandId === island.id))
      tab.outline = tab.outline.map(shift) as typeof tab.outline;
  }
  return result;
}
function unfoldBridge(
  result: PapercraftKernelResult,
  tabs: PapercraftTab[],
  graph: FabricationDesignGraph,
  input: PapercraftKernelInput,
): MeshUnfoldResult {
  const byEdge = new Map(result.source.halfEdges.map((e) => [e.id, e])),
    byFace = new Map(result.faces.map((f) => [f.id, f])),
    partOf = (faceId: string) => result.islands.find((i) => i.faceIds.includes(faceId))!;
  const edges = uniqueSourceEdges(result.source),
    seams = edges.filter((e) => !result.hingeKeys.includes(e.edgeKey));
  const hinges: MeshUnfoldHinge[] = [];
  // Parent-before-child order is essential for rigid fold preview.
  for (const island of result.islands) {
    const visited = new Set([island.rootFaceId]),
      queue = [island.rootFaceId];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const edge of result.source.halfEdges.filter(
        (e) => e.faceId === parent && result.hingeKeys.includes(e.edgeKey),
      )) {
        const child = byEdge.get(edge.oppositeId!)!.faceId;
        if (visited.has(child)) continue;
        visited.add(child);
        queue.push(child);
        hinges.push({
          id: `hinge-${edge.edgeKey}`,
          parentFaceId: parent,
          childFaceId: child,
          vertexA: edge.startVertex,
          vertexB: edge.endVertex,
          foldAngleDeg: edge.signedDihedralDeg ?? 0,
        });
      }
    }
  }
  const parts = compileToParts(graph).parts;
  return {
    settings: {
      strategy: 'automatic',
      rootFaceIndex: 0,
      manualSeamKeys: input.settings.edgeEdits
        .filter((e) => e.intent === 'must-cut')
        .map((e) => e.id),
      tabDepthMm: input.settings.tabDefaultDepthMm,
      maximumFaceCount: input.settings.faceTarget,
      searchAttempts: input.settings.maxCandidates,
    },
    faces: result.faces.map((f) => ({
      id: f.id,
      partId: partOf(f.id).id,
      islandIndex: result.islands.indexOf(partOf(f.id)),
      faceIndex: f.sourceFaceIndex,
      sourceVertexIndices: f.vertexIds,
      points2D: f.points,
      flatVerticesMm: f.points.map((p) => [p.x, p.y, 0] as Vector3Mm) as [
        Vector3Mm,
        Vector3Mm,
        Vector3Mm,
      ],
      sourceVerticesMm: f.vertexIds.map((i) => meshVertex(result.source.mesh, i)) as [
        Vector3Mm,
        Vector3Mm,
        Vector3Mm,
      ],
    })),
    edges: edges.map((e) => {
      const opposite = byEdge.get(e.oppositeId!)!,
        seamIndex = seams.indexOf(e);
      return {
        id: `edge-${e.edgeKey}`,
        key: e.edgeKey,
        vertexA: e.startVertex,
        vertexB: e.endVertex,
        faceAIndex: e.faceIndex,
        faceBIndex: opposite.faceIndex,
        disposition: result.hingeKeys.includes(e.edgeKey) ? ('hinge' as const) : ('seam' as const),
        foldDirection:
          (e.signedDihedralDeg ?? 0) >= 0 ? ('mountain' as const) : ('valley' as const),
        dihedralDeg: e.signedDihedralDeg ?? 0,
        ...(seamIndex >= 0 ? { pairLabel: `A:${seamIndex + 1}` } : {}),
      };
    }),
    hinges,
    islands: result.islands.map((i, index) => ({
      id: i.id,
      index,
      partId: i.id,
      faceIds: i.faceIds,
    })),
    overlapPairs: [],
    parts,
    issues: graph.issues,
    algorithmVersion: 'papercraft-v2',
    inputHash: result.inputHash,
    tabs: tabs.map((t) => ({
      id: t.id,
      partId: t.islandId,
      edgeId: `edge-${t.edgeKey}`,
      ownerPanelId: t.ownerFaceId,
      receiverPanelId: t.receiverFaceId,
      style: 'glue',
      depthMm: t.depthMm,
      shoulderAngleDeg: t.shoulderAngleDeg,
      enabled: t.status === 'enabled',
      baseStart: t.outline[0],
      baseEnd: t.outline[3],
      outline: t.outline,
    })),
    connections: edges.map((e) => {
      const opposite = byEdge.get(e.oppositeId!)!,
        tab = tabs.find((t) => t.edgeKey === e.edgeKey),
        joined = result.hingeKeys.includes(e.edgeKey);
      const [a, b] = flatEdge(byFace.get(e.faceId)!, e),
        [c, d] = flatEdge(byFace.get(opposite.faceId)!, opposite);
      return {
        id: `connection-${e.edgeKey}`,
        panelAId: e.faceId,
        panelBId: opposite.faceId,
        edgeA: { start: a, end: b },
        edgeB: { start: c, end: d },
        disposition: joined ? 'hinge' : 'seam',
        closure: joined || tab?.status === 'suppressed' ? 'none' : 'glue-tab',
        required: !joined && tab?.status !== 'suppressed',
        tabIds: tab?.status === 'enabled' ? [tab.id] : [],
      };
    }),
  };
}
export function buildPapercraftFabrication(
  kernel: PapercraftKernelResult,
  input: PapercraftKernelInput,
  hooks: PapercraftRunHooks = {},
): PapercraftResult {
  const tabResult = kernel.issues.some((i) => i.severity === 'error')
      ? { tabs: [], issues: [] }
      : buildPapercraftTabs(kernel, input, hooks),
    tabs = tabResult.tabs;
  const result = normalizeWithTabs(kernel, tabs),
    issues = [...result.issues, ...tabResult.issues],
    features: DesignFeature[] = [];
  const pieceFor = (faceId: string) => result.islands.find((i) => i.faceIds.includes(faceId))!.id;
  const graph: FabricationDesignGraph = {
    schemaVersion: 1,
    units: 'mm',
    source: {
      kind: 'mesh',
      sourceId: result.source.sourceMeshHash,
      algorithmVersion: 'papercraft-v2',
      inputHash: result.inputHash,
    },
    manufacturingStatus: 'validated',
    issues,
    panels: result.faces.map((face) => {
      const vertices = face.points.map((p, i) => ({
        ...p,
        id: `${face.id}:vertex-${face.vertexIds[i]}`,
      }));
      return {
        id: face.id,
        pieceId: pieceFor(face.id),
        name: face.id,
        vertices,
        boundary: vertices.map((v) => v.id),
        holes: [],
        sourceFaceIds: result.source.faces[face.sourceFaceIndex]!.sourceFaceIds,
        materialThicknessMm: input.materialThicknessMm,
        assembledPose: poseFromCorrespondence(
          face.points,
          face.vertexIds.map((i) => meshVertex(result.source.mesh, i)),
        )!,
      };
    }),
    connections: [],
    features,
    pieces: result.islands.map((island, index) => ({
      id: island.id,
      metadata: {
        id: island.id,
        name: `Island ${index + 1}`,
        thicknessMm: input.materialThicknessMm,
        sourceReference: result.source.sourceMeshHash,
        unfolding: { islandIndex: index, faceIds: island.faceIds },
      },
      pathIds: [],
      labelIds: [],
      labelsPresent: true,
    })),
  };
  const add = (feature: DesignFeature) => {
    features.push(feature);
    const piece = graph.pieces.find((p) => p.id === feature.pieceId)!;
    if (feature.path) piece.pathIds.push(feature.id);
    if (feature.label) piece.labelIds.push(feature.id);
  };
  for (const island of result.islands) {
    const faces = result.faces.filter((f) => island.faceIds.includes(f.id)),
      contours = tracePapercraftPerimeter(result.source, faces, result.hingeKeys);
    if (!contours) continue;
    const loops = contoursWithTabs(contours, tabs);
    for (let i = 0; i < loops.length; i++) {
      const id = `${island.id}:contour-${i}`;
      add({
        id,
        pieceId: island.id,
        kind: contours[i]!.hole ? 'hole' : 'contour',
        operation: 'cut',
        geometry2D: loops[i]!,
        path: {
          id,
          operation: 'cut',
          closed: true,
          contourRole: contours[i]!.hole ? 'hole' : 'outer',
        },
      });
    }
  }
  const byEdge = new Map(result.source.halfEdges.map((e) => [e.id, e])),
    byFace = new Map(result.faces.map((f) => [f.id, f])),
    edges = uniqueSourceEdges(result.source);
  let seamNumber = 0;
  for (const edge of edges) {
    const opposite = byEdge.get(edge.oppositeId!)!,
      joined = result.hingeKeys.includes(edge.edgeKey),
      tab = tabs.find((t) => t.edgeKey === edge.edgeKey),
      [a, b] = flatEdge(byFace.get(edge.faceId)!, edge);
    const id = `connection-${edge.edgeKey}`;
    graph.connections.push({
      id,
      panelAId: edge.faceId,
      panelBId: opposite.faceId,
      edgeA: {
        a: `${edge.faceId}:vertex-${edge.startVertex}`,
        b: `${edge.faceId}:vertex-${edge.endVertex}`,
      },
      edgeB: {
        a: `${opposite.faceId}:vertex-${opposite.startVertex}`,
        b: `${opposite.faceId}:vertex-${opposite.endVertex}`,
      },
      treatment: joined ? 'hinge' : 'seam',
      flatJoined: joined,
      foldAngleDeg: edge.signedDihedralDeg ?? 0,
      closure: joined || tab?.status === 'suppressed' ? 'none' : 'glue-tab',
      ...(!joined && tab ? { tabOwnerPanelId: tab.ownerFaceId } : {}),
      required: !joined && tab?.status !== 'suppressed',
    });
    if (joined && !(edge.softCoplanar && Math.abs(edge.signedDihedralDeg ?? 0) < 2)) {
      const operation = (edge.signedDihedralDeg ?? 0) >= 0 ? 'mountain-fold' : 'valley-fold',
        pathId = `crease-${edge.edgeKey}`;
      add({
        id: pathId,
        pieceId: pieceFor(edge.faceId),
        hostPanelId: edge.faceId,
        kind: 'score',
        operation,
        geometry2D: [a, b],
        path: {
          id: pathId,
          operation,
          closed: false,
          panelId: edge.faceId,
          edgeId: `edge-${edge.edgeKey}`,
        },
      });
    }
    if (!joined) {
      seamNumber++;
      for (const half of [edge, opposite]) {
        const [start, end] = flatEdge(byFace.get(half.faceId)!, half),
          length = half.lengthMm,
          anchor = {
            x: (start.x + end.x) / 2 - ((end.y - start.y) / length) * 2,
            y: (start.y + end.y) / 2 + ((end.x - start.x) / length) * 2,
          },
          labelId = `seam-label-${half.id}`;
        add({
          id: labelId,
          pieceId: pieceFor(half.faceId),
          hostPanelId: half.faceId,
          kind: 'guide',
          operation: 'guide',
          geometry2D: [anchor],
          label: {
            id: labelId,
            text: `A:${seamNumber}`,
            operation: 'guide',
            entityId: `edge-${edge.edgeKey}`,
            fontSizeMm: 2,
          },
        });
      }
    }
  }
  for (const tab of tabs)
    if (tab.status === 'enabled') {
      const id = `tab-base-${tab.edgeKey}`;
      add({
        id: tab.id,
        pieceId: tab.islandId,
        hostPanelId: tab.ownerFaceId,
        kind: 'tab',
        operation: 'guide',
        geometry2D: tab.outline,
      });
      add({
        id,
        pieceId: tab.islandId,
        hostPanelId: tab.ownerFaceId,
        kind: 'score',
        operation: 'score',
        geometry2D: [tab.outline[0], tab.outline[3]],
        path: {
          id,
          operation: 'score',
          closed: false,
          tabId: tab.id,
          edgeId: `edge-${tab.edgeKey}`,
          panelId: tab.ownerFaceId,
        },
      });
    }
  graph.issues = validatePapercraftNet(result, tabs, graph);
  if (graph.issues.some((i) => i.severity === 'error'))
    graph.manufacturingStatus = 'legacy-unverified';
  const parts = compileToParts(graph).parts,
    unfolding = result.faces.length
      ? unfoldBridge(result, tabs, graph, input)
      : {
          settings: {
            strategy: 'automatic' as const,
            rootFaceIndex: 0,
            manualSeamKeys: [],
            tabDepthMm: input.settings.tabDefaultDepthMm,
            maximumFaceCount: input.settings.faceTarget,
            searchAttempts: input.settings.maxCandidates,
          },
          faces: [],
          edges: [],
          hinges: [],
          islands: [],
          connections: [],
          tabs: [],
          overlapPairs: [],
          parts: [],
          issues: graph.issues,
          algorithmVersion: 'papercraft-v2',
          inputHash: result.inputHash,
        };
  return { ...result, issues: graph.issues, tabs, graph, parts, unfolding };
}
export function generatePapercraft(
  input: PapercraftKernelInput,
  hooks: PapercraftRunHooks = {},
): PapercraftResult {
  const kernel = optimizePapercraft(input, {
    ...hooks,
    progress: (progress) => {
      if (progress.stage !== 'completed') hooks.progress?.(progress);
    },
  });
  if (hooks.cancelled?.())
    throw new DOMException('Papercraft calculation cancelled.', 'AbortError');
  hooks.progress?.({ stage: 'tabs', done: 0, total: kernel.islands.length });
  const result = buildPapercraftFabrication(kernel, input, hooks);
  hooks.progress?.({ stage: 'tabs', done: kernel.islands.length, total: kernel.islands.length });
  hooks.progress?.({ stage: 'completed', done: 1, total: 1 });
  return result;
}
