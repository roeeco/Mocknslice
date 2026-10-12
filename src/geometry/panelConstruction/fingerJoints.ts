import type { PanelEdgeName, PanelRole } from '../../domain/panelConstruction';
import type { Point2D } from '../../domain/geometry';
import { panelProfileTopEdge } from './panelProfiles';
import type { EdgeTreatment, HorizontalEdgeFeature, PanelSpec } from './constructionTypes';
import { edgeOrder, roundedPoint } from './constructionHelpers';

export function segmentCount(lengthMm: number, targetWidthMm: number): number {
  let count = Math.max(3, Math.round(lengthMm / targetWidthMm));
  if (count % 2 === 0) count += 1;
  return count;
}

export function edgeGeometry(
  edge: PanelEdgeName,
  widthMm: number,
  heightMm: number,
): { start: Point2D; end: Point2D; outward: Point2D } {
  const halfWidth = widthMm / 2;
  const halfHeight = heightMm / 2;
  switch (edge) {
    case 'bottom':
      return {
        start: { x: -halfWidth, y: -halfHeight },
        end: { x: halfWidth, y: -halfHeight },
        outward: { x: 0, y: -1 },
      };
    case 'right':
      return {
        start: { x: halfWidth, y: -halfHeight },
        end: { x: halfWidth, y: halfHeight },
        outward: { x: 1, y: 0 },
      };
    case 'top':
      return {
        start: { x: halfWidth, y: halfHeight },
        end: { x: -halfWidth, y: halfHeight },
        outward: { x: 0, y: 1 },
      };
    case 'left':
      return {
        start: { x: -halfWidth, y: halfHeight },
        end: { x: -halfWidth, y: -halfHeight },
        outward: { x: -1, y: 0 },
      };
  }
}

