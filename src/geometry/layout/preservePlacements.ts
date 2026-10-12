import type { FabricationPart, SheetLayout } from '../../domain/fabrication';
import { arrangePartsByStock } from './arrangePartsByStock';

/** Retain user transforms by stable ID. Resized collisions remain visible review issues. */
export function preservePlacements(
  layouts: readonly SheetLayout[],
  previous: readonly FabricationPart[],
  next: readonly FabricationPart[],
): SheetLayout[] {
  const template = layouts[0];
  if (!template) return [];
  if (previous.length === 0) return arrangePartsByStock(next, template);
  const ids = new Set(next.map((p) => p.id));
  const retained = layouts.map((sheet) => ({
    ...sheet,
    placements: sheet.placements.filter((p) => ids.has(p.partId)).map((p) => ({ ...p })),
  }));
  const placed = new Set(retained.flatMap((sheet) => sheet.placements.map((p) => p.partId)));
  const additions = next.filter((p) => !placed.has(p.id));
  if (additions.length === 0) return retained;
  let suffix = 1;
  let id = `${template.id}-new-${suffix}`;
  const used = new Set(retained.map((sheet) => sheet.id));
  while (used.has(id)) id = `${template.id}-new-${++suffix}`;
  return [...retained, ...arrangePartsByStock(additions, { ...template, id, placements: [] })];
}
