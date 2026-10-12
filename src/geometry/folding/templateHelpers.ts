import type { SliceAxis } from '../../domain/fabrication';
import type { AssembledFoldPanel, FoldPanel, TemplateFitSettings } from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import { rectangle } from './netBuilder';
import { profilePointToWorld } from './profile';

export function numberParameter(
  settings: TemplateFitSettings,
  name: string,
  fallback: number,
): number {
  const value = settings.parameters[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function closureForSettings(settings: TemplateFitSettings): {
  style: 'glue' | 'press-fit';
  slotClearanceMm: number;
} {
  return {
    style: settings.parameters.closureMethod === 'press-fit' ? 'press-fit' : 'glue',
    slotClearanceMm: Math.max(0, numberParameter(settings, 'slotClearanceMm', 0.2)),
  };
}

export function rectanglePanel(
  id: string,
  partId: string,
  name: string,
  role: FoldPanel['role'],
  x: number,
  y: number,
  width: number,
  height: number,
): FoldPanel {
  return { id, partId, name, role, outline: rectangle(x, y, width, height) };
}

export function worldPanel(
  id: string,
  partId: string,
  name: string,
  points: readonly Point2D[],
  axisPositions: readonly number[],
  fitAxis: SliceAxis,
): AssembledFoldPanel {
  return {
    id,
    partId,
    name,
    verticesMm: points.map((point, index) =>
      profilePointToWorld(point, axisPositions[index] ?? axisPositions[0] ?? 0, fitAxis),
    ),
  };
}
