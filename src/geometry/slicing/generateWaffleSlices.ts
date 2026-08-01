import type { FabricationPart, FabricationPath, SliceAxis } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { generateStackedSlices } from './generateStackedSlices';
import type { WaffleSliceInput, WaffleSliceResult, WaffleSliceSettings } from './types';

type LocalCoordinate = 'x' | 'y';

interface Interval {
  start: number;
  end: number;
}

interface SlotRecord {
  partId: string;
  pairedPartId: string;
  centreMm: number;
  widthMm: number;
  pathId: string;
}

const localAxes: Record<SliceAxis, readonly [SliceAxis, SliceAxis]> = {
  x: ['z', 'y'],
  y: ['x', 'z'],
  z: ['x', 'y'],
};

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function remainingAxis(first: SliceAxis, second: SliceAxis): SliceAxis {
  const result = (['x', 'y', 'z'] as const).find((axis) => axis !== first && axis !== second);
  if (!result) throw new Error('Waffle slice axes must be perpendicular.');
  return result;
}

function localCoordinateForGlobal(partAxis: SliceAxis, globalAxis: SliceAxis): LocalCoordinate {
  const axes = localAxes[partAxis];
  if (axes[0] === globalAxis) return 'x';
  if (axes[1] === globalAxis) return 'y';
  throw new Error(`Axis ${globalAxis} is normal to the ${partAxis} slice.`);
}

function coordinate(point: Point2D, key: LocalCoordinate): number {
  return key === 'x' ? point.x : point.y;
}

function pointFromCoordinates(
  along: number,
  across: number,
  alongCoordinate: LocalCoordinate,
): Point2D {
  return alongCoordinate === 'x' ? { x: along, y: across } : { x: across, y: along };
}

function scanIntervals(
  points: readonly Point2D[],
  fixedCoordinate: LocalCoordinate,
  fixedValue: number,
): Interval[] {
  if (points.length < 3) return [];
  const alongCoordinate: LocalCoordinate = fixedCoordinate === 'x' ? 'y' : 'x';
  const crossings: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const startFixed = coordinate(start, fixedCoordinate);
    const endFixed = coordinate(end, fixedCoordinate);
    const crosses =
      (startFixed <= fixedValue && endFixed > fixedValue) ||
      (endFixed <= fixedValue && startFixed > fixedValue);
    if (!crosses) continue;
    const ratio = (fixedValue - startFixed) / (endFixed - startFixed);
    crossings.push(
      coordinate(start, alongCoordinate) +
        (coordinate(end, alongCoordinate) - coordinate(start, alongCoordinate)) * ratio,
    );
  }
  crossings.sort((a, b) => a - b);
  const intervals: Interval[] = [];
  for (let index = 0; index + 1 < crossings.length; index += 2) {
    intervals.push({ start: crossings[index]!, end: crossings[index + 1]! });
  }
  return intervals;
}

function subtractIntervals(source: Interval[], exclusions: Interval[]): Interval[] {
  let result = source;
  for (const exclusion of exclusions) {
    result = result.flatMap((interval) => {
      if (exclusion.end <= interval.start || exclusion.start >= interval.end) return [interval];
      const pieces: Interval[] = [];
      if (exclusion.start > interval.start)
        pieces.push({ start: interval.start, end: Math.min(exclusion.start, interval.end) });
      if (exclusion.end < interval.end)
        pieces.push({ start: Math.max(exclusion.end, interval.start), end: interval.end });
      return pieces;
    });
  }
  return result;
}

function filledIntervals(
  part: FabricationPart,
  fixedCoordinate: LocalCoordinate,
  fixedValue: number,
): Interval[] {
  const outer = part.paths.find((path) => path.contourRole === 'outer');
  if (!outer) return [];
  const outerIntervals = scanIntervals(outer.points, fixedCoordinate, fixedValue);
  const holeIntervals = part.paths
    .filter((path) => path.contourRole === 'hole')
    .flatMap((path) => scanIntervals(path.points, fixedCoordinate, fixedValue));
  return subtractIntervals(outerIntervals, holeIntervals);
}

