import type { ProjectData } from '../../domain/project';
import type { ValidationIssue } from '../../domain/validation';
import type { Bounds2D } from './partPlacement';
import { transformedBoundsForPart } from './partPlacement';

const EPSILON = 1e-6;

function overlaps(a: Bounds2D, b: Bounds2D): boolean {
  return (
    a.minX < b.maxX - EPSILON &&
    a.maxX > b.minX + EPSILON &&
    a.minY < b.maxY - EPSILON &&
    a.maxY > b.minY + EPSILON
  );
}

export function validateSheetLayouts(project: ProjectData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const partsById = new Map(project.generatedParts.map((part) => [part.id, part]));
  const placementCounts = new Map<string, number>();

  for (const sheet of project.sheetLayouts) {
    if (
      sheet.widthMm <= 0 ||
      sheet.heightMm <= 0 ||
      sheet.marginMm < 0 ||
      sheet.spacingMm < 0 ||
      sheet.marginMm * 2 >= sheet.widthMm ||
      sheet.marginMm * 2 >= sheet.heightMm
    ) {
      issues.push({
        id: `sheet-dimensions-invalid-${sheet.id}`,
        severity: 'error',
        code: 'SHEET_DIMENSIONS_INVALID',
        message: 'Sheet dimensions must leave a positive area inside the margins.',
        affectedEntityIds: [sheet.id],
        suggestedAction: 'Increase the sheet size or reduce its margins.',
      });
    }

    const placedBounds: { partId: string; bounds: Bounds2D }[] = [];
    for (const placement of sheet.placements) {
      const part = partsById.get(placement.partId);
      if (!part) {
        issues.push({
          id: `placement-part-missing-${sheet.id}-${placement.partId}`,
          severity: 'warning',
          code: 'PLACEMENT_PART_MISSING',
          message: 'A sheet placement refers to a part that no longer exists.',
          affectedEntityIds: [sheet.id, placement.partId],
          suggestedAction: 'Rearrange the generated parts.',
        });
        continue;
      }
      placementCounts.set(part.id, (placementCounts.get(part.id) ?? 0) + 1);
      const bounds = transformedBoundsForPart(part, placement);
      if (!bounds) continue;
      placedBounds.push({ partId: part.id, bounds });

      if (
        bounds.minX < -EPSILON ||
        bounds.minY < -EPSILON ||
        bounds.maxX > sheet.widthMm + EPSILON ||
        bounds.maxY > sheet.heightMm + EPSILON
      ) {
        issues.push({
          id: `part-outside-sheet-${sheet.id}-${part.id}`,
          severity: 'warning',
          code: 'PART_OUTSIDE_SHEET',
          message: `${part.name} extends beyond the sheet boundary.`,
          affectedEntityIds: [sheet.id, part.id],
          suggestedAction: 'Move the part inside the sheet or choose a larger sheet.',
        });
      } else if (
        bounds.minX < sheet.marginMm - EPSILON ||
        bounds.minY < sheet.marginMm - EPSILON ||
        bounds.maxX > sheet.widthMm - sheet.marginMm + EPSILON ||
        bounds.maxY > sheet.heightMm - sheet.marginMm + EPSILON
      ) {
        issues.push({
          id: `part-crosses-margin-${sheet.id}-${part.id}`,
          severity: 'warning',
          code: 'PART_CROSSES_MARGIN',
          message: `${part.name} crosses the sheet's safe margin.`,
          affectedEntityIds: [sheet.id, part.id],
          suggestedAction: 'Move the part inside the dashed margin guide.',
        });
      }
    }

    for (let first = 0; first < placedBounds.length; first += 1) {
      for (let second = first + 1; second < placedBounds.length; second += 1) {
        const a = placedBounds[first]!;
        const b = placedBounds[second]!;
        if (!overlaps(a.bounds, b.bounds)) continue;
        issues.push({
          id: `parts-overlap-${sheet.id}-${a.partId}-${b.partId}`,
          severity: 'warning',
          code: 'PARTS_OVERLAP',
          message: 'Two parts overlap on the sheet.',
          affectedEntityIds: [sheet.id, a.partId, b.partId],
          suggestedAction: 'Move or rotate one of the highlighted parts.',
        });
      }
    }
  }

  for (const part of project.generatedParts) {
    const count = placementCounts.get(part.id) ?? 0;
    if (count === 0) {
      issues.push({
        id: `part-unplaced-${part.id}`,
        severity: 'warning',
        code: 'PART_UNPLACED',
        message: `${part.name} is not placed on any sheet.`,
        affectedEntityIds: [part.id],
        suggestedAction: 'Arrange all parts or move the part to a sheet.',
      });
    } else if (count > 1) {
      issues.push({
        id: `part-placed-multiple-times-${part.id}`,
        severity: 'warning',
        code: 'PART_PLACED_MULTIPLE_TIMES',
        message: `${part.name} is placed on more than one sheet.`,
        affectedEntityIds: [part.id],
        suggestedAction: 'Keep one placement and remove the duplicates.',
      });
    }
  }

  return issues;
}
