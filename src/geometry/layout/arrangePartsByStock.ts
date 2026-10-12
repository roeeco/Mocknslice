import type { FabricationPart, SheetLayout } from '../../domain/fabrication';
import { arrangePartsInRows } from './arrangeParts';
export function arrangePartsByStock(
  parts: readonly FabricationPart[],
  template: SheetLayout,
): SheetLayout[] {
  const groups = new Map<number, FabricationPart[]>();
  for (const part of parts)
    groups.set(part.thicknessMm, [...(groups.get(part.thicknessMm) ?? []), part]);
  if (groups.size <= 1) return arrangePartsInRows([...parts], template);
  return [...groups]
    .sort(([a], [b]) => a - b)
    .flatMap(([stockThicknessMm, group]) =>
      arrangePartsInRows(group, {
        ...template,
        id: `${template.id}-stock-${stockThicknessMm}`,
        stockThicknessMm,
        placements: [],
      }),
    );
}
