import type { FabricationPart, SheetLayout, SheetPlacement } from '../../domain/fabrication';
import { boundsForPart, dimensionsForBounds } from './partPlacement';

function emptySheet(template: SheetLayout, index: number): SheetLayout {
  return {
    ...template,
    id: index === 0 ? template.id : `${template.id}-${index + 1}`,
    placements: [],
  };
}

/**
 * Deterministic first-fit row placement. Parts retain input order and are never
 * automatically rotated; manual rotations remain an explicit user decision.
 */
export function arrangePartsInRows(
  parts: readonly FabricationPart[],
  sheetTemplate: SheetLayout,
): SheetLayout[] {
  const sheets: SheetLayout[] = [emptySheet(sheetTemplate, 0)];
  let sheetIndex = 0;
  let cursorX = sheetTemplate.marginMm;
  let cursorY = sheetTemplate.marginMm;
  let rowHeight = 0;

  for (const part of parts) {
    const bounds = boundsForPart(part);
    if (!bounds) continue;
    const { width, height } = dimensionsForBounds(bounds);
    const rightEdge = sheetTemplate.widthMm - sheetTemplate.marginMm;
    const bottomEdge = sheetTemplate.heightMm - sheetTemplate.marginMm;

    if (cursorX > sheetTemplate.marginMm && cursorX + width > rightEdge) {
      cursorX = sheetTemplate.marginMm;
      cursorY += rowHeight + sheetTemplate.spacingMm;
      rowHeight = 0;
    }

    if (cursorY > sheetTemplate.marginMm && cursorY + height > bottomEdge) {
      sheetIndex += 1;
      sheets.push(emptySheet(sheetTemplate, sheetIndex));
      cursorX = sheetTemplate.marginMm;
      cursorY = sheetTemplate.marginMm;
      rowHeight = 0;
    }

    const placement: SheetPlacement = {
      partId: part.id,
      x: cursorX - bounds.minX,
      y: cursorY - bounds.minY,
      rotationDeg: 0,
    };
    sheets[sheetIndex]!.placements.push(placement);
    cursorX += width + sheetTemplate.spacingMm;
    rowHeight = Math.max(rowHeight, height);
  }

  return sheets;
}
