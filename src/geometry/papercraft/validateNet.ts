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
  return [...new Map(issues.map((i) => [i.id, i])).values()];
}
