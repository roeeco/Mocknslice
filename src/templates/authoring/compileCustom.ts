import type {
  FabricationDesignGraph,
  DesignPanel,
  DesignConnection,
} from '../../domain/designGraph';
import type { FabricationPart } from '../../domain/fabrication';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import type { FoldTemplateInput } from '../../geometry/folding/generateFoldTemplate';
import { generateFoldTemplate } from '../../geometry/folding/generateFoldTemplate';
import { booleanPerimeter } from '../../geometry/designGraph/booleanPerimeter';
import { applyPose, poseFromCorrespondence } from '../../geometry/designGraph/poses';
import { makeLegacyPanel } from '../../geometry/designGraph/adapterHelpers';
import { legacyManufacturingFeatures } from '../../geometry/designGraph/legacyFeatures';
import { compileToParts } from '../../geometry/designGraph/compileToParts';
import { assembleGraph } from '../../geometry/designGraph/assembleGraph';
import { validateGraph } from '../../geometry/designGraph/validateGraph';
import { canonicalizeContours } from '../../geometry/output/canonicalizeContours';
import { positivePolygonOverlap } from '../../geometry/papercraft/intersection';
import { glueTabOutline } from '../../geometry/connections/topology2d';
import { signedArea, pointInPolygon } from '../../geometry/designGraph/polygons';
import { evaluateExpression } from './expression';
import { resolveAuthorValues } from './validate';
import type { UserTemplateDefinition, SavedTemplateInstance } from './types';
import { hashSerializable } from '../../domain/canonicalHash';
const flatWorld = (p: Point2D): Vector3Mm => [p.x, 0, -p.y];
export function rotateAroundAxis(
  point: Vector3Mm,
  a: Vector3Mm,
  b: Vector3Mm,
  degrees: number,
): Vector3Mm {
  const l = Math.hypot(...b.map((v, i) => v - a[i]!));
  if (l < 1e-6) throw new Error('Cannot fold a zero-length axis.');
  const u = b.map((v, i) => (v - a[i]!) / l),
    p = point.map((v, i) => v - a[i]!);
  const c = Math.cos((degrees * Math.PI) / 180),
    s = Math.sin((degrees * Math.PI) / 180),
    dot = u.reduce((sum, v, i) => sum + v * p[i]!, 0);
  const cross = [
    u[1]! * p[2]! - u[2]! * p[1]!,
    u[2]! * p[0]! - u[0]! * p[2]!,
    u[0]! * p[1]! - u[1]! * p[0]!,
  ];
  return p.map((v, i) => a[i]! + v * c + cross[i]! * s + u[i]! * dot * (1 - c)) as Vector3Mm;
}
export function compileCustomTemplate(
  input: FoldTemplateInput,
  definition: Extract<UserTemplateDefinition, { kind: 'custom' }>,
  instance: SavedTemplateInstance,
) {
  const values = resolveAuthorValues(definition, instance.values),
    evaluate = (e: Parameters<typeof evaluateExpression>[0]) => evaluateExpression(e, values);
  const loops = new Map(
    definition.panels.map((p) => [
      p.id,
      p.outline.map((q) => ({ x: evaluate(q.x), y: evaluate(q.y) })),
    ]),
  );
  const roots = new Map(definition.panels.map((p) => [p.id, p.id]));
  const root = (id: string): string => (roots.get(id) === id ? id : root(roots.get(id)!));
  for (const hinge of definition.hinges) {
    const a = root(hinge.panelA),
      b = root(hinge.panelB);
    if (a === b) throw new Error('Custom hinges must form a forest.');
    roots.set(b, a);
  }
  const panels: DesignPanel[] = definition.panels.map((p) =>
    makeLegacyPanel(
      { id: p.id, partId: `custom-piece-${root(p.id)}`, name: p.name, outline: loops.get(p.id)! },
      input.materialThicknessMm,
      undefined,
      p.holes.map((loop) => loop.map((q) => ({ x: evaluate(q.x), y: evaluate(q.y) }))),
    ),
  );
  const byId = new Map(panels.map((p) => [p.id, p]));
  const connections: DesignConnection[] = definition.hinges.map((h) => {
    const a = byId.get(h.panelA)!,
      b = byId.get(h.panelB)!;
    return {
      id: h.id,
      panelAId: a.id,
      panelBId: b.id,
      edgeA: { a: a.boundary[h.edgeA]!, b: a.boundary[(h.edgeA + 1) % a.boundary.length]! },
      edgeB: { a: b.boundary[h.edgeB]!, b: b.boundary[(h.edgeB + 1) % b.boundary.length]! },
      treatment: 'hinge',
      flatJoined: true,
      foldAngleDeg: evaluate(h.angleDeg),
      closure: 'none',
      required: true,
    };
  });
  // Root pose and child poses are rigid numeric matrices, independent of renderer objects.
  for (const component of new Set(panels.map((p) => root(p.id)))) {
    const first = byId.get(component)!,
      outline = loops.get(first.id)!;
    first.assembledPose = poseFromCorrespondence(outline, outline.map(flatWorld))!;
    const visited = new Set([first.id]),
      queue = [first.id];
    while (queue.length) {
      const parent = byId.get(queue.shift()!)!;
      for (const h of definition.hinges.filter(
        (x) => x.panelA === parent.id || x.panelB === parent.id,
      )) {
        const childId = h.panelA === parent.id ? h.panelB : h.panelA;
        if (visited.has(childId)) continue;
        const source = loops.get(h.panelA)!,
          start = source[h.edgeA]!,
          end = source[(h.edgeA + 1) % source.length]!;
        const a = applyPose(start, parent.assembledPose!),
          b = applyPose(end, parent.assembledPose!);
        const child = byId.get(childId)!,
          loop = loops.get(child.id)!,
          angle = evaluate(h.angleDeg) * (h.panelA === parent.id ? 1 : -1);
        child.assembledPose = poseFromCorrespondence(
          loop,
          loop.map((p) => rotateAroundAxis(applyPose(p, parent.assembledPose!), a, b, angle)),
        )!;
        visited.add(childId);
        queue.push(childId);
      }
    }
  }
  const tabs = definition.tabs.map((t) => {
    const panel = byId.get(t.panelId)!,
      loop = loops.get(panel.id)!,
      start = loop[t.edge]!,
      end = loop[(t.edge + 1) % loop.length]!,
      depth = evaluate(t.depthMm);
    if (
      depth < Math.max(1, 1.5 * input.materialThicknessMm) ||
      depth > Math.min(15, 0.4 * Math.hypot(end.x - start.x, end.y - start.y))
    )
      throw new Error('Tab depth exceeds physical edge or stock bounds.');
    if (
      definition.hinges.some(
        (h) =>
          (h.panelA === panel.id && h.edgeA === t.edge) ||
          (h.panelB === panel.id && h.edgeB === t.edge),
      )
    )
      throw new Error('Tabs cannot occupy an active hinge.');
    return {
      id: t.id,
      partId: panel.pieceId,
      edgeId: `${t.id}-base`,
      ownerPanelId: panel.id,
      style: 'glue' as const,
      depthMm: depth,
      shoulderAngleDeg: 20,
      enabled: true,
      baseStart: start,
      baseEnd: end,
      outline: glueTabOutline(start, end, depth),
      ...(t.receiverPanelId ? { receiverPanelId: t.receiverPanelId } : {}),
    };
  });
  for (const tab of tabs.filter((t) => t.receiverPanelId)) {
    const owner = byId.get(tab.ownerPanelId)!,
      receiver = byId.get(tab.receiverPanelId!)!;
    const a = applyPose(tab.baseStart, owner.assembledPose!),
      b = applyPose(tab.baseEnd, owner.assembledPose!);
    const near = (x: Vector3Mm, y: Vector3Mm) => Math.hypot(...x.map((v, i) => v - y[i]!)) <= 0.05;
    const receiverLoop = loops.get(receiver.id)!;
    const index = receiverLoop.findIndex((p, i) => {
      const c = applyPose(p, receiver.assembledPose!),
        d = applyPose(receiverLoop[(i + 1) % receiverLoop.length]!, receiver.assembledPose!);
      return (near(a, c) && near(b, d)) || (near(a, d) && near(b, c));
    });
    if (index < 0) throw new Error('Tab receiver has no matching assembled closure edge.');
    const ownerIndex = loops
      .get(owner.id)!
      .findIndex((p) => Math.hypot(p.x - tab.baseStart.x, p.y - tab.baseStart.y) <= 1e-6);
    connections.push({
      id: `${tab.id}-seam`,
      panelAId: owner.id,
      panelBId: receiver.id,
      edgeA: {
        a: owner.boundary[ownerIndex]!,
        b: owner.boundary[(ownerIndex + 1) % owner.boundary.length]!,
      },
      edgeB: {
        a: receiver.boundary[index]!,
        b: receiver.boundary[(index + 1) % receiver.boundary.length]!,
      },
      treatment: 'seam',
      flatJoined: false,
      closure: 'glue-tab',
      tabOwnerPanelId: owner.id,
      required: true,
    });
  }
  const parts: FabricationPart[] = [];
  for (const pieceId of new Set(panels.map((p) => p.pieceId))) {
    const group = panels.filter((p) => p.pieceId === pieceId),
      additions = [
        ...group.map((p) => loops.get(p.id)!),
        ...tabs.filter((t) => t.partId === pieceId).map((t) => t.outline),
      ];
    for (let i = 0; i < additions.length; i++)
      for (let j = i + 1; j < additions.length; j++)
        if (positivePolygonOverlap(additions[i]!, additions[j]!))
          throw new Error('Custom panels or tabs overlap in the flat piece.');
    const holes = group.flatMap((p) =>
      p.holes.map((ids) => ids.map((id) => p.vertices.find((v) => v.id === id)!)),
    );
    const contours = booleanPerimeter(additions, holes);
    if (!contours || contours.filter((p) => signedArea(p) > 0).length !== 1)
      throw new Error('Custom piece has an invalid material perimeter.');
    for (const mark of definition.marks.filter((m) => group.some((p) => p.id === m.panelId)))
      if (
        !pointInPolygon(
          { x: evaluate(mark.point.x), y: evaluate(mark.point.y) },
          loops.get(mark.panelId)!,
        )
      )
        throw new Error('Label lies outside its host panel.');
    parts.push({
      id: pieceId,
      name: definition.names.en,
      thicknessMm: input.materialThicknessMm,
      sourceReference: definition.id,
      paths: [
        ...contours.map((points, i) => ({
          id: `${pieceId}-contour-${i}`,
          operation: 'cut' as const,
          closed: true,
          contourRole: signedArea(points) > 0 ? ('outer' as const) : ('hole' as const),
          points,
        })),
        ...definition.hinges
          .filter((h) => group.some((p) => p.id === h.panelA))
          .map((h) => ({
            id: `${h.id}-score`,
            operation: 'score' as const,
            closed: false,
            panelId: h.panelA,
            edgeId: h.id,
            points: [
              loops.get(h.panelA)![h.edgeA]!,
              loops.get(h.panelA)![(h.edgeA + 1) % loops.get(h.panelA)!.length]!,
            ],
          })),
        ...tabs
          .filter((t) => t.partId === pieceId)
          .map((t) => ({
            id: `${t.id}-score`,
            operation: 'score' as const,
            closed: false,
            points: [t.baseStart, t.baseEnd],
            panelId: t.ownerPanelId,
            tabId: t.id,
          })),
      ],
      labels: definition.marks
        .filter((m) => group.some((p) => p.id === m.panelId))
        .map((m) => ({
          id: m.id,
          text: m.text,
          entityId: m.panelId,
          position: { x: evaluate(m.point.x), y: evaluate(m.point.y) },
          operation: 'engrave' as const,
        })),
    });
  }
  for (const tab of tabs)
    parts
      .find((p) => p.id === tab.partId)!
      .paths.push({
        id: `${tab.id}-outline-guide`,
        operation: 'guide',
        closed: true,
        points: tab.outline,
        panelId: tab.ownerPanelId,
        tabId: tab.id,
      });
  const canonical = canonicalizeContours(parts),
    inputHash = hashSerializable({ mode: 'fold-template', payload: input });
  const graph: FabricationDesignGraph = {
    schemaVersion: 1,
    units: 'mm',
    source: {
      kind: 'template',
      sourceId: definition.id,
      algorithmVersion: 'custom-template-v1',
      inputHash,
    },
    panels,
    connections,
    ...legacyManufacturingFeatures(canonical.parts),
    issues: canonical.issues,
    manufacturingStatus: 'validated',
  };
  const issues = [...canonical.issues, ...validateGraph(graph)];
  if (issues.some((i) => i.severity === 'error'))
    throw new Error(issues.find((i) => i.severity === 'error')!.message);
  const seed = generateFoldTemplate({
    ...input,
    settings: {
      ...input.settings,
      templateKind: 'open-box',
      parameters: { ...input.settings.parameters, standalone: true },
      connectionOverrides: [],
      boundaryGlueTabs: [],
    },
  });
  return {
    ...seed,
    panels: panels.map((p) => ({
      id: p.id,
      partId: p.pieceId,
      name: p.name,
      role: 'face' as const,
      outline: loops.get(p.id)!,
    })),
    tabs,
    connections: definition.hinges.map((h) => ({
      id: h.id,
      panelAId: h.panelA,
      panelBId: h.panelB,
      edgeA: {
        start: loops.get(h.panelA)![h.edgeA]!,
        end: loops.get(h.panelA)![(h.edgeA + 1) % loops.get(h.panelA)!.length]!,
      },
      edgeB: {
        start: loops.get(h.panelB)![h.edgeB]!,
        end: loops.get(h.panelB)![(h.edgeB + 1) % loops.get(h.panelB)!.length]!,
      },
      disposition: 'hinge' as const,
      closure: 'none' as const,
      required: true,
      tabIds: [],
    })),
    edges: [],
    editableEdges: [],
    parts: compileToParts(graph).parts,
    assembledPreview: { panels: assembleGraph(graph).panels },
    issues,
    algorithmVersion: 'custom-template-v1',
    inputHash,
    graph,
  };
}
