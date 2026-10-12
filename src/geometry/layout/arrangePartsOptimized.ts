import type { FabricationPart, SheetLayout, SheetPlacement } from '../../domain/fabrication';
import type { ValidationIssue } from '../../domain/validation';
import {
  boundsForPart,
  transformedBoundsForPart,
  rotatePoint,
  boundsForPoints,
} from './partPlacement';
import { intersectPlacedParts } from './intersectPlacedParts';
import { canonicalizeContours, outputIssue } from '../output/canonicalizeContours';
import { signedArea } from '../designGraph/polygons';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
function contains(a: Rect, b: Rect) {
  return (
    b.x >= a.x - EPS_LENGTH_MM &&
    b.y >= a.y - EPS_LENGTH_MM &&
    b.x + b.w <= a.x + a.w + EPS_LENGTH_MM &&
    b.y + b.h <= a.y + a.h + EPS_LENGTH_MM
  );
}
function subtract(free: Rect[], used: Rect): Rect[] {
  const split = free.flatMap((r) => {
    if (
      used.x >= r.x + r.w ||
      used.x + used.w <= r.x ||
      used.y >= r.y + r.h ||
      used.y + used.h <= r.y
    )
      return [r];
    const next: Rect[] = [];
    if (used.x > r.x) next.push({ x: r.x, y: r.y, w: used.x - r.x, h: r.h });
    if (used.x + used.w < r.x + r.w)
      next.push({ x: used.x + used.w, y: r.y, w: r.x + r.w - used.x - used.w, h: r.h });
    if (used.y > r.y) next.push({ x: r.x, y: r.y, w: r.w, h: used.y - r.y });
    if (used.y + used.h < r.y + r.h)
      next.push({ x: r.x, y: used.y + used.h, w: r.w, h: r.y + r.h - used.y - used.h });
    return next.filter((p) => p.w > EPS_LENGTH_MM && p.h > EPS_LENGTH_MM);
  });
  return split
    .filter(
      (r, i) =>
        !split.some((other, j) => i !== j && contains(other, r) && (!contains(r, other) || j < i)),
    )
    .sort((a, b) => a.y - b.y || a.x - b.x || a.w - b.w || a.h - b.h);
}
function materialArea(part: FabricationPart) {
  const closed = part.paths.filter((p) => p.operation === 'cut' && p.closed);
  return closed.reduce(
    (sum, p) => sum + (p.contourRole === 'hole' ? -1 : 1) * Math.abs(signedArea(p.points)),
    0,
  );
}
export function arrangePartsOptimized(
  parts: readonly FabricationPart[],
  template: SheetLayout,
  options: {
    rotationAllowed?: boolean;
    existingLayouts?: readonly SheetLayout[];
    lockedPartIds?: readonly string[];
  } = {},
): { layouts: SheetLayout[]; issues: ValidationIssue[] } {
  const canonical = canonicalizeContours(parts),
    issues = [...canonical.issues];
  if (issues.some((i) => i.severity === 'error'))
    return {
      layouts: structuredClone(options.existingLayouts ?? [template]) as SheetLayout[],
      issues,
    };
  if (
    ![template.widthMm, template.heightMm, template.marginMm, template.spacingMm].every(
      Number.isFinite,
    ) ||
    template.marginMm < 0 ||
    template.spacingMm < 0 ||
    template.marginMm * 2 >= Math.min(template.widthMm, template.heightMm)
  )
    return {
      layouts: [],
      issues: [
        outputIssue(
          'SHEET_DIMENSIONS_INVALID',
          [template.id],
          'Packing requires a positive usable sheet.',
        ),
      ],
    };
  const locked = new Set(options.lockedPartIds ?? []),
    byId = new Map(canonical.parts.map((p) => [p.id, p])),
    gap = template.spacingMm;
  const layouts: SheetLayout[] = structuredClone(options.existingLayouts ?? []).map((sheet) => ({
    ...sheet,
    placements: sheet.placements.filter((p) => locked.has(p.partId) && byId.has(p.partId)),
  }));
  const free = new Map<string, Rect[]>();
  const initialize = (sheet: SheetLayout) => {
    let available: Rect[] = [
      {
        x: sheet.marginMm - gap / 2,
        y: sheet.marginMm - gap / 2,
        w: sheet.widthMm - 2 * sheet.marginMm + gap,
        h: sheet.heightMm - 2 * sheet.marginMm + gap,
      },
    ];
    for (const placement of sheet.placements) {
      const part = byId.get(placement.partId)!;
      const b = transformedBoundsForPart(part, placement)!;
      available = subtract(available, {
        x: b.minX - gap / 2,
        y: b.minY - gap / 2,
        w: b.maxX - b.minX + gap,
        h: b.maxY - b.minY + gap,
      });
    }
    free.set(sheet.id, available);
  };
  layouts.forEach(initialize);
  const usedIds = new Set(layouts.map((s) => s.id));
  let next = 0;
  const addSheet = () => {
    let id = next === 0 ? template.id : `${template.id}-packed-${next}`;
    while (usedIds.has(id)) {
      next++;
      id = `${template.id}-packed-${next}`;
    }
    next++;
    usedIds.add(id);
    const sheet = { ...structuredClone(template), id, placements: [] };
    layouts.push(sheet);
    initialize(sheet);
    return sheet;
  };
  if (!layouts.length) addSheet();
  const alreadyPlaced = new Set(layouts.flatMap((s) => s.placements.map((p) => p.partId)));
  const sorted = canonical.parts
    .filter((p) => !alreadyPlaced.has(p.id))
    .sort((a, b) => materialArea(b) - materialArea(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const part of sorted) {
    const bounds = boundsForPart(part)!;
    const rotations = (options.rotationAllowed ?? true) ? [0, 90] : [0];
    type Choice = {
      sheet: SheetLayout;
      placement: SheetPlacement;
      occupied: Rect;
      score: number[];
    };
    const choices: Choice[] = [];
    const find = (sheet: SheetLayout, sheetIndex: number) => {
      for (const rotationDeg of rotations) {
        const b = boundsForPoints(
            [
              { x: bounds.minX, y: bounds.minY },
              { x: bounds.maxX, y: bounds.minY },
              { x: bounds.maxX, y: bounds.maxY },
              { x: bounds.minX, y: bounds.maxY },
            ].map((p) => rotatePoint(p, rotationDeg)),
          )!,
          w = b.maxX - b.minX + gap,
          h = b.maxY - b.minY + gap;
        for (const r of free.get(sheet.id) ?? []) {
          if (w > r.w + EPS_LENGTH_MM || h > r.h + EPS_LENGTH_MM) continue;
          const occupied = { x: r.x, y: r.y, w, h };
          choices.push({
            sheet,
            occupied,
            placement: {
              partId: part.id,
              x: r.x + gap / 2 - b.minX,
              y: r.y + gap / 2 - b.minY,
              rotationDeg,
            },
            score: [
              sheetIndex,
              Math.min(r.w - w, r.h - h),
              Math.max(r.w - w, r.h - h),
              r.y,
              r.x,
              rotationDeg,
            ],
          });
        }
      }
    };
    layouts.forEach(find);
    if (!choices.length) {
      const sheet = addSheet();
      find(sheet, layouts.length - 1);
    }
    choices.sort((a, b) => {
      for (let i = 0; i < a.score.length; i++) {
        const delta = a.score[i]! - b.score[i]!;
        if (Math.abs(delta) > EPS_LENGTH_MM) return delta;
      }
      return 0;
    });
    const chosen = choices[0];
    if (!chosen) {
      issues.push(
        outputIssue(
          'PART_TOO_LARGE_FOR_SHEET',
          [part.id, template.id],
          'Part cannot fit the usable sheet with allowed rotations.',
        ),
      );
      continue;
    }
    chosen.sheet.placements.push(chosen.placement);
    free.set(chosen.sheet.id, subtract(free.get(chosen.sheet.id)!, chosen.occupied));
  }
  issues.push(...intersectPlacedParts(canonical.parts, layouts));
  return { layouts, issues: [...new Map(issues.map((i) => [i.id, i])).values()] };
}
