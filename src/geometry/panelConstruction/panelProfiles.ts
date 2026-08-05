import type { Point2D } from '../../domain/geometry';
import type { PanelProfileKind } from '../../domain/panelConstruction';

const ARCH_SEGMENTS = 16;

export function panelProfileRiseMm(
  profile: PanelProfileKind,
  widthMm: number,
  heightMm: number,
): number {
  if (profile === 'flat') return 0;
  return Math.min(widthMm / 4, heightMm / 2);
}

/** Returns the top edge from right to left, including both side-joint endpoints. */
export function panelProfileTopEdge(
  profile: PanelProfileKind,
  widthMm: number,
  heightMm: number,
): Point2D[] {
  const halfWidth = widthMm / 2;
  const top = heightMm / 2;
  const rise = panelProfileRiseMm(profile, widthMm, heightMm);
  if (profile === 'flat' || rise === 0) {
    return [
      { x: halfWidth, y: top },
      { x: -halfWidth, y: top },
    ];
  }
  if (profile === 'gable') {
    return [
      { x: halfWidth, y: top },
      { x: 0, y: top + rise },
      { x: -halfWidth, y: top },
    ];
  }
  if (profile === 'stepped') {
    return [
      { x: halfWidth, y: top },
      { x: widthMm * 0.3, y: top },
      { x: widthMm * 0.3, y: top + rise / 2 },
      { x: widthMm * 0.15, y: top + rise / 2 },
      { x: widthMm * 0.15, y: top + rise },
      { x: -widthMm * 0.15, y: top + rise },
      { x: -widthMm * 0.15, y: top + rise / 2 },
      { x: -widthMm * 0.3, y: top + rise / 2 },
      { x: -widthMm * 0.3, y: top },
      { x: -halfWidth, y: top },
    ];
  }
  return Array.from({ length: ARCH_SEGMENTS + 1 }, (_, index) => {
    const amount = index / ARCH_SEGMENTS;
    return {
      x: halfWidth - widthMm * amount,
      y: top + rise * Math.sin(Math.PI * amount),
    };
  });
}

export function profiledPanelOutline(
  profile: PanelProfileKind,
  widthMm: number,
  heightMm: number,
): Point2D[] {
  const halfWidth = widthMm / 2;
  const bottom = -heightMm / 2;
  return [
    { x: -halfWidth, y: bottom },
    { x: halfWidth, y: bottom },
    ...panelProfileTopEdge(profile, widthMm, heightMm),
  ];
}
