import type { FabricationPart, FabricationPath, SheetLayout } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import type { ProjectData } from '../../domain/project';
import type { ValidationIssue } from '../../domain/validation';

const EPSILON = 1e-7;

export interface PreparedFabricationOutput {
  parts: FabricationPart[];
  issues: ValidationIssue[];
  appliedKerfMm: number;
  appliedKerfByPart?: Record<string, number>;
  provenance?: {
    schemaVersion: 9;
    algorithmVersion: string;
    inputHash: string;
    snapshotHash: string;
    profile: string;
    draft: boolean;
  };
}

export interface MaterialUsageEstimate {
  usedSheetCount: number;
  totalSheetAreaMm2: number;
  placedPartAreaMm2: number;
  estimatedWasteAreaMm2: number;
  utilizationPercent: number;
  cutLengthMm: number;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function polygonArea(points: readonly Point2D[]): number {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function lineIntersection(
  firstPoint: Point2D,
  firstDirection: Point2D,
  secondPoint: Point2D,
  secondDirection: Point2D,
): Point2D | undefined {
  const denominator = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(denominator) <= EPSILON) return undefined;
  const delta = { x: secondPoint.x - firstPoint.x, y: secondPoint.y - firstPoint.y };
  const t = (delta.x * secondDirection.y - delta.y * secondDirection.x) / denominator;
  return {
    x: firstPoint.x + firstDirection.x * t,
    y: firstPoint.y + firstDirection.y * t,
  };
}

function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < -EPSILON && cdA * cdB < -EPSILON;
}

function selfIntersects(points: readonly Point2D[]): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first]!;
    const b = points[(first + 1) % points.length]!;
    for (let second = first + 1; second < points.length; second += 1) {
      if (second === first || second === first + 1) continue;
      if (first === 0 && second === points.length - 1) continue;
      const c = points[second]!;
      const d = points[(second + 1) % points.length]!;
      if (segmentsCross(a, b, c, d)) return true;
    }
  }
  return false;
}

export function offsetClosedPathForKerf(
  points: readonly Point2D[],
  outwardDistanceMm: number,
): Point2D[] | undefined {
  if (points.length < 3 || Math.abs(polygonArea(points)) <= EPSILON) return undefined;
  if (Math.abs(outwardDistanceMm) <= EPSILON) return points.map(roundedPoint);
  const winding = polygonArea(points) > 0 ? 1 : -1;
  const lines = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) return undefined;
    const outward = { x: (winding * dy) / length, y: (-winding * dx) / length };
    return {
      point: {
        x: point.x + outward.x * outwardDistanceMm,
        y: point.y + outward.y * outwardDistanceMm,
      },
      direction: { x: dx, y: dy },
    };
  });
  if (lines.some((line) => !line)) return undefined;
  const offset: Point2D[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const previous = lines[(index - 1 + lines.length) % lines.length]!;
    const current = lines[index]!;
    if (!previous || !current) return undefined;
    const intersection = lineIntersection(
      previous.point,
      previous.direction,
      current.point,
      current.direction,
    );
    if (!intersection || !Number.isFinite(intersection.x) || !Number.isFinite(intersection.y))
      return undefined;
    const source = points[index]!;
    const miter = Math.hypot(intersection.x - source.x, intersection.y - source.y);
    if (miter > Math.max(Math.abs(outwardDistanceMm) * 12, 50)) return undefined;
    offset.push(roundedPoint(intersection));
  }
  const sourceArea = polygonArea(points);
  const offsetArea = polygonArea(offset);
  if (
    Math.abs(offsetArea) <= EPSILON ||
    Math.sign(sourceArea) !== Math.sign(offsetArea) ||
    selfIntersects(offset)
  ) {
    return undefined;
  }
  return offset;
}

