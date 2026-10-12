import type { Point2D } from '../../domain/geometry';
import type {
  PanelConstructionMaterial,
  PanelConstructionSettings,
  PanelEdgeName,
  PanelRole,
} from '../../domain/panelConstruction';
import type { PanelConstructionInput } from './constructionTypes';
import { isDividerRole } from './fingerJoints';

export function inputSourceId(input: PanelConstructionInput): string {
  return input.sourceId ?? input.modelId ?? 'panel-construction';
}

export function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

export function dividerCountsFor(settings: PanelConstructionSettings): {
  width: number;
  depth: number;
} {
  if (settings.widthDividerCount !== undefined || settings.depthDividerCount !== undefined) {
    return {
      width: settings.widthDividerCount ?? 0,
      depth: settings.depthDividerCount ?? 0,
    };
  }
  const legacyCount = settings.dividerCount ?? 0;
  return settings.dividerAxis === 'depth'
    ? { width: 0, depth: legacyCount }
    : { width: legacyCount, depth: 0 };
}

export function panelThicknessMm(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  return settings.panelThicknessMm ?? material.thicknessMm;
}

export function dividerThicknessMm(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  return settings.dividerThicknessMm ?? panelThicknessMm(settings, material);
}

export function lidThicknessMm(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  return settings.lidThicknessMm ?? panelThicknessMm(settings, material);
}

export function thicknessForRole(
  role: PanelRole,
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  if (isDividerRole(role)) return dividerThicknessMm(settings, material);
  if (role === 'lid') return lidThicknessMm(settings, material);
  return panelThicknessMm(settings, material);
}

export function fnv1a(values: readonly (string | number | boolean)[]): string {
  let hash = 0x811c9dc5;
  const text = values.join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sf9-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const edgeOrder: PanelEdgeName[] = ['bottom', 'right', 'top', 'left'];
