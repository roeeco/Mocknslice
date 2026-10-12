import type { FoldTemplateInput } from '../geometry/folding/generateFoldTemplate';
import { generateRegisteredTemplate } from './registry';
import { booleanPerimeter } from '../geometry/designGraph/booleanPerimeter';
import { fromLegacyFoldResult } from '../geometry/designGraph/fromLegacyFoldResult';
import { compileToParts } from '../geometry/designGraph/compileToParts';
import { validateGraph } from '../geometry/designGraph/validateGraph';
import {
  cleanClosedLoop,
  canonicalizeContours,
  outputIssue,
} from '../geometry/output/canonicalizeContours';
import {
  sameSegment,
  layoutCreaseComponents,
  transformPoint,
  glueTabOutline,
} from '../geometry/connections/topology2d';
import { signedArea } from '../geometry/designGraph/polygons';
import { positivePolygonOverlap } from '../geometry/papercraft/intersection';
import { hashSerializable } from '../domain/canonicalHash';
import { compileCustomTemplate } from './authoring/compileCustom';
import { parseTemplateDefinition, authorInstance } from './authoring/validate';
export function generateNativeTemplate(input: FoldTemplateInput) {
  if (input.definition) {
    const definition = parseTemplateDefinition(input.definition);
    const instance = authorInstance(definition, input.instance?.values);
    if (
      !input.instance ||
      instance.definitionHash !== input.instance.definitionHash ||
      instance.templateId !== input.instance.templateId ||
      instance.templateVersion !== input.instance.templateVersion
    )
      throw new Error('Template definition version/hash does not match the saved instance.');
    if (definition.kind === 'custom') return compileCustomTemplate(input, definition, instance);
  }
  const result = generateRegisteredTemplate(input);
  if (result.tabs.some((tab) => tab.style === 'press-fit'))
    return {
      ...result,
      algorithmVersion: 'legacy-press-fit-inspection-v1',
      issues: [
        ...result.issues,
        outputIssue(
          'TEMPLATE_PRESS_FIT_UNVERIFIED',
          [],
          'Press-fit slits retain their original inspection geometry. Physical receiver verification is required before production.',
          'warning',
        ),
      ],
      graph: undefined,
    };

  if (result.parts.some((part) => !result.panels.some((panel) => panel.partId === part.id))) {
    const layout = layoutCreaseComponents(
      result.panels,
      result.connections
        .filter((c) => c.disposition === 'hinge')
        .map((c) => ({
          ...c,
          edgeB: sameSegment(c.edgeA.start, c.edgeA.end, c.edgeB.start, c.edgeB.end)
            ? { start: c.edgeB.end, end: c.edgeB.start }
            : c.edgeB,
        })),
    );
    const partFor = (id: string) =>
      result.parts.find((part) => part.folding?.panelIds.includes(id));
    for (const connection of result.connections) {
      const a = layout.transforms.get(connection.panelAId)!,
        b = layout.transforms.get(connection.panelBId)!;
      connection.edgeA = {
        start: transformPoint(connection.edgeA.start, a),
        end: transformPoint(connection.edgeA.end, a),
      };
      connection.edgeB = {
        start: transformPoint(connection.edgeB.start, b),
        end: transformPoint(connection.edgeB.end, b),
      };
    }
    for (const edge of result.edges) {
      const transform = layout.transforms.get(edge.panelAId);
      if (transform) {
        edge.start = transformPoint(edge.start, transform);
        edge.end = transformPoint(edge.end, transform);
        edge.partId = partFor(edge.panelAId)?.id ?? edge.partId;
      }
    }
    for (const panel of result.panels) {
      panel.outline = panel.outline.map((point) =>
        transformPoint(point, layout.transforms.get(panel.id)!),
      );
      panel.partId = partFor(panel.id)?.id ?? panel.partId;
    }
    for (const panel of result.assembledPreview.panels)
      panel.partId = partFor(panel.id)?.id ?? panel.partId;
  }
  const roundPoint = (p: { x: number; y: number }) => ({
    x: Math.round(p.x * 1e6) / 1e6,
    y: Math.round(p.y * 1e6) / 1e6,
  });
  for (const panel of result.panels) panel.outline = cleanClosedLoop(panel.outline.map(roundPoint));
  for (const part of result.parts)
    for (const path of part.paths) path.points = path.points.map(roundPoint);
  for (const connection of result.connections) {
    connection.edgeA.start = roundPoint(connection.edgeA.start);
    connection.edgeA.end = roundPoint(connection.edgeA.end);
    connection.edgeB.start = roundPoint(connection.edgeB.start);
    connection.edgeB.end = roundPoint(connection.edgeB.end);
  }
  for (const tab of result.tabs) {
    tab.baseStart = roundPoint(tab.baseStart);
    tab.baseEnd = roundPoint(tab.baseEnd);
  }
  for (const tab of result.tabs) tab.outline = cleanClosedLoop(tab.outline);
  for (const panel of result.assembledPreview.panels) {
    if (
      panel.verticesMm.length > 3 &&
      Math.hypot(...panel.verticesMm[0]!.map((v, i) => v - panel.verticesMm.at(-1)![i]!)) < 1e-6
    )
      panel.verticesMm = panel.verticesMm.slice(0, -1);
  }
  // The legacy cap validator runs per piece. Native validation resolves references against all panels.
  result.issues = result.issues.filter(
    (issue) =>
      !(
        issue.code === 'FOLD_CONNECTION_PANEL_MISSING' &&
        issue.affectedEntityIds.every(
          (id) =>
            result.panels.some((p) => p.id === id) ||
            result.connections.some(
              (c) =>
                c.id === id &&
                result.panels.some((p) => p.id === c.panelAId) &&
                result.panels.some((p) => p.id === c.panelBId),
            ),
        )
      ),
  );
  const acceptedTabs: typeof result.tabs = [];
  for (const tab of result.tabs.filter((t) => t.enabled)) {
    const owner = result.panels.find((p) => p.id === tab.ownerPanelId);
    const receiver = result.panels.find((p) => p.id === tab.receiverPanelId);
    if (!owner || (tab.receiverPanelId && !receiver)) {
      result.issues.push(
        outputIssue(
          'TEMPLATE_TAB_REFERENCE_INVALID',
          [tab.id],
          'Tab references an unavailable owner or receiver.',
        ),
      );
      continue;
    }
    let fitted = false;
    const length = Math.hypot(tab.baseEnd.x - tab.baseStart.x, tab.baseEnd.y - tab.baseStart.y),
      floor = Math.max(1, 1.5 * input.materialThicknessMm);
    for (let depth = Math.min(tab.depthMm, 0.4 * length, 15); depth >= floor - 1e-6; depth -= 0.5) {
      for (const reversed of [false, true]) {
        const outline = glueTabOutline(
          reversed ? tab.baseEnd : tab.baseStart,
          reversed ? tab.baseStart : tab.baseEnd,
          depth,
        );
        if (
          result.panels
            .filter((p) => p.partId === tab.partId)
            .some((p) => positivePolygonOverlap(outline, p.outline)) ||
          acceptedTabs
            .filter((t) => t.partId === tab.partId)
            .some((t) => positivePolygonOverlap(outline, t.outline))
        )
          continue;
        if (receiver) {
          const xs = receiver.outline.map((p) => p.x),
            ys = receiver.outline.map((p) => p.y);
          if (
            depth >
            Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) -
              input.materialThicknessMm
          )
            continue;
        }
        tab.outline = outline;
        tab.depthMm = depth;
        acceptedTabs.push(tab);
        fitted = true;
        break;
      }
      if (fitted) break;
    }
    if (!fitted)
      result.issues.push(
        outputIssue(
          'TEMPLATE_TAB_UNRESOLVED',
          [tab.id],
          'Required tab cannot fit without intersecting the flat net.',
        ),
      );
  }
  for (const part of result.parts) {
    const panels = result.panels.filter((p) => p.partId === part.id),
      tabs = result.tabs.filter((t) => t.partId === part.id && t.enabled);
    const additions = [...panels.map((p) => p.outline), ...tabs.map((t) => t.outline)];
    for (let i = 0; i < additions.length; i++)
      for (let j = i + 1; j < additions.length; j++)
        if (positivePolygonOverlap(additions[i]!, additions[j]!))
          result.issues.push(
            outputIssue(
              'TEMPLATE_FLAT_OVERLAP',
              [part.id],
              'Panels or tabs overlap in the cutting net.',
            ),
          );
    const holes = part.paths.filter(
      (p) => p.operation === 'cut' && p.closed && p.contourRole === 'hole',
    );
    const loops = booleanPerimeter(
      additions,
      holes.map((p) => p.points),
    );
    if (!loops || loops.filter((p) => signedArea(p) > 0).length !== 1) {
      result.issues.push(
        outputIssue(
          'TEMPLATE_CONTOUR_INVALID',
          [part.id],
          'Template material boundary could not be verified.',
        ),
      );
      continue;
    }
    part.paths = [
      ...loops.map((points, index) => ({
        id: `${part.id}-physical-contour-${index}`,
        operation: 'cut' as const,
        closed: true,
        contourRole: signedArea(points) > 0 ? ('outer' as const) : ('hole' as const),
        points,
      })),
      ...part.paths
        .filter((p) => !(p.operation === 'cut' && p.closed))
        .map((p) => (p.operation === 'cut' ? { ...p, operation: 'guide' as const } : p)),
    ];
  }
  const canonical = canonicalizeContours(result.parts);
  result.parts = canonical.parts;
  result.issues.push(...canonical.issues);
  result.algorithmVersion = 'native-template-v2';
  result.inputHash = hashSerializable({ mode: 'fold-template', payload: input });
  const graph = fromLegacyFoldResult(result);
  for (const panel of graph.panels) {
    const loop = panel.boundary.map((id) => panel.vertices.find((v) => v.id === id)!);
    if (signedArea(loop) < 0) panel.boundary.reverse();
  }
  graph.manufacturingStatus = result.issues.some((i) => i.severity === 'error')
    ? 'legacy-unverified'
    : 'validated';
  const issues = validateGraph(graph);
  result.issues.push(...issues.filter((i) => !result.issues.some((old) => old.id === i.id)));
  return { ...result, parts: compileToParts(graph).parts, graph };
}