function pathLength(path: FabricationPath): number {
  let total = 0;
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const point = path.points[index]!;
    const next = path.points[index + 1]!;
    total += Math.hypot(next.x - point.x, next.y - point.y);
  }
  if (path.closed && path.points.length > 2) {
    const first = path.points[0]!;
    const last = path.points.at(-1)!;
    total += Math.hypot(first.x - last.x, first.y - last.y);
  }
  return total;
}

function perforatePath(path: FabricationPath, dashMm: number, gapMm: number): FabricationPath[] {
  const points = path.closed ? [...path.points, path.points[0]!] : path.points;
  const result: FabricationPath[] = [];
  let dashIndex = 0;
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const start = points[segment]!;
    const end = points[segment + 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) continue;
    for (let cursor = 0; cursor < length - EPSILON; cursor += dashMm + gapMm) {
      const dashEnd = Math.min(length, cursor + dashMm);
      if (dashEnd - cursor <= EPSILON) continue;
      const firstRatio = cursor / length;
      const secondRatio = dashEnd / length;
      dashIndex += 1;
      result.push({
        ...path,
        id: `${path.id}-perforation-${dashIndex}`,
        operation: 'perforate',
        closed: false,
        points: [
          roundedPoint({ x: start.x + dx * firstRatio, y: start.y + dy * firstRatio }),
          roundedPoint({ x: start.x + dx * secondRatio, y: start.y + dy * secondRatio }),
        ],
      });
    }
  }
  return result;
}

function effectiveKerfMm(project: ProjectData): number {
  if (project.exportSettings.kerfCompensation === 'none') return 0;
  return project.exportSettings.kerfCompensation === 'material'
    ? Math.max(0, project.materialProfileSnapshot.kerfMm)
    : Math.max(0, project.exportSettings.customKerfMm);
}

