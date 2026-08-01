import type { Bounds3D } from '../../domain/geometry';
import type { SliceAxis } from '../../domain/fabrication';

const axisIndex: Record<SliceAxis, number> = { x: 0, y: 1, z: 2 };

export function createSlicePlanes(bounds: Bounds3D, axis: SliceAxis, spacingMm: number): number[] {
  if (!Number.isFinite(spacingMm) || spacingMm <= 0) {
    throw new Error('Slice spacing must be greater than zero.');
  }
  const index = axisIndex[axis];
  const min = bounds.minMm[index] ?? Number.NaN;
  const max = bounds.maxMm[index] ?? Number.NaN;
  const extent = max - min;
  if (!Number.isFinite(extent) || extent <= 0)
    throw new Error(`Model has no ${axis.toUpperCase()} extent.`);

  if (spacingMm >= extent) return [(min + max) / 2];
  const planes: number[] = [];
  for (let position = min + spacingMm / 2; position < max; position += spacingMm) {
    planes.push(position);
  }
  return planes;
}