export function pointAlong(start: Point2D, end: Point2D, amount: number): Point2D {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

export function pushUnique(points: Point2D[], point: Point2D): void {
  const roundedValue = roundedPoint(point);
  const last = points.at(-1);
  if (!last || last.x !== roundedValue.x || last.y !== roundedValue.y) points.push(roundedValue);
}

export function panelOutline(
  spec: PanelSpec,
  treatments: ReadonlyMap<PanelEdgeName, EdgeTreatment>,
): Point2D[] {
  const points: Point2D[] = [];
  for (const edge of edgeOrder) {
    const geometry = edgeGeometry(edge, spec.widthMm, spec.heightMm);
    const treatment = treatments.get(edge);
    pushUnique(points, geometry.start);
    if (edge === 'top' && spec.profile && spec.profile !== 'flat') {
      for (const point of panelProfileTopEdge(spec.profile, spec.widthMm, spec.heightMm)) {
        pushUnique(points, point);
      }
      continue;
    }
    if (!treatment) {
      pushUnique(points, geometry.end);
      continue;
    }
    const edgeLength = Math.hypot(
      geometry.end.x - geometry.start.x,
      geometry.end.y - geometry.start.y,
    );
    const featureStart = pointAlong(
      geometry.start,
      geometry.end,
      treatment.startGuardMm / edgeLength,
    );
    const featureEnd = pointAlong(
      geometry.start,
      geometry.end,
      1 - treatment.endGuardMm / edgeLength,
    );
    pushUnique(points, featureStart);
    if (treatment.kind !== 'finger') {
      pushUnique(points, featureEnd);
      pushUnique(points, geometry.end);
      continue;
    }
    for (let index = 0; index < treatment.segmentCount; index += 1) {
      const segmentStart = pointAlong(featureStart, featureEnd, index / treatment.segmentCount);
      const segmentEnd = pointAlong(featureStart, featureEnd, (index + 1) / treatment.segmentCount);
      const hasRelief =
        (index + treatment.phase) % 2 === 0 &&
        !(index === 0 && treatment.suppressStartFinger) &&
        !(index === treatment.segmentCount - 1 && treatment.suppressEndFinger);
      if (hasRelief) {
        const segmentLength = Math.hypot(
          segmentEnd.x - segmentStart.x,
          segmentEnd.y - segmentStart.y,
        );
        const clearanceDirection = treatment.relief === 'protrude' ? 1 : -1;
        const inset = Math.max(
          -0.49,
          Math.min(0.49, (treatment.clearanceMm / 2 / segmentLength) * clearanceDirection),
        );
        const startExtension =
          treatment.relief === 'protrude' && index === 0
            ? treatment.startFingerExtensionMm / segmentLength
            : 0;
        const endExtension =
          treatment.relief === 'protrude' && index === treatment.segmentCount - 1
            ? treatment.endFingerExtensionMm / segmentLength
            : 0;
        const protrusionStart = pointAlong(segmentStart, segmentEnd, inset - startExtension);
        const protrusionEnd = pointAlong(segmentStart, segmentEnd, 1 - inset + endExtension);
        const reliefDirection = treatment.relief === 'protrude' ? 1 : -1;
        pushUnique(points, protrusionStart);
        pushUnique(points, {
          x: protrusionStart.x + geometry.outward.x * treatment.depthMm * reliefDirection,
          y: protrusionStart.y + geometry.outward.y * treatment.depthMm * reliefDirection,
        });
        pushUnique(points, {
          x: protrusionEnd.x + geometry.outward.x * treatment.depthMm * reliefDirection,
          y: protrusionEnd.y + geometry.outward.y * treatment.depthMm * reliefDirection,
        });
        pushUnique(points, protrusionEnd);
      }
      pushUnique(points, segmentEnd);
    }
    pushUnique(points, geometry.end);
  }
  return points;
}

export function isDividerRole(role: PanelRole): role is `divider-${number}` {
  return role.startsWith('divider-');
}

export function dividerTabWidth(widthMm: number, thicknessMm: number): number {
  return Math.min(widthMm / 5, Math.max(thicknessMm * 4, 6));
}

export function appendHorizontalFeatures(
  points: Point2D[],
  startX: number,
  endX: number,
  y: number,
  features: readonly HorizontalEdgeFeature[],
): void {
  const direction = endX >= startX ? 1 : -1;
  const ordered = [...features].sort((a, b) => direction * (a.centreMm - b.centreMm));
  pushUnique(points, { x: startX, y });
  for (const feature of ordered) {
    const near = feature.centreMm - (direction * feature.widthMm) / 2;
    const far = feature.centreMm + (direction * feature.widthMm) / 2;
    pushUnique(points, { x: near, y });
    pushUnique(points, { x: near, y: y + feature.depthMm });
    pushUnique(points, { x: far, y: y + feature.depthMm });
    pushUnique(points, { x: far, y });
  }
  pushUnique(points, { x: endX, y });
}

export function dividerTabCentres(
  widthMm: number,
  tabWidthMm: number,
  crossingCentresMm: readonly number[],
  crossingWidthMm: number,
): number[] {
  const candidates = [0.25, 0.32, 0.18, 0.38, 0.12];
  for (const fraction of candidates) {
    const centres = [-widthMm * fraction, widthMm * fraction];
    const clear = centres.every((centre) =>
      crossingCentresMm.every(
        (crossing) => Math.abs(centre - crossing) > (tabWidthMm + crossingWidthMm) / 2 + 0.25,
      ),
    );
    if (clear) return centres;
  }
  return [-widthMm * 0.4, widthMm * 0.4];
}

export function appendFingerEdge(
  points: Point2D[],
  start: Point2D,
  end: Point2D,
  outward: Point2D,
  segmentCount: number,
  depthMm: number,
): void {
  pushUnique(points, start);
  for (let index = 0; index < segmentCount; index += 1) {
    const segmentStart = pointAlong(start, end, index / segmentCount);
    const segmentEnd = pointAlong(start, end, (index + 1) / segmentCount);
    if (index % 2 === 1) {
      pushUnique(points, {
        x: segmentStart.x + outward.x * depthMm,
        y: segmentStart.y + outward.y * depthMm,
      });
      pushUnique(points, {
        x: segmentEnd.x + outward.x * depthMm,
        y: segmentEnd.y + outward.y * depthMm,
      });
    }
    pushUnique(points, segmentEnd);
  }
}

export function dividerOutline(
  spec: PanelSpec,
  ownThicknessMm: number,
  receiverThicknessMm: number,
  clearanceMm: number,
  fingerSegmentCount: number,
  crossingClearanceMm = clearanceMm,
): Point2D[] {
  const left = -spec.widthMm / 2;
  const right = spec.widthMm / 2;
  const bottom = -spec.heightMm / 2;
  const top = spec.heightMm / 2;
  const tabWidth = dividerTabWidth(spec.widthMm, ownThicknessMm);
  const tabDepth = receiverThicknessMm;
  const crossingWidth = ownThicknessMm + crossingClearanceMm;
  const crossings = spec.crossingSlotCentresMm ?? [];
  const tabCentres = spec.tabCentresMm ?? [-spec.widthMm / 4, spec.widthMm / 4];
  const bottomFeatures: HorizontalEdgeFeature[] = tabCentres.map((centreMm) => ({
    centreMm,
    widthMm: tabWidth,
    depthMm: -tabDepth,
  }));
  if (spec.dividerAxis === 'depth') {
    bottomFeatures.push(
      ...crossings.map((centreMm) => ({
        centreMm,
        widthMm: crossingWidth,
        depthMm: spec.heightMm / 2,
      })),
    );
  }
  const points: Point2D[] = [];
  appendHorizontalFeatures(points, left, right, bottom, bottomFeatures);
  appendFingerEdge(
    points,
    { x: right, y: bottom },
    { x: right, y: top },
    { x: 1, y: 0 },
    fingerSegmentCount,
    receiverThicknessMm,
  );
  if (spec.dividerAxis === 'width') {
    appendHorizontalFeatures(
      points,
      right,
      left,
      top,
      crossings.map((centreMm) => ({
        centreMm,
        widthMm: crossingWidth,
        depthMm: -spec.heightMm / 2,
      })),
    );
  } else {
    pushUnique(points, { x: left, y: top });
  }
  appendFingerEdge(
    points,
    { x: left, y: top },
    { x: left, y: bottom },
    { x: -1, y: 0 },
    fingerSegmentCount,
    receiverThicknessMm,
  );
  return points;
}
