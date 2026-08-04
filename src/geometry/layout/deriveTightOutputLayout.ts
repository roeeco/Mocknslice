import type { FabricationPart, SheetLayout, SheetPlacement } from '../../domain/fabrication';
import { boundsForPart, dimensionsForBounds, transformedBoundsForPart } from './partPlacement';

export const TIGHT_OUTPUT_LAYOUT_ID = 'standard-tight-output';
export const TIGHT_OUTPUT_MARGIN_MM = 5;
export const TIGHT_OUTPUT_SPACING_MM = 3;

interface PackablePart {
  part: FabricationPart;
  width: number;
  height: number;
  area: number;
}

interface PackedCandidate {
  placements: SheetPlacement[];
  contentWidth: number;
  contentHeight: number;
  signature: string;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function compareNumbers(left: number, right: number): number {
  return Math.abs(left - right) < 1e-9 ? 0 : left - right;
}

function candidateScore(candidate: PackedCandidate): [number, number, number, string] {
  const width = candidate.contentWidth + TIGHT_OUTPUT_MARGIN_MM * 2;
  const height = candidate.contentHeight + TIGHT_OUTPUT_MARGIN_MM * 2;
  return [
    width * height,
    2 * (width + height),
    Math.max(width, height) / Math.max(1e-9, Math.min(width, height)),
    candidate.signature,
  ];
}

function compareCandidates(left: PackedCandidate, right: PackedCandidate): number {
  const leftScore = candidateScore(left);
  const rightScore = candidateScore(right);
  return (
    compareNumbers(leftScore[0], rightScore[0]) ||
    compareNumbers(leftScore[1], rightScore[1]) ||
    compareNumbers(leftScore[2], rightScore[2]) ||
    leftScore[3].localeCompare(rightScore[3])
  );
}

function orientationDimensions(
  part: PackablePart,
  rotationDeg: 0 | 90,
): { width: number; height: number } {
  return rotationDeg === 0
    ? { width: part.width, height: part.height }
    : { width: part.height, height: part.width };
}

function placementAt(
  item: PackablePart,
  rotationDeg: 0 | 90,
  left: number,
  top: number,
): SheetPlacement {
  const originBounds = transformedBoundsForPart(item.part, {
    partId: item.part.id,
    x: 0,
    y: 0,
    rotationDeg,
  });
  if (!originBounds) {
    return { partId: item.part.id, x: left, y: top, rotationDeg };
  }
  return {
    partId: item.part.id,
    x: rounded(left - originBounds.minX),
    y: rounded(top - originBounds.minY),
    rotationDeg,
  };
}

function packShelf(
  orderedParts: PackablePart[],
  targetWidth: number,
  preferRotation: 0 | 90,
): PackedCandidate {
  const placements: SheetPlacement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let contentWidth = 0;

  for (const item of orderedParts) {
    const orientations = ([preferRotation, preferRotation === 0 ? 90 : 0] as const).map(
      (rotationDeg) => ({ rotationDeg, ...orientationDimensions(item, rotationDeg) }),
    );
    const fitting = orientations.filter(
      ({ width }) => cursorX === 0 || cursorX + width <= targetWidth + 1e-9,
    );
    const choices = fitting.length > 0 ? fitting : orientations;
    choices.sort(
      (left, right) =>
        compareNumbers(
          Math.max(contentWidth, cursorX + left.width) *
            Math.max(cursorY + Math.max(rowHeight, left.height), 1e-9),
          Math.max(contentWidth, cursorX + right.width) *
            Math.max(cursorY + Math.max(rowHeight, right.height), 1e-9),
        ) ||
        compareNumbers(left.height, right.height) ||
        (left.rotationDeg === preferRotation ? -1 : 1),
    );

    let choice = choices[0]!;
    if (cursorX > 0 && cursorX + choice.width > targetWidth + 1e-9) {
      cursorX = 0;
      cursorY += rowHeight + TIGHT_OUTPUT_SPACING_MM;
      rowHeight = 0;
      choice = [...orientations].sort(
        (left, right) =>
          compareNumbers(left.width * left.height, right.width * right.height) ||
          compareNumbers(left.height, right.height) ||
          (left.rotationDeg === preferRotation ? -1 : 1),
      )[0]!;
    }

    placements.push(
      placementAt(
        item,
        choice.rotationDeg,
        TIGHT_OUTPUT_MARGIN_MM + cursorX,
        TIGHT_OUTPUT_MARGIN_MM + cursorY,
      ),
    );
    cursorX += choice.width + TIGHT_OUTPUT_SPACING_MM;
    rowHeight = Math.max(rowHeight, choice.height);
    contentWidth = Math.max(contentWidth, cursorX - TIGHT_OUTPUT_SPACING_MM);
  }

  const contentHeight = cursorY + rowHeight;
  const signature = [...placements]
    .sort((left, right) => left.partId.localeCompare(right.partId))
    .map(
      (placement) =>
        `${placement.partId}:${placement.rotationDeg}:${rounded(placement.x)}:${rounded(placement.y)}`,
    )
    .join('|');
  return { placements, contentWidth, contentHeight, signature };
}

function uniqueOrders(parts: PackablePart[]): PackablePart[][] {
  const comparators = [
    (left: PackablePart, right: PackablePart) =>
      compareNumbers(Math.max(right.width, right.height), Math.max(left.width, left.height)) ||
      compareNumbers(right.area, left.area) ||
      left.part.id.localeCompare(right.part.id),
    (left: PackablePart, right: PackablePart) =>
      compareNumbers(right.area, left.area) || left.part.id.localeCompare(right.part.id),
    (left: PackablePart, right: PackablePart) => left.part.id.localeCompare(right.part.id),
  ];
  const seen = new Set<string>();
  return comparators.flatMap((comparator) => {
    const order = [...parts].sort(comparator);
    const key = order.map((part) => part.part.id).join('|');
    if (seen.has(key)) return [];
    seen.add(key);
    return [order];
  });
}

function targetWidths(parts: PackablePart[]): number[] {
  const totalArea = parts.reduce((sum, part) => sum + part.area, 0);
  const widestMinimum = Math.max(...parts.map((part) => Math.min(part.width, part.height)));
  const widest = Math.max(...parts.map((part) => Math.max(part.width, part.height)));
  const unwrapped = parts.reduce(
    (sum, part) => sum + Math.min(part.width, part.height),
    TIGHT_OUTPUT_SPACING_MM * Math.max(0, parts.length - 1),
  );
  const square = Math.sqrt(totalArea);
  return [
    ...new Set(
      [
        widestMinimum,
        widest,
        unwrapped,
        ...[0.75, 1, 1.25, 1.5, 2].map((factor) => square * factor),
      ].map(rounded),
    ),
  ]
    .filter((width) => width > 0)
    .sort((left, right) => left - right);
}

/**
 * Derives a deterministic, ephemeral single-sheet layout for Standard mode.
 * Saved project layouts are never read or changed.
 */
export function deriveTightOutputLayout(parts: FabricationPart[]): SheetLayout {
  const packable = parts.flatMap((part): PackablePart[] => {
    const bounds = boundsForPart(part);
    if (!bounds) return [];
    const { width, height } = dimensionsForBounds(bounds);
    if (width <= 0 || height <= 0) return [];
    return [{ part, width, height, area: width * height }];
  });
  if (packable.length === 0) {
    return {
      id: TIGHT_OUTPUT_LAYOUT_ID,
      widthMm: TIGHT_OUTPUT_MARGIN_MM * 2,
      heightMm: TIGHT_OUTPUT_MARGIN_MM * 2,
      marginMm: TIGHT_OUTPUT_MARGIN_MM,
      spacingMm: TIGHT_OUTPUT_SPACING_MM,
      placements: [],
    };
  }

  const candidates = uniqueOrders(packable).flatMap((order) =>
    targetWidths(packable).flatMap((width) => [
      packShelf(order, width, 0),
      packShelf(order, width, 90),
    ]),
  );
  const best = candidates.sort(compareCandidates)[0]!;
  return {
    id: TIGHT_OUTPUT_LAYOUT_ID,
    widthMm: rounded(best.contentWidth + TIGHT_OUTPUT_MARGIN_MM * 2),
    heightMm: rounded(best.contentHeight + TIGHT_OUTPUT_MARGIN_MM * 2),
    marginMm: TIGHT_OUTPUT_MARGIN_MM,
    spacingMm: TIGHT_OUTPUT_SPACING_MM,
    placements: best.placements,
  };
}
