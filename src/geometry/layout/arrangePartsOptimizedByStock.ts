import { outputIssue } from '../output/canonicalizeContours';
import type { FabricationPart, SheetLayout } from '../../domain/fabrication';
import { arrangePartsOptimized } from './arrangePartsOptimized';
export function arrangePartsOptimizedByStock(
  parts: readonly FabricationPart[],
  template: SheetLayout,
  options: Parameters<typeof arrangePartsOptimized>[2] = {},
) {
  const groups = new Map<number, FabricationPart[]>();
  for (const part of parts)
    groups.set(part.thicknessMm, [...(groups.get(part.thicknessMm) ?? []), part]);
  if (groups.size <= 1) return arrangePartsOptimized(parts, template, options);
  const mixedLocked = (options.existingLayouts ?? []).filter(
    (sheet) =>
      new Set(
        sheet.placements
          .filter((p) => options.lockedPartIds?.includes(p.partId))
          .map((p) => parts.find((part) => part.id === p.partId)?.thicknessMm),
      ).size > 1,
  );
  if (mixedLocked.length)
    return {
      layouts: structuredClone([...(options.existingLayouts ?? [])]),
      issues: mixedLocked.map((sheet) =>
        outputIssue(
          'SHEET_STOCK_MISMATCH',
          [sheet.id],
          'Unlock mixed-stock parts and arrange again onto separate stock sheets.',
        ),
      ),
    };
  const results = [...groups]
    .sort(([a], [b]) => a - b)
    .map(([thickness, group]) => {
      const ids = new Set(group.map((p) => p.id)),
        existing = (options.existingLayouts ?? [])
          .filter(
            (sheet) =>
              sheet.stockThicknessMm === thickness ||
              sheet.placements.some(
                (p) => ids.has(p.partId) && options.lockedPartIds?.includes(p.partId),
              ),
          )
          .map((sheet) => ({
            ...sheet,
            stockThicknessMm: thickness,
            placements: sheet.placements.filter((p) => ids.has(p.partId)),
          }));
      return arrangePartsOptimized(
        group,
        {
          ...template,
          id: `${template.id}-stock-${thickness}`,
          stockThicknessMm: thickness,
          placements: [],
        },
        {
          ...options,
          existingLayouts: existing,
          lockedPartIds: (options.lockedPartIds ?? []).filter((id) => ids.has(id)),
        },
      );
    });
  return { layouts: results.flatMap((r) => r.layouts), issues: results.flatMap((r) => r.issues) };
}