export function prepareFabricationOutput(project: ProjectData): PreparedFabricationOutput {
  const issues: ValidationIssue[] = [];
  const appliedKerfMm = effectiveKerfMm(project);
  const foldLineOutput = project.exportSettings.foldLineOutput;
  const dashMm = project.exportSettings.perforationDashMm;
  const gapMm = project.exportSettings.perforationGapMm;
  const invalidPattern =
    foldLineOutput === 'perforate' &&
    (!Number.isFinite(dashMm) || dashMm <= 0 || !Number.isFinite(gapMm) || gapMm < 0);
  if (
    project.exportSettings.kerfCompensation === 'custom' &&
    (!Number.isFinite(project.exportSettings.customKerfMm) ||
      project.exportSettings.customKerfMm < 0)
  ) {
    issues.push({
      id: 'export-kerf-invalid',
      severity: 'error',
      code: 'KERF_VALUE_INVALID',
      message: 'Custom kerf must be a non-negative millimetre value.',
      affectedEntityIds: [],
      suggestedAction: 'Correct the custom kerf or use the material profile value.',
    });
  }
  if (
    !Number.isFinite(project.exportSettings.labelFontSizeMm) ||
    project.exportSettings.labelFontSizeMm <= 0
  ) {
    issues.push({
      id: 'export-label-size-invalid',
      severity: 'error',
      code: 'LABEL_SIZE_INVALID',
      message: 'Printable label size must be positive.',
      affectedEntityIds: [],
      suggestedAction: 'Choose a positive physical label size.',
    });
  }
  if (
    project.exportSettings.operationStyles.some(
      (style) => !Number.isFinite(style.strokeWidthMm) || style.strokeWidthMm <= 0,
    )
  ) {
    issues.push({
      id: 'export-operation-style-invalid',
      severity: 'error',
      code: 'OPERATION_STYLE_INVALID',
      message: 'Every operation stroke width must be positive.',
      affectedEntityIds: [],
      suggestedAction: 'Correct operation widths before exporting.',
    });
  }
  if (invalidPattern) {
    issues.push({
      id: 'export-perforation-pattern-invalid',
      severity: 'error',
      code: 'PERFORATION_PATTERN_INVALID',
      message: 'Perforation dash length must be positive and gap length cannot be negative.',
      affectedEntityIds: [],
      suggestedAction: 'Correct the perforation pattern before exporting.',
    });
  }

  const byPart: Record<string, number> = {};
  const parts = project.generatedParts.map((part) => {
    const partKerfMm =
      project.exportSettings.kerfCompensation === 'material' && part.stock
        ? Math.max(0, part.stock.kerfMm)
        : appliedKerfMm;
    byPart[part.id] = partKerfMm;
    let skippedOpenKerf = 0;
    const paths = part.paths.flatMap((path): FabricationPath[] => {
      let prepared = path;
      if (partKerfMm > 0 && path.operation === 'cut') {
        if (!path.closed || path.points.length < 3) {
          skippedOpenKerf += 1;
        } else {
          const minimumEdge = Math.min(
            ...path.points.map((point, index) => {
              const next = path.points[(index + 1) % path.points.length]!;
              return Math.hypot(next.x - point.x, next.y - point.y);
            }),
          );
          if (minimumEdge <= partKerfMm) {
            issues.push({
              id: `kerf-feature-narrow-${part.id}-${path.id}`,
              severity: 'warning',
              code: 'KERF_EXCEEDS_FEATURE',
              message: `${path.id} contains an edge no longer than the requested kerf.`,
              affectedEntityIds: [part.id, path.id],
              suggestedAction: 'Reduce kerf, enlarge the feature, or inspect the exported contour.',
            });
          }
          const direction = path.contourRole === 'hole' ? -1 : 1;
          const offset = offsetClosedPathForKerf(path.points, (partKerfMm / 2) * direction);
          if (offset) {
            prepared = { ...path, points: offset };
          } else {
            issues.push({
              id: `kerf-offset-failed-${part.id}-${path.id}`,
              severity: 'error',
              code: 'KERF_OFFSET_FAILED',
              message: `Kerf compensation could not produce a reliable contour for ${path.id}.`,
              affectedEntityIds: [part.id, path.id],
              suggestedAction: 'Disable kerf compensation or simplify the source contour.',
            });
          }
        }
      }

      if (prepared.operation !== 'mountain-fold' && prepared.operation !== 'valley-fold') {
        return [prepared];
      }
      if (foldLineOutput === 'score') return [{ ...prepared, operation: 'score' }];
      if (foldLineOutput === 'perforate' && !invalidPattern)
        return perforatePath(prepared, dashMm, gapMm);
      return [prepared];
    });
    if (skippedOpenKerf > 0) {
      issues.push({
        id: `kerf-open-paths-${part.id}`,
        severity: 'info',
        code: 'KERF_OPEN_PATH_SKIPPED',
        message: `${skippedOpenKerf} open cut path${skippedOpenKerf === 1 ? '' : 's'} in ${part.name} remain on their centreline.`,
        affectedEntityIds: [part.id],
        suggestedAction: 'Inspect slots and folding-net boundaries before fabrication.',
      });
    }
    return { ...part, paths };
  });
  return {
    parts,
    issues,
    appliedKerfMm,
    ...(project.generatedParts.some((p) => p.stock) ? { appliedKerfByPart: byPart } : {}),
  };
}