function intersectIntervals(first: Interval[], second: Interval[]): Interval[] {
  const intersections: Interval[] = [];
  for (const a of first) {
    for (const b of second) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) intersections.push({ start, end });
    }
  }
  return intersections;
}

function intervalContaining(intervals: Interval[], value: number): Interval | undefined {
  return intervals.find((interval) => value >= interval.start && value <= interval.end);
}

function familyPart(part: FabricationPart, family: 'a' | 'b'): FabricationPart {
  const island = part.id.split('-').at(-1) ?? '1';
  const axis = part.slice?.axis ?? 'x';
  const plane = (part.slice?.planeIndex ?? 0) + 1;
  const id = `waffle-${family}-${axis}-${plane}-${island}`;
  return {
    ...part,
    id,
    name: `Family ${family.toUpperCase()} · ${part.name}`,
    paths: part.paths.map((path, index) => ({
      ...path,
      id: `${id}-${path.contourRole ?? 'path'}-${index + 1}`,
    })),
    waffle: { family, slotCount: 0 },
  };
}

function familyIssues(issues: ValidationIssue[], family: 'a' | 'b'): ValidationIssue[] {
  return issues.map((issue) => ({
    ...issue,
    id: `waffle-${family}-${issue.id}`,
    message: `Family ${family.toUpperCase()}: ${issue.message}`,
  }));
}

function slotDirection(
  settings: WaffleSliceSettings,
  primaryPart: FabricationPart,
  secondaryPart: FabricationPart,
): 'start' | 'end' {
  let primaryStarts =
    settings.slotPattern === 'by-family' ||
    ((primaryPart.slice?.planeIndex ?? 0) + (secondaryPart.slice?.planeIndex ?? 0)) % 2 === 0;
  if (settings.reverseSlots) primaryStarts = !primaryStarts;
  return primaryStarts ? 'start' : 'end';
}

function createSlotPath(
  part: FabricationPart,
  pairedPart: FabricationPart,
  intersectionAxis: SliceAxis,
  overlap: Interval,
  widthMm: number,
  direction: 'start' | 'end',
  overlapIndex: number,
): FabricationPath | undefined {
  if (!part.slice || !pairedPart.slice) return undefined;
  const acrossCoordinate = localCoordinateForGlobal(part.slice.axis, pairedPart.slice.axis);
  const alongCoordinate = localCoordinateForGlobal(part.slice.axis, intersectionAxis);
  const centre = pairedPart.slice.positionMm;
  const halfWidth = widthMm / 2;
  const target = (overlap.start + overlap.end) / 2;
  const lowInterval = intervalContaining(
    filledIntervals(part, acrossCoordinate, centre - halfWidth),
    target,
  );
  const highInterval = intervalContaining(
    filledIntervals(part, acrossCoordinate, centre + halfWidth),
    target,
  );
  if (!lowInterval || !highInterval) return undefined;
  const lowOpening = direction === 'start' ? lowInterval.start : lowInterval.end;
  const highOpening = direction === 'start' ? highInterval.start : highInterval.end;
  const depth = (Math.abs(target - lowOpening) + Math.abs(target - highOpening)) / 2;
  const pathId = `${part.id}-slot-${pairedPart.id}-${overlapIndex + 1}`;
  return {
    id: pathId,
    operation: 'cut',
    closed: false,
    points: [
      pointFromCoordinates(lowOpening, centre - halfWidth, alongCoordinate),
      pointFromCoordinates(target, centre - halfWidth, alongCoordinate),
      pointFromCoordinates(target, centre + halfWidth, alongCoordinate),
      pointFromCoordinates(highOpening, centre + halfWidth, alongCoordinate),
    ].map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
    slot: {
      pairedPartId: pairedPart.id,
      intersectionAxis,
      centreMm: rounded(centre),
      widthMm: rounded(widthMm),
      depthMm: rounded(depth),
      direction,
    },
  };
}

