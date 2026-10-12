import { flatEdge } from './edgeGeometry';
import { uniqueSourceEdges } from './unfoldForest';
import type { PapercraftKernelResult, PapercraftTab } from '../../domain/papercraft';
import type { FabricationDesignGraph } from '../../domain/designGraph';
import { validateGraph } from '../designGraph/validateGraph';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from '../designGraph/tolerances';
import { signedArea, isSimplePolygon } from '../designGraph/polygons';
import { positivePolygonOverlap } from './intersection';
import { papercraftIssue } from './prepareSource';
import { tracePapercraftPerimeter } from './tracePerimeter';
import { contoursWithTabs } from './tabs';

export function validatePapercraftNet(
  result: PapercraftKernelResult,
  tabs: readonly PapercraftTab[],
  graph: FabricationDesignGraph,
) {
  const issues = validateGraph(graph);
  for (const island of result.islands) {
    const faces = result.faces.filter((f) => island.faceIds.includes(f.id)),
      enabled = tabs.filter((t) => t.islandId === island.id && t.status === 'enabled');
    const contours = tracePapercraftPerimeter(result.source, faces, result.hingeKeys);
    if (!contours) {
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_PERIMETER_INVALID',
          [island.id],
          'Island boundary has a branch, self intersection or ambiguous contact.',
        ),
      );
      continue;
    }
    const loops = contoursWithTabs(contours, enabled);
    if (!loops.every(isSimplePolygon))
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_PERIMETER_INVALID',
          [island.id],
          'Tab perimeter is not simple.',
        ),
      );
    const materialArea =
        faces.reduce((sum, f) => sum + signedArea(f.points), 0) +
        enabled.reduce((sum, t) => sum + signedArea(t.outline), 0),
      cutArea = loops.reduce((sum, p) => sum + signedArea(p), 0);
    // Accumulation tolerance covers floating arithmetic only, never accepts geometric overlap.
    if (
      Math.abs(materialArea - cutArea) >
      Math.max(EPS_AREA_MM2, Math.abs(materialArea) * Number.EPSILON * 128)
    )
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_AREA_MISMATCH',
          [island.id],
          'Cut contours do not match face and tab material area.',
        ),
      );
    for (let i = 0; i < faces.length; i++)
      for (let j = i + 1; j < faces.length; j++)
        if (positivePolygonOverlap(faces[i]!.points, faces[j]!.points))
          issues.push(
            papercraftIssue(
              'PAPERCRAFT_FACE_OVERLAP',
              [faces[i]!.id, faces[j]!.id],
              'Unfolded faces have positive-area overlap.',
            ),
          );
    for (let i = 0; i < enabled.length; i++) {
      const tab = enabled[i]!;
      if (
        tab.depthMm <= 0 ||
        faces.some((f) => positivePolygonOverlap(f.points, tab.outline)) ||
        enabled.slice(0, i).some((t) => positivePolygonOverlap(t.outline, tab.outline))
      )
        issues.push(
          papercraftIssue(
            'PAPERCRAFT_TAB_OVERLAP',
            [tab.id],
            'Enabled tab collides with face or tab material.',
          ),
        );
    }
    const paths = graph.features.filter(
      (f) => f.pieceId === island.id && f.operation === 'cut' && f.path,
    );
    if (
      paths.filter((p) => p.path!.contourRole === 'outer').length !== 1 ||
      paths.some((p) => !p.path!.closed)
    )
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_CUT_TOPOLOGY',
          [island.id],
          'Every physical island needs exactly one closed exterior cut contour.',
        ),
      );
    const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y) <= EPS_LENGTH_MM;
    const sameLoop = (expected: (typeof loops)[number], actual: (typeof loops)[number]) =>
      expected.length === actual.length &&
      actual.some(
        (point, offset) =>
          near(point, expected[0]!) &&
          expected.every((p, i) => near(p, actual[(offset + i) % actual.length]!)),
      );
    if (
      paths.length !== loops.length ||
      loops.some((loop) => !paths.some((path) => sameLoop(loop, path.geometry2D)))
    )
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_PERIMETER_MISMATCH',
          [island.id],
          'Compiled contour differs from the physical face and tab perimeter.',
        ),
      );
    const expectedLength = loops.reduce(
      (sum, loop) =>
        sum +
        loop.reduce((s, a, i) => {
          const b = loop[(i + 1) % loop.length]!;
          return s + Math.hypot(a.x - b.x, a.y - b.y);
        }, 0),
      0,
    );
    const actualLength = paths.reduce(
      (sum, p) =>
        sum +
        p.geometry2D.reduce((s, a, i) => {
          const b = p.geometry2D[(i + 1) % p.geometry2D.length]!;
          return s + Math.hypot(a.x - b.x, a.y - b.y);
        }, 0),
      0,
    );
    if (Math.abs(expectedLength - actualLength) > EPS_LENGTH_MM)
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_LENGTH_MISMATCH',
          [island.id],
          'Physical cut boundary length differs from compiled geometry.',
        ),
      );
  }
  for (const edge of uniqueSourceEdges(result.source)) {
    const connection = graph.connections.find((c) => c.id === `connection-${edge.edgeKey}`),
      joined = result.hingeKeys.includes(edge.edgeKey),
      tab = tabs.find((t) => t.edgeKey === edge.edgeKey);
    if (!connection || connection.flatJoined !== joined || connection.panelAId !== edge.faceId)
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_CONNECTION_MISMATCH',
          [edge.edgeKey],
          'Connection disagrees with the generated seam forest.',
        ),
      );
    if (
      !joined &&
      connection?.required &&
      (!tab ||
        tab.status !== 'enabled' ||
        connection.tabOwnerPanelId !== tab.ownerFaceId ||
        !graph.features.some((f) => f.id === tab.id && f.kind === 'tab'))
    )
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_TAB_UNRESOLVED',
          [edge.edgeKey],
          'Required closure has no enabled owned tab.',
        ),
      );
    if (joined && Math.abs(edge.signedDihedralDeg ?? 0) > 1e-6) {
      const face = result.faces.find((f) => f.id === edge.faceId)!,
        [a, b] = flatEdge(face, edge);
      const score = graph.features.filter(
        (f) =>
          f.path?.edgeId === `edge-${edge.edgeKey}` &&
          ['score', 'mountain-fold', 'valley-fold'].includes(f.operation),
      );
      if (
        score.length !== 1 ||
        score[0]!.geometry2D.length !== 2 ||
        Math.min(
          Math.hypot(a.x - score[0]!.geometry2D[0]!.x, a.y - score[0]!.geometry2D[0]!.y) +
            Math.hypot(b.x - score[0]!.geometry2D[1]!.x, b.y - score[0]!.geometry2D[1]!.y),
          Math.hypot(a.x - score[0]!.geometry2D[1]!.x, a.y - score[0]!.geometry2D[1]!.y) +
            Math.hypot(b.x - score[0]!.geometry2D[0]!.x, b.y - score[0]!.geometry2D[0]!.y),
        ) >
          EPS_LENGTH_MM * 2
      )
        issues.push(
          papercraftIssue(
            'PAPERCRAFT_CREASE_MISSING',
            [edge.edgeKey],
            'A physical hinge crease is missing or disagrees with its source edge.',
          ),
        );
    }
  }
  return [...new Map(issues.map((i) => [i.id, i])).values()];
}