function partAreaMm2(project: ProjectData, part: FabricationPart): number {
  const closedCuts = part.paths.filter(
    (path) => path.operation === 'cut' && path.closed && path.points.length >= 3,
  );
  const outerCuts = closedCuts.filter((path) => path.contourRole !== 'hole');
  if (outerCuts.length > 0) {
    const outer = outerCuts.reduce((sum, path) => sum + Math.abs(polygonArea(path.points)), 0);
    const holes = closedCuts
      .filter((path) => path.contourRole === 'hole')
      .reduce((sum, path) => sum + Math.abs(polygonArea(path.points)), 0);
    return Math.max(0, outer - holes);
  }
  if (part.folding && project.foldingResult) {
    const panels = project.foldingResult.panels
      .filter((panel) => panel.partId === part.id)
      .reduce((sum, panel) => sum + Math.abs(polygonArea(panel.outline)), 0);
    const tabs = project.foldingResult.tabs
      .filter((tab) => tab.partId === part.id && tab.enabled)
      .reduce((sum, tab) => sum + Math.abs(polygonArea(tab.outline)), 0);
    if (panels + tabs > 0) return panels + tabs;
  }
  if (part.unfolding && project.unfoldingResult) {
    const faces = project.unfoldingResult.faces
      .filter((face) => face.partId === part.id)
      .reduce((sum, face) => sum + Math.abs(polygonArea(face.points2D)), 0);
    const tabs = project.unfoldingResult.tabs
      .filter((tab) => tab.partId === part.id && tab.enabled)
      .reduce((sum, tab) => sum + Math.abs(polygonArea(tab.outline)), 0);
    if (faces + tabs > 0) return faces + tabs;
  }
  const points = part.paths.flatMap((path) => path.points);
  if (points.length === 0) return 0;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

export function calculateMaterialUsage(
  project: ProjectData,
  preparedParts = prepareFabricationOutput(project).parts,
  layouts: readonly SheetLayout[] = project.sheetLayouts,
): MaterialUsageEstimate {
  const partsById = new Map(preparedParts.map((part) => [part.id, part]));
  const usedSheets = layouts.filter((sheet) => sheet.placements.length > 0);
  const totalSheetAreaMm2 = usedSheets.reduce(
    (sum, sheet) => sum + sheet.widthMm * sheet.heightMm,
    0,
  );
  let placedPartAreaMm2 = 0;
  let cutLengthMm = 0;
  for (const sheet of usedSheets) {
    for (const placement of sheet.placements) {
      const part = partsById.get(placement.partId);
      if (!part) continue;
      placedPartAreaMm2 += partAreaMm2(project, part);
      cutLengthMm += part.paths
        .filter((path) => path.operation === 'cut')
        .reduce((sum, path) => sum + pathLength(path), 0);
    }
  }
  const estimatedWasteAreaMm2 = Math.max(0, totalSheetAreaMm2 - placedPartAreaMm2);
  return {
    usedSheetCount: usedSheets.length,
    totalSheetAreaMm2: rounded(totalSheetAreaMm2),
    placedPartAreaMm2: rounded(placedPartAreaMm2),
    estimatedWasteAreaMm2: rounded(estimatedWasteAreaMm2),
    utilizationPercent:
      totalSheetAreaMm2 > 0 ? rounded((placedPartAreaMm2 / totalSheetAreaMm2) * 100) : 0,
    cutLengthMm: rounded(cutLengthMm),
  };
}

export function createRegistrationMarkPaths(sheet: SheetLayout): FabricationPath[] {
  const inset = Math.max(2, Math.min(6, sheet.marginMm / 2 || 2));
  const arm = Math.max(1, Math.min(3, sheet.marginMm * 0.3 || 1));
  const centres: Point2D[] = [
    { x: inset, y: inset },
    { x: sheet.widthMm - inset, y: inset },
    { x: sheet.widthMm - inset, y: sheet.heightMm - inset },
    { x: inset, y: sheet.heightMm - inset },
  ];
  return centres.flatMap((centre, index) => [
    {
      id: `registration-${index + 1}-horizontal`,
      operation: 'guide' as const,
      closed: false,
      points: [
        { x: centre.x - arm, y: centre.y },
        { x: centre.x + arm, y: centre.y },
      ],
    },
    {
      id: `registration-${index + 1}-vertical`,
      operation: 'guide' as const,
      closed: false,
      points: [
        { x: centre.x, y: centre.y - arm },
        { x: centre.x, y: centre.y + arm },
      ],
    },
  ]);
}