function overlappingSlotIssues(records: SlotRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byPart = new Map<string, SlotRecord[]>();
  for (const record of records) {
    const slots = byPart.get(record.partId) ?? [];
    slots.push(record);
    byPart.set(record.partId, slots);
  }
  for (const [partId, slots] of byPart) {
    for (let first = 0; first < slots.length; first += 1) {
      for (let second = first + 1; second < slots.length; second += 1) {
        const a = slots[first]!;
        const b = slots[second]!;
        if (Math.abs(a.centreMm - b.centreMm) >= (a.widthMm + b.widthMm) / 2) continue;
        issues.push({
          id: `waffle-slot-overlap-${a.pathId}-${b.pathId}`,
          severity: 'warning',
          code: 'OVERLAPPING_WAFFLE_SLOTS',
          message: 'Two waffle slots overlap on the same part.',
          affectedEntityIds: [partId, a.pairedPartId, b.pairedPartId],
          suggestedAction: 'Increase slice spacing or reduce slot width.',
        });
      }
    }
  }
  return issues;
}

export function generateWaffleSlices(input: WaffleSliceInput): WaffleSliceResult {
  const { mesh, bounds, modelId, settings } = input;
  if (settings.primaryAxis === settings.secondaryAxis)
    throw new Error('Waffle slice axes must be perpendicular.');
  if (settings.clearanceMm < 0 || !Number.isFinite(settings.clearanceMm))
    throw new Error('Slot clearance cannot be negative.');
  const slotWidthMm = settings.thicknessMm + settings.clearanceMm;
  if (slotWidthMm <= 0 || !Number.isFinite(slotWidthMm))
    throw new Error('Slot width must be greater than zero.');

  const primary = generateStackedSlices({
    mesh,
    bounds,
    modelId,
    settings: {
      axis: settings.primaryAxis,
      spacingMm: settings.primarySpacingMm,
      thicknessMm: settings.thicknessMm,
      contourEpsilonMm: settings.contourEpsilonMm,
    },
  });
  const secondary = generateStackedSlices({
    mesh,
    bounds,
    modelId,
    settings: {
      axis: settings.secondaryAxis,
      spacingMm: settings.secondarySpacingMm,
      thicknessMm: settings.thicknessMm,
      contourEpsilonMm: settings.contourEpsilonMm,
    },
  });
  const primaryParts = primary.parts.map((part) => familyPart(part, 'a'));
  const secondaryParts = secondary.parts.map((part) => familyPart(part, 'b'));
  const partsById = new Map([...primaryParts, ...secondaryParts].map((part) => [part.id, part]));
  const issues = [...familyIssues(primary.issues, 'a'), ...familyIssues(secondary.issues, 'b')];
  for (const part of [...primaryParts, ...secondaryParts]) {
    if (!part.paths.some((path) => path.contourRole === 'hole')) continue;
    issues.push({
      id: `waffle-hole-review-${part.id}`,
      severity: 'warning',
      code: 'WAFFLE_HOLE_SLOT_ENTRY_REQUIRES_REVIEW',
      message: `${part.label ?? part.name} contains a hole that may become a slot entry boundary.`,
      affectedEntityIds: [part.id],
      suggestedAction:
        'Inspect the 2D slot paths and confirm that the assembly can reach each slot.',
    });
  }
  const slotRecords: SlotRecord[] = [];
  const intersectionAxis = remainingAxis(settings.primaryAxis, settings.secondaryAxis);

  for (const primaryPart of primaryParts) {
    for (const secondaryPart of secondaryParts) {
      if (!primaryPart.slice || !secondaryPart.slice) continue;
      const primaryFixed = localCoordinateForGlobal(
        primaryPart.slice.axis,
        secondaryPart.slice.axis,
      );
      const secondaryFixed = localCoordinateForGlobal(
        secondaryPart.slice.axis,
        primaryPart.slice.axis,
      );
      const overlaps = intersectIntervals(
        filledIntervals(primaryPart, primaryFixed, secondaryPart.slice.positionMm),
        filledIntervals(secondaryPart, secondaryFixed, primaryPart.slice.positionMm),
      );
      if (overlaps.length === 0) {
        issues.push({
          id: `waffle-no-intersection-${primaryPart.id}-${secondaryPart.id}`,
          severity: 'warning',
          code: 'WAFFLE_SLICES_DO_NOT_INTERSECT',
          message: `${primaryPart.label ?? primaryPart.name} and ${secondaryPart.label ?? secondaryPart.name} do not share a usable intersection.`,
          affectedEntityIds: [primaryPart.id, secondaryPart.id],
          suggestedAction: 'Choose different axes or spacing, or repair disconnected geometry.',
        });
        continue;
      }
      const primaryDirection = slotDirection(settings, primaryPart, secondaryPart);
      const secondaryDirection = primaryDirection === 'start' ? 'end' : 'start';
      overlaps.forEach((overlap, overlapIndex) => {
        if (overlap.end - overlap.start < slotWidthMm * 2) {
          issues.push({
            id: `waffle-slot-short-${primaryPart.id}-${secondaryPart.id}-${overlapIndex}`,
            severity: 'warning',
            code: 'WAFFLE_SLOT_TOO_CLOSE_TO_EDGE',
            message: 'A shared section is too short for robust half-depth slots.',
            affectedEntityIds: [primaryPart.id, secondaryPart.id],
            suggestedAction: 'Reduce material thickness or use a larger model section.',
          });
        }
        const primarySlot = createSlotPath(
          primaryPart,
          secondaryPart,
          intersectionAxis,
          overlap,
          slotWidthMm,
          primaryDirection,
          overlapIndex,
        );
        const secondarySlot = createSlotPath(
          secondaryPart,
          primaryPart,
          intersectionAxis,
          overlap,
          slotWidthMm,
          secondaryDirection,
          overlapIndex,
        );
        if (!primarySlot || !secondarySlot) {
          issues.push({
            id: `waffle-slot-outside-${primaryPart.id}-${secondaryPart.id}-${overlapIndex}`,
            severity: 'warning',
            code: 'WAFFLE_SLOT_OUTSIDE_USABLE_CONTOUR',
            message: 'A full-width slot does not fit inside both slice contours.',
            affectedEntityIds: [primaryPart.id, secondaryPart.id],
            suggestedAction: 'Reduce slot width or move the slice planes away from narrow edges.',
          });
          return;
        }
        const primaryStored = partsById.get(primaryPart.id)!;
        const secondaryStored = partsById.get(secondaryPart.id)!;
        primaryStored.paths.push(primarySlot);
        secondaryStored.paths.push(secondarySlot);
        slotRecords.push(
          {
            partId: primaryStored.id,
            pairedPartId: secondaryStored.id,
            centreMm: primarySlot.slot!.centreMm,
            widthMm: primarySlot.slot!.widthMm,
            pathId: primarySlot.id,
          },
          {
            partId: secondaryStored.id,
            pairedPartId: primaryStored.id,
            centreMm: secondarySlot.slot!.centreMm,
            widthMm: secondarySlot.slot!.widthMm,
            pathId: secondarySlot.id,
          },
        );
      });
    }
  }

  const parts = [...primaryParts, ...secondaryParts].map((part) => ({
    ...part,
    waffle: {
      family: part.waffle!.family,
      slotCount: part.paths.filter((path) => path.slot).length,
    },
  }));
  issues.push(...overlappingSlotIssues(slotRecords));
  return {
    parts,
    issues,
    primaryPlanePositionsMm: primary.planePositionsMm,
    secondaryPlanePositionsMm: secondary.planePositionsMm,
    slotCount: slotRecords.length / 2,
  };
}
