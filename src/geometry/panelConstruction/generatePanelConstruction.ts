import type { FabricationLabel, FabricationPart, FabricationPath } from '../../domain/fabrication';
import type { AssembledFoldPanel, FoldTab } from '../../domain/folding';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import type { PanelConnectionTreatment } from '../../domain/connections';
import type {
  CurrentPanelJointKind,
  PanelConnectionKey,
  PanelConstructionJoint,
  PanelConstructionMaterial,
  PanelConstructionPanel,
  PanelConstructionResult,
  PanelConstructionSettings,
  PanelEdgeName,
  PanelProfileKind,
  PanelRole,
} from '../../domain/panelConstruction';
import {
  DEFAULT_PANEL_PROFILES,
  hasRaisedPanelProfile,
  maximumPanelDividerCount,
  PANEL_CONNECTION_KEYS,
  PANEL_PROFILE_KINDS,
} from '../../domain/panelConstruction';
import type { ValidationIssue } from '../../domain/validation';
import type { PanelFeature } from '../../domain/modeSettings';
import { hashSerializable } from '../../domain/canonicalHash';
import { applyPanelFeatures } from './panelFeatures';
import { panelProfileTopEdge } from './panelProfiles';
import {
  glueTabOutline,
  layoutCreaseComponents,
  polygonsOverlap,
  sameSegment,
  traceClosedContours,
  transformPoint,
  type BoundarySegment,
  type TopologyConnection,
} from '../connections/topology2d';

export const PANEL_CONSTRUCTION_ALGORITHM_VERSION = 'interactive-connections-v8';

export interface PanelConstructionInput {
  sourceId?: string;
  /** Legacy compatibility for direct geometry callers. */
  modelId?: string;
  material: PanelConstructionMaterial;
  settings: PanelConstructionSettings & { features?: PanelFeature[] };
}

function inputSourceId(input: PanelConstructionInput): string {
  return input.sourceId ?? input.modelId ?? 'panel-construction';
}

interface PanelSpec {
  role: PanelRole;
  name: string;
  widthMm: number;
  heightMm: number;
  dividerAxis?: 'width' | 'depth';
  dividerPositionMm?: number;
  crossingSlotCentresMm?: number[];
  tabCentresMm?: number[];
  profile?: PanelProfileKind;
}

interface JointSpec {
  connectionKey?: PanelConnectionKey;
  panelA: PanelRole;
  panelB: PanelRole;
  edgeA: PanelEdgeName;
  edgeB: PanelEdgeName;
  lengthMm: number;
}

interface DividerSideJointSpec {
  dividerRole: `divider-${number}`;
  receiverRole: 'front' | 'back' | 'left' | 'right';
  dividerEdge: 'left' | 'right';
  receiverCentreMm: Point2D;
  lengthMm: number;
}

interface EdgeTreatment {
  jointId: string;
  kind: PanelConnectionTreatment;
  segmentCount: number;
  phase: 0 | 1;
  depthMm: number;
  clearanceMm: number;
}

const edgeOrder: PanelEdgeName[] = ['bottom', 'right', 'top', 'left'];

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function dividerCountsFor(settings: PanelConstructionSettings): {
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

function panelThicknessMm(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  return settings.panelThicknessMm ?? material.thicknessMm;
}

function dividerThicknessMm(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  return settings.dividerThicknessMm ?? panelThicknessMm(settings, material);
}

function lidThicknessMm(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  return settings.lidThicknessMm ?? panelThicknessMm(settings, material);
}

function thicknessForRole(
  role: PanelRole,
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): number {
  if (isDividerRole(role)) return dividerThicknessMm(settings, material);
  if (role === 'lid') return lidThicknessMm(settings, material);
  return panelThicknessMm(settings, material);
}

function fnv1a(values: readonly (string | number | boolean)[]): string {
  let hash = 0x811c9dc5;
  const text = values.join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sf9-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function deterministicPanelConstructionHash(input: PanelConstructionInput): string {
  return fnv1a([
    PANEL_CONSTRUCTION_ALGORITHM_VERSION,
    inputSourceId(input),
    input.material.id,
    input.material.category,
    input.material.thicknessMm,
    input.material.kerfMm,
    panelThicknessMm(input.settings, input.material),
    dividerThicknessMm(input.settings, input.material),
    lidThicknessMm(input.settings, input.material),
    input.settings.innerWidthMm,
    input.settings.innerDepthMm,
    input.settings.innerHeightMm,
    input.settings.jointKind,
    input.settings.fingerWidthMm,
    input.settings.clearanceMm,
    input.settings.includeLid,
    dividerCountsFor(input.settings).width,
    dividerCountsFor(input.settings).depth,
    hashSerializable(input.settings.connectionOverrides ?? {}),
    hashSerializable(input.settings.panelProfiles ?? DEFAULT_PANEL_PROFILES),
    input.settings.glueTabDepthMm ?? 8,
    hashSerializable(
      [...(input.settings.boundaryGlueTabs ?? [])].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    ),
    hashSerializable(
      [...(input.settings.features ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    ),
  ]);
}

function segmentCount(lengthMm: number, targetWidthMm: number): number {
  let count = Math.max(3, Math.round(lengthMm / targetWidthMm));
  if (count % 2 === 0) count += 1;
  return count;
}

function edgeGeometry(
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

function pointAlong(start: Point2D, end: Point2D, amount: number): Point2D {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
}

function pushUnique(points: Point2D[], point: Point2D): void {
  const roundedValue = roundedPoint(point);
  const last = points.at(-1);
  if (!last || last.x !== roundedValue.x || last.y !== roundedValue.y) points.push(roundedValue);
}

function panelOutline(
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
    if (!treatment || treatment.kind !== 'finger') {
      pushUnique(points, geometry.end);
      continue;
    }
    for (let index = 0; index < treatment.segmentCount; index += 1) {
      const segmentStart = pointAlong(geometry.start, geometry.end, index / treatment.segmentCount);
      const segmentEnd = pointAlong(
        geometry.start,
        geometry.end,
        (index + 1) / treatment.segmentCount,
      );
      const protrudes = (index + treatment.phase) % 2 === 0;
      if (protrudes) {
        const segmentLength = Math.hypot(
          segmentEnd.x - segmentStart.x,
          segmentEnd.y - segmentStart.y,
        );
        const inset = Math.min(0.49, treatment.clearanceMm / 2 / segmentLength);
        const protrusionStart = pointAlong(segmentStart, segmentEnd, inset);
        const protrusionEnd = pointAlong(segmentStart, segmentEnd, 1 - inset);
        pushUnique(points, protrusionStart);
        pushUnique(points, {
          x: protrusionStart.x + geometry.outward.x * treatment.depthMm,
          y: protrusionStart.y + geometry.outward.y * treatment.depthMm,
        });
        pushUnique(points, {
          x: protrusionEnd.x + geometry.outward.x * treatment.depthMm,
          y: protrusionEnd.y + geometry.outward.y * treatment.depthMm,
        });
        pushUnique(points, protrusionEnd);
      }
      pushUnique(points, segmentEnd);
    }
  }
  return points;
}

function isDividerRole(role: PanelRole): role is `divider-${number}` {
  return role.startsWith('divider-');
}

function dividerTabWidth(widthMm: number, thicknessMm: number): number {
  return Math.min(widthMm / 5, Math.max(thicknessMm * 4, 6));
}

interface HorizontalEdgeFeature {
  centreMm: number;
  widthMm: number;
  depthMm: number;
}

function appendHorizontalFeatures(
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

function dividerTabCentres(
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

function appendFingerEdge(
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

function dividerOutline(
  spec: PanelSpec,
  ownThicknessMm: number,
  receiverThicknessMm: number,
  clearanceMm: number,
  fingerSegmentCount: number,
): Point2D[] {
  const left = -spec.widthMm / 2;
  const right = spec.widthMm / 2;
  const bottom = -spec.heightMm / 2;
  const top = spec.heightMm / 2;
  const tabWidth = dividerTabWidth(spec.widthMm, ownThicknessMm);
  const tabDepth = receiverThicknessMm;
  const crossingWidth = ownThicknessMm + clearanceMm;
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

function dividerBaseSlots(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
  specs: readonly PanelSpec[],
): FabricationPath[] {
  const paths: FabricationPath[] = [];
  const thicknessMm = dividerThicknessMm(settings, material);
  for (const spec of specs.filter((candidate) => isDividerRole(candidate.role))) {
    const position = spec.dividerPositionMm ?? 0;
    const tabWidth = dividerTabWidth(spec.widthMm, thicknessMm);
    const slotLength = tabWidth + settings.clearanceMm;
    const slotWidth = thicknessMm + settings.clearanceMm;
    const centres = spec.tabCentresMm ?? [-spec.widthMm / 4, spec.widthMm / 4];
    centres.forEach((alongPosition, index) => {
      const centre =
        spec.dividerAxis === 'width'
          ? { x: alongPosition, y: position }
          : { x: position, y: alongPosition };
      const halfX = (spec.dividerAxis === 'width' ? slotLength : slotWidth) / 2;
      const halfY = (spec.dividerAxis === 'width' ? slotWidth : slotLength) / 2;
      paths.push({
        id: `${spec.role}-base-slot-${index + 1}`,
        operation: 'cut',
        closed: true,
        contourRole: 'hole',
        panelId: 'construction-panel-base',
        points: [
          { x: centre.x - halfX, y: centre.y - halfY },
          { x: centre.x + halfX, y: centre.y - halfY },
          { x: centre.x + halfX, y: centre.y + halfY },
          { x: centre.x - halfX, y: centre.y + halfY },
        ].map(roundedPoint),
      });
    });
  }
  return paths;
}

function panelSpecs(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): PanelSpec[] {
  const specs: PanelSpec[] = [
    {
      role: 'base',
      name: 'Base panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerDepthMm,
    },
    {
      role: 'front',
      name: 'Front panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerHeightMm,
      profile: settings.panelProfiles?.front ?? 'flat',
    },
    {
      role: 'back',
      name: 'Back panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerHeightMm,
      profile: settings.panelProfiles?.back ?? 'flat',
    },
    {
      role: 'left',
      name: 'Left panel',
      widthMm: settings.innerDepthMm,
      heightMm: settings.innerHeightMm,
    },
    {
      role: 'right',
      name: 'Right panel',
      widthMm: settings.innerDepthMm,
      heightMm: settings.innerHeightMm,
    },
  ];
  if (settings.includeLid) {
    specs.push({
      role: 'lid',
      name: 'Lid panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerDepthMm,
    });
  }
  const counts = dividerCountsFor(settings);
  const dividerThickness = dividerThicknessMm(settings, material);
  const widthCellDepth =
    (settings.innerDepthMm - counts.width * dividerThickness) / (counts.width + 1);
  const depthCellWidth =
    (settings.innerWidthMm - counts.depth * dividerThickness) / (counts.depth + 1);
  const widthPositions = Array.from(
    { length: counts.width },
    (_, index) =>
      -settings.innerDepthMm / 2 + widthCellDepth * (index + 1) + dividerThickness * (index + 0.5),
  );
  const depthPositions = Array.from(
    { length: counts.depth },
    (_, index) =>
      -settings.innerWidthMm / 2 + depthCellWidth * (index + 1) + dividerThickness * (index + 0.5),
  );
  let dividerIndex = 0;
  for (const position of widthPositions) {
    dividerIndex += 1;
    specs.push({
      role: `divider-${dividerIndex}`,
      name: `Width divider ${dividerIndex}`,
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerHeightMm,
      dividerAxis: 'width',
      dividerPositionMm: position,
      crossingSlotCentresMm: depthPositions,
      tabCentresMm: [-settings.innerWidthMm / 4, settings.innerWidthMm / 4],
    });
  }
  for (const position of depthPositions) {
    dividerIndex += 1;
    const tabWidth = dividerTabWidth(settings.innerDepthMm, dividerThickness);
    const crossingWidth = dividerThickness + settings.clearanceMm;
    specs.push({
      role: `divider-${dividerIndex}`,
      name: `Depth divider ${dividerIndex - counts.width}`,
      widthMm: settings.innerDepthMm,
      heightMm: settings.innerHeightMm,
      dividerAxis: 'depth',
      dividerPositionMm: position,
      crossingSlotCentresMm: widthPositions,
      tabCentresMm: dividerTabCentres(
        settings.innerDepthMm,
        tabWidth,
        widthPositions,
        crossingWidth,
      ),
    });
  }
  return specs;
}

function jointSpecs(settings: PanelConstructionSettings): JointSpec[] {
  const joints: JointSpec[] = [
    {
      connectionKey: 'base-front',
      panelA: 'base',
      panelB: 'front',
      edgeA: 'bottom',
      edgeB: 'bottom',
      lengthMm: settings.innerWidthMm,
    },
    {
      connectionKey: 'base-back',
      panelA: 'base',
      panelB: 'back',
      edgeA: 'top',
      edgeB: 'bottom',
      lengthMm: settings.innerWidthMm,
    },
    {
      connectionKey: 'base-left',
      panelA: 'base',
      panelB: 'left',
      edgeA: 'left',
      edgeB: 'bottom',
      lengthMm: settings.innerDepthMm,
    },
    {
      connectionKey: 'base-right',
      panelA: 'base',
      panelB: 'right',
      edgeA: 'right',
      edgeB: 'bottom',
      lengthMm: settings.innerDepthMm,
    },
    {
      connectionKey: 'front-left',
      panelA: 'front',
      panelB: 'left',
      edgeA: 'left',
      edgeB: 'left',
      lengthMm: settings.innerHeightMm,
    },
    {
      connectionKey: 'front-right',
      panelA: 'front',
      panelB: 'right',
      edgeA: 'right',
      edgeB: 'left',
      lengthMm: settings.innerHeightMm,
    },
    {
      connectionKey: 'back-left',
      panelA: 'back',
      panelB: 'left',
      edgeA: 'left',
      edgeB: 'right',
      lengthMm: settings.innerHeightMm,
    },
    {
      connectionKey: 'back-right',
      panelA: 'back',
      panelB: 'right',
      edgeA: 'right',
      edgeB: 'right',
      lengthMm: settings.innerHeightMm,
    },
  ];
  if (settings.includeLid) {
    joints.push(
      {
        connectionKey: 'lid-front',
        panelA: 'lid',
        panelB: 'front',
        edgeA: 'bottom',
        edgeB: 'top',
        lengthMm: settings.innerWidthMm,
      },
      {
        connectionKey: 'lid-back',
        panelA: 'lid',
        panelB: 'back',
        edgeA: 'top',
        edgeB: 'top',
        lengthMm: settings.innerWidthMm,
      },
      {
        connectionKey: 'lid-left',
        panelA: 'lid',
        panelB: 'left',
        edgeA: 'left',
        edgeB: 'top',
        lengthMm: settings.innerDepthMm,
      },
      {
        connectionKey: 'lid-right',
        panelA: 'lid',
        panelB: 'right',
        edgeA: 'right',
        edgeB: 'top',
        lengthMm: settings.innerDepthMm,
      },
    );
  }
  return joints;
}

function resolvedConnection(
  settings: PanelConstructionSettings,
  spec: JointSpec,
): {
  kind: PanelConnectionTreatment;
  clearanceMm: number;
  fabricationClearanceMm: number;
} {
  const override = spec.connectionKey
    ? settings.connectionOverrides?.[spec.connectionKey]
    : undefined;
  return {
    kind: override?.treatment ?? (settings.jointKind as CurrentPanelJointKind),
    clearanceMm: override?.clearanceMm ?? settings.clearanceMm,
    fabricationClearanceMm: override?.clearanceMm ?? 0,
  };
}

function dividerSideJointSpecs(
  settings: PanelConstructionSettings,
  specs: readonly PanelSpec[],
): DividerSideJointSpec[] {
  const result: DividerSideJointSpec[] = [];
  for (const spec of specs) {
    if (!isDividerRole(spec.role)) continue;
    const axis = spec.dividerAxis ?? 'width';
    const position = spec.dividerPositionMm ?? 0;
    result.push(
      axis === 'width'
        ? {
            dividerRole: spec.role,
            receiverRole: 'left',
            dividerEdge: 'left',
            receiverCentreMm: { x: -position, y: 0 },
            lengthMm: settings.innerHeightMm,
          }
        : {
            dividerRole: spec.role,
            receiverRole: 'front',
            dividerEdge: 'left',
            receiverCentreMm: { x: position, y: 0 },
            lengthMm: settings.innerHeightMm,
          },
      axis === 'width'
        ? {
            dividerRole: spec.role,
            receiverRole: 'right',
            dividerEdge: 'right',
            receiverCentreMm: { x: position, y: 0 },
            lengthMm: settings.innerHeightMm,
          }
        : {
            dividerRole: spec.role,
            receiverRole: 'back',
            dividerEdge: 'right',
            receiverCentreMm: { x: -position, y: 0 },
            lengthMm: settings.innerHeightMm,
          },
    );
  }
  return result;
}

function crossingDividerJoints(
  specs: readonly PanelSpec[],
  firstJointNumber: number,
  settings: PanelConstructionSettings,
): PanelConstructionJoint[] {
  const widthDividers = specs.filter(
    (spec) => isDividerRole(spec.role) && spec.dividerAxis === 'width',
  );
  const depthDividers = specs.filter(
    (spec) => isDividerRole(spec.role) && spec.dividerAxis === 'depth',
  );
  let index = 0;
  return widthDividers.flatMap((widthDivider) =>
    depthDividers.map((depthDivider) => {
      index += 1;
      const number = firstJointNumber + index;
      return {
        id: `construction-joint-${number}`,
        kind: 'half-lap',
        panelAId: `construction-panel-${widthDivider.role}`,
        panelBId: `construction-panel-${depthDivider.role}`,
        edgeA: 'face',
        edgeB: 'face',
        sharedLengthMm: rounded(settings.innerHeightMm / 2),
        fingerCount: 0,
        clearanceMm: rounded(settings.clearanceMm),
        pairLabel: `J${number}`,
        receiverCentreAMm: roundedPoint({
          x: depthDivider.dividerPositionMm ?? 0,
          y: 0,
        }),
        receiverCentreMm: roundedPoint({
          x: widthDivider.dividerPositionMm ?? 0,
          y: 0,
        }),
      };
    }),
  );
}

function dividerReceiverSlotPaths(
  role: PanelRole,
  joints: readonly PanelConstructionJoint[],
  thicknessMm: number,
  clearanceMm: number,
): FabricationPath[] {
  const paths: FabricationPath[] = [];
  for (const joint of joints.filter(
    (candidate) =>
      candidate.panelBId === `construction-panel-${role}` && candidate.edgeB === 'face',
  )) {
    const centre = joint.receiverCentreMm;
    if (!centre || joint.fingerCount < 3) continue;
    const pitch = joint.sharedLengthMm / joint.fingerCount;
    for (let index = 0; index < joint.fingerCount; index += 1) {
      if (index % 2 === 0) continue;
      const slotCentre = {
        x: centre.x,
        y: centre.y - joint.sharedLengthMm / 2 + pitch * (index + 0.5),
      };
      const halfWidth = (thicknessMm + clearanceMm) / 2;
      const halfHeight = (pitch + clearanceMm) / 2;
      paths.push({
        id: `${joint.id}-${role}-side-slot-${index + 1}`,
        operation: 'cut',
        closed: true,
        contourRole: 'hole',
        panelId: `construction-panel-${role}`,
        edgeId: joint.id,
        points: [
          { x: slotCentre.x - halfWidth, y: slotCentre.y - halfHeight },
          { x: slotCentre.x + halfWidth, y: slotCentre.y - halfHeight },
          { x: slotCentre.x + halfWidth, y: slotCentre.y + halfHeight },
          { x: slotCentre.x - halfWidth, y: slotCentre.y + halfHeight },
        ].map(roundedPoint),
      });
    }
  }
  return paths;
}

function assembledPanels(
  settings: PanelConstructionSettings,
  panels: readonly PanelConstructionPanel[],
  parts: readonly FabricationPart[],
  specs: readonly PanelSpec[],
): AssembledFoldPanel[] {
  const halfWidth = settings.innerWidthMm / 2;
  const halfDepth = settings.innerDepthMm / 2;
  const height = settings.innerHeightMm;
  const specsByRole = new Map(specs.map((spec) => [spec.role, spec]));
  const toWorld = (role: PanelRole, point: Point2D): Vector3Mm => {
    if (role === 'base') return [point.x, 0, point.y];
    if (role === 'front') return [point.x, point.y + height / 2, -halfDepth];
    if (role === 'back') return [-point.x, point.y + height / 2, halfDepth];
    if (role === 'left') return [-halfWidth, point.y + height / 2, -point.x];
    if (role === 'right') return [halfWidth, point.y + height / 2, point.x];
    if (role === 'lid') return [point.x, height, -point.y];
    const spec = specsByRole.get(role);
    const position = spec?.dividerPositionMm ?? 0;
    return spec?.dividerAxis === 'width'
      ? [point.x, point.y + height / 2, position]
      : [position, point.y + height / 2, point.x];
  };
  return panels.map((panel) => {
    const part = parts.find((candidate) => candidate.id === panel.partId);
    const holes =
      part?.paths
        .filter((path) => path.contourRole === 'hole')
        .map((path) => path.points.map((point) => toWorld(panel.role, point))) ?? [];
    return {
      id: panel.id,
      partId: panel.partId,
      name: panel.name,
      verticesMm: panel.outline.map((point) => toWorld(panel.role, point)),
      ...(holes.length > 0 ? { holesVerticesMm: holes } : {}),
    };
  });
}

function logicalPanelEdge(
  panel: PanelConstructionPanel,
  edge: PanelEdgeName,
): { start: Point2D; end: Point2D } {
  const geometry = edgeGeometry(edge, panel.widthMm, panel.heightMm);
  return { start: geometry.start, end: geometry.end };
}

function editablePanelEdges(
  settings: PanelConstructionSettings,
  panels: readonly PanelConstructionPanel[],
  joints: readonly PanelConstructionJoint[],
  assembled: readonly AssembledFoldPanel[],
): NonNullable<PanelConstructionResult['editableEdges']> {
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const assembledById = new Map(assembled.map((panel) => [panel.id, panel]));
  const result: NonNullable<PanelConstructionResult['editableEdges']> = [];
  const worldSegment = (panelId: string, edge: PanelEdgeName) => {
    const panel = panelById.get(panelId)!;
    const assembledPanel = assembledById.get(panelId)!;
    const geometry = logicalPanelEdge(panel, edge);
    const indexFor = (point: Point2D) =>
      panel.outline.findIndex(
        (candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 1e-5,
      );
    const startIndex = indexFor(geometry.start);
    const endIndex = indexFor(geometry.end);
    return {
      startMm: assembledPanel.verticesMm[startIndex >= 0 ? startIndex : 0]!,
      endMm: assembledPanel.verticesMm[endIndex >= 0 ? endIndex : 0]!,
    };
  };
  for (const joint of joints.filter(
    (candidate) =>
      candidate.connectionKey && candidate.edgeA !== 'face' && candidate.edgeB !== 'face',
  )) {
    const segment = worldSegment(joint.panelAId, joint.edgeA as PanelEdgeName);
    result.push({
      id: joint.connectionKey!,
      kind: 'connection',
      panelAId: joint.panelAId,
      panelBId: joint.panelBId,
      ...segment,
      editable: true,
    });
  }
  const connected = new Set(
    joints.flatMap((joint) => [
      `${joint.panelAId}:${joint.edgeA}`,
      `${joint.panelBId}:${joint.edgeB}`,
    ]),
  );
  for (const panel of panels.filter((candidate) => !isDividerRole(candidate.role))) {
    for (const edge of edgeOrder) {
      if (connected.has(`${panel.id}:${edge}`)) continue;
      const raisedTop =
        edge === 'top' &&
        (panel.role === 'front' || panel.role === 'back') &&
        (settings.panelProfiles?.[panel.role] ?? 'flat') !== 'flat';
      result.push({
        id: `${panel.id}:${edge}`,
        kind: 'boundary',
        panelAId: panel.id,
        ...worldSegment(panel.id, edge),
        editable: !raisedTop,
        ...(raisedTop
          ? { unavailableReason: 'Raised-profile top edges cannot receive a free glue tab.' }
          : {}),
      });
    }
  }
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

function applyPanelConnectionEditing(
  input: PanelConstructionInput,
  panels: PanelConstructionPanel[],
  joints: PanelConstructionJoint[],
  parts: FabricationPart[],
): {
  panels: PanelConstructionPanel[];
  joints: PanelConstructionJoint[];
  parts: FabricationPart[];
  tabs: FoldTab[];
  issues: ValidationIssue[];
} {
  const creaseJoints = joints.filter((joint) => joint.kind === 'crease');
  const pairedTabJoints = joints.filter(
    (joint) => joint.kind === 'butt' && Boolean(joint.tabOwnerPanelId),
  );
  const boundaryTabs = input.settings.boundaryGlueTabs ?? [];
  if (creaseJoints.length === 0 && pairedTabJoints.length === 0 && boundaryTabs.length === 0) {
    return { panels, joints, parts, tabs: [], issues: [] };
  }

  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const issues: ValidationIssue[] = [];
  const topologyConnections: TopologyConnection[] = creaseJoints.flatMap((joint) => {
    if (joint.edgeA === 'face' || joint.edgeB === 'face') return [];
    const panelA = panelById.get(joint.panelAId);
    const panelB = panelById.get(joint.panelBId);
    if (!panelA || !panelB) return [];
    return [
      {
        id: joint.id,
        panelAId: panelA.id,
        panelBId: panelB.id,
        edgeA: logicalPanelEdge(panelA, joint.edgeA),
        edgeB: logicalPanelEdge(panelB, joint.edgeB),
      },
    ];
  });
  const layout = layoutCreaseComponents(panels, topologyConnections);
  if (layout.cycleConnectionIds.length > 0) {
    issues.push({
      id: 'panel-crease-cycle',
      severity: 'error',
      code: 'CONNECTION_CREASE_CYCLE',
      message: 'The selected panel creases form a cycle and cannot be unfolded into one flat net.',
      affectedEntityIds: layout.cycleConnectionIds,
      suggestedAction: 'Change at least one crease in the cycle to a butt or finger connection.',
    });
  }
  for (const joint of creaseJoints) {
    const panelA = panels.find((panel) => panel.id === joint.panelAId)!;
    const panelB = panels.find((panel) => panel.id === joint.panelBId)!;
    if (
      Math.abs(
        thicknessForRole(panelA.role, input.settings, input.material) -
          thicknessForRole(panelB.role, input.settings, input.material),
      ) > 1e-6
    ) {
      issues.push({
        id: `panel-crease-thickness-${joint.id}`,
        severity: 'error',
        code: 'CONNECTION_THICKNESS_MISMATCH',
        message: 'A scored crease cannot join panels made from different stock thicknesses.',
        affectedEntityIds: [joint.id, panelA.id, panelB.id],
        suggestedAction: 'Use matching stock thicknesses or change this connection to butt.',
      });
    }
  }

  const tabDepth = input.settings.glueTabDepthMm ?? 8;
  const tabs: FoldTab[] = [];
  const tabEdges = new Map<string, { id: string; panelId: string; edge: PanelEdgeName }>();
  for (const joint of pairedTabJoints) {
    const ownerId = joint.tabOwnerPanelId!;
    const edge = ownerId === joint.panelAId ? joint.edgeA : joint.edgeB;
    if (edge === 'face' || (ownerId !== joint.panelAId && ownerId !== joint.panelBId)) {
      issues.push({
        id: `panel-tab-owner-${joint.id}`,
        severity: 'error',
        code: 'CONNECTION_TAB_OWNER_INVALID',
        message: 'A paired glue tab must be owned by one of the two connected panels.',
        affectedEntityIds: [joint.id, ownerId],
        suggestedAction: 'Select either connected panel as the glue-tab owner.',
      });
      continue;
    }
    tabEdges.set(`${ownerId}:${edge}`, { id: `${joint.id}-glue-tab`, panelId: ownerId, edge });
  }
  for (const record of boundaryTabs) {
    const panel = panelById.get(record.ownerPanelId);
    const edge = record.edgeId.split(':').at(-1) as PanelEdgeName;
    const connected = joints.some(
      (joint) =>
        (joint.panelAId === record.ownerPanelId && joint.edgeA === edge) ||
        (joint.panelBId === record.ownerPanelId && joint.edgeB === edge),
    );
    const raisedTop =
      edge === 'top' &&
      (panel?.role === 'front' || panel?.role === 'back') &&
      (input.settings.panelProfiles?.[panel.role] ?? 'flat') !== 'flat';
    if (!panel || !edgeOrder.includes(edge) || connected || raisedTop) {
      issues.push({
        id: `panel-boundary-tab-${record.id}`,
        severity: 'error',
        code: 'BOUNDARY_TAB_EDGE_INVALID',
        message: 'A free glue tab targets a missing, connected, or shaped panel edge.',
        affectedEntityIds: [record.id, record.ownerPanelId, record.edgeId],
        suggestedAction: 'Choose a straight exposed panel edge.',
      });
      continue;
    }
    tabEdges.set(`${panel.id}:${edge}`, { id: record.id, panelId: panel.id, edge });
  }

  const transformedParts: FabricationPart[] = [];
  const panelPartIds = new Map<string, string>();
  for (const component of layout.components) {
    const componentPanels = component.map((id) => panelById.get(id)!);
    const componentJointIds = joints
      .filter((joint) => component.includes(joint.panelAId) || component.includes(joint.panelBId))
      .map((joint) => joint.id);
    const partId =
      component.length === 1
        ? componentPanels[0]!.partId
        : `construction-net-${componentPanels
            .map((panel) => panel.role)
            .sort()
            .join('-')}`;
    for (const panel of componentPanels) panelPartIds.set(panel.id, partId);
    const segments: BoundarySegment[] = [];
    for (const panel of componentPanels) {
      const transform = layout.transforms.get(panel.id)!;
      panel.outline.forEach((start, index) => {
        const end = panel.outline[(index + 1) % panel.outline.length]!;
        const omittedForCrease = topologyConnections.some((connection) => {
          if (connection.panelAId === panel.id) {
            return sameSegment(start, end, connection.edgeA.start, connection.edgeA.end);
          }
          if (connection.panelBId === panel.id) {
            return sameSegment(start, end, connection.edgeB.start, connection.edgeB.end);
          }
          return false;
        });
        const tab = [...tabEdges.values()].find((candidate) => {
          if (candidate.panelId !== panel.id) return false;
          const logical = logicalPanelEdge(panel, candidate.edge);
          return sameSegment(start, end, logical.start, logical.end);
        });
        if (omittedForCrease || tab) return;
        segments.push({
          start: transformPoint(start, transform),
          end: transformPoint(end, transform),
          panelId: panel.id,
        });
      });
      for (const tab of [...tabEdges.values()].filter(
        (candidate) => candidate.panelId === panel.id,
      )) {
        const logical = logicalPanelEdge(panel, tab.edge);
        const length = Math.hypot(logical.end.x - logical.start.x, logical.end.y - logical.start.y);
        if (length < tabDepth * 2 || tabDepth > Math.min(15, length * 0.35) + 1e-6) {
          issues.push({
            id: `panel-tab-depth-${tab.id}`,
            severity: 'error',
            code: 'GLUE_TAB_DEPTH_INVALID',
            message: 'The glue tab depth is too large for its selected edge.',
            affectedEntityIds: [tab.id, panel.id],
            suggestedAction: 'Reduce glue-tab depth or choose a longer edge.',
          });
          continue;
        }
        const outline = glueTabOutline(logical.start, logical.end, tabDepth).map((point) =>
          transformPoint(point, transform),
        );
        for (let index = 0; index < outline.length - 1; index += 1) {
          segments.push({
            start: outline[index]!,
            end: outline[index + 1]!,
            panelId: panel.id,
            tabId: tab.id,
          });
        }
        tabs.push({
          id: tab.id,
          partId,
          edgeId: `${tab.id}-base`,
          ownerPanelId: panel.id,
          style: 'glue',
          depthMm: tabDepth,
          shoulderAngleDeg: 20,
          enabled: true,
          baseStart: transformPoint(logical.start, transform),
          baseEnd: transformPoint(logical.end, transform),
          outline,
        });
      }
    }
    const contours = traceClosedContours(segments);
    if (contours.length === 0) {
      issues.push({
        id: `panel-component-contour-${partId}`,
        severity: 'error',
        code: 'CONNECTION_CONTOUR_INVALID',
        message: 'The edited panel component could not be traced into a closed cut contour.',
        affectedEntityIds: component,
        suggestedAction: 'Reset the conflicting connection or glue-tab edit.',
      });
    }
    const sourceParts = componentPanels.map((panel) =>
      parts.find((part) => part.id === panel.partId)!,
    );
    const innerPaths = sourceParts.flatMap((part) =>
      part.paths
        .filter((path) => path.contourRole !== 'outer')
        .map((path) => ({
          ...path,
          points: path.points.map((point) =>
            transformPoint(point, layout.transforms.get(path.panelId ?? component[0]!)!),
          ),
        })),
    );
    const scorePaths: FabricationPath[] = topologyConnections
      .filter((connection) => component.includes(connection.panelAId))
      .map((connection) => ({
        id: `${connection.id}-score`,
        operation: 'score',
        closed: false,
        points: [
          transformPoint(connection.edgeA.start, layout.transforms.get(connection.panelAId)!),
          transformPoint(connection.edgeA.end, layout.transforms.get(connection.panelAId)!),
        ],
        panelId: connection.panelAId,
        edgeId: connection.id,
      }));
    const tabScores: FabricationPath[] = tabs
      .filter((tab) => tab.partId === partId)
      .map((tab) => ({
        id: `${tab.id}-score`,
        operation: 'score',
        closed: false,
        points: [tab.baseStart, tab.baseEnd],
        panelId: tab.ownerPanelId,
        tabId: tab.id,
        edgeId: tab.edgeId,
      }));
    const labels = sourceParts.flatMap((part) =>
      (part.labels ?? []).map((label) => {
        const owner = componentPanels.find((panel) => label.entityId?.includes(panel.role));
        return {
          ...label,
          position: transformPoint(
            label.position,
            layout.transforms.get(owner?.id ?? component[0]!)!,
          ),
        };
      }),
    );
    transformedParts.push({
      id: partId,
      name: componentPanels.map((panel) => panel.name).join(' + '),
      label: componentPanels.map((panel) => panel.role.toUpperCase()).join(' + '),
      thicknessMm: thicknessForRole(componentPanels[0]!.role, input.settings, input.material),
      sourceReference: inputSourceId(input),
      paths: [
        ...contours.map((points, index): FabricationPath => ({
          id: `${partId}-outline-${index + 1}`,
          operation: 'cut',
          closed: true,
          contourRole: 'outer',
          points,
        })),
        ...innerPaths,
        ...scorePaths,
        ...tabScores,
      ],
      labels,
      construction: {
        panelIds: component,
        roles: componentPanels.map((panel) => panel.role),
        jointIds: componentJointIds,
      },
    });
  }
  if (creaseJoints.length > 0) {
    issues.push({
      id: 'panel-cardboard-fit-unverified',
      severity: 'warning',
      code: 'CARDBOARD_FIT_UNVERIFIED',
      message:
        'Panel crease positions are nominal and do not include bend allowance, grain, or material compression.',
      affectedEntityIds: creaseJoints.map((joint) => joint.id),
      suggestedAction: 'Make and measure a physical cardboard test before final fabrication.',
    });
  }
  const updatedPanels = panels.map((panel) => ({
    ...panel,
    partId: panelPartIds.get(panel.id) ?? panel.partId,
  }));
  const updatedJoints = joints.map((joint) => ({
    ...joint,
    ...(tabs.some(
      (tab) => tab.ownerPanelId === joint.panelAId || tab.ownerPanelId === joint.panelBId,
    )
      ? {
          tabIds: tabs
            .filter(
              (tab) => tab.ownerPanelId === joint.panelAId || tab.ownerPanelId === joint.panelBId,
            )
            .map((tab) => tab.id),
        }
      : {}),
  }));
  for (const tab of tabs) {
    for (const panel of panels.filter(
      (candidate) =>
        candidate.id !== tab.ownerPanelId && panelPartIds.get(candidate.id) === tab.partId,
    )) {
      const transformedOutline = panel.outline.map((point) =>
        transformPoint(point, layout.transforms.get(panel.id)!),
      );
      if (!polygonsOverlap(tab.outline, transformedOutline)) continue;
      issues.push({
        id: `panel-tab-overlap-${tab.id}-${panel.id}`,
        severity: 'error',
        code: 'GLUE_TAB_OVERLAP',
        message: 'A glue tab overlaps another panel in its flat fabrication component.',
        affectedEntityIds: [tab.id, panel.id],
        suggestedAction: 'Reduce tab depth, change its owner, or change the nearby crease.',
      });
    }
  }
  for (let first = 0; first < tabs.length; first += 1) {
    for (let second = first + 1; second < tabs.length; second += 1) {
      const tabA = tabs[first]!;
      const tabB = tabs[second]!;
      if (tabA.partId !== tabB.partId || !polygonsOverlap(tabA.outline, tabB.outline)) continue;
      issues.push({
        id: `panel-tab-collision-${tabA.id}-${tabB.id}`,
        severity: 'error',
        code: 'GLUE_TAB_COLLISION',
        message: 'Two glue tabs overlap in the same fabrication component.',
        affectedEntityIds: [tabA.id, tabB.id],
        suggestedAction: 'Remove one tab, select another owner, or reduce tab depth.',
      });
    }
  }
  return { panels: updatedPanels, joints: updatedJoints, parts: transformedParts, tabs, issues };
}

function inputIssues(input: PanelConstructionInput): ValidationIssue[] {
  const { settings, material } = input;
  const sourceId = inputSourceId(input);
  const dividerCounts = dividerCountsFor(settings);
  const panelThickness = panelThicknessMm(settings, material);
  const dividerThickness = dividerThicknessMm(settings, material);
  const lidThickness = lidThicknessMm(settings, material);
  const maximumStockThickness = Math.max(
    panelThickness,
    dividerThickness,
    settings.includeLid ? lidThickness : 0,
  );
  const dimensions = [settings.innerWidthMm, settings.innerDepthMm, settings.innerHeightMm];
  if (
    dimensions.some((value) => !Number.isFinite(value) || value <= 0) ||
    !Number.isFinite(settings.fingerWidthMm) ||
    settings.fingerWidthMm <= 0 ||
    !Number.isFinite(settings.clearanceMm) ||
    settings.clearanceMm < 0 ||
    [panelThickness, dividerThickness, lidThickness].some(
      (value) => !Number.isFinite(value) || value < 1 || value > 10,
    ) ||
    !Number.isInteger(dividerCounts.width) ||
    !Number.isInteger(dividerCounts.depth) ||
    dividerCounts.width < 0 ||
    dividerCounts.depth < 0 ||
    dividerCounts.width > maximumPanelDividerCount(settings.innerDepthMm, dividerThickness) ||
    dividerCounts.depth > maximumPanelDividerCount(settings.innerWidthMm, dividerThickness)
  ) {
    return [
      {
        id: `panel-settings-invalid-${sourceId}`,
        severity: 'error',
        code: 'PANEL_SETTINGS_INVALID',
        message:
          'Panel dimensions and finger width must be positive; stock must be 1–10 mm and divider counts must fit the available space.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Correct the panel-construction dimensions and generate again.',
      },
    ];
  }
  if (settings.jointKind === 'tab-slot') {
    return [
      {
        id: `panel-joint-unsupported-${sourceId}`,
        severity: 'error',
        code: 'PANEL_JOINT_UNSUPPORTED',
        message: 'Tabs and through-slots are temporarily unavailable.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Use complementary finger joints or straight butt joints.',
      },
    ];
  }
  const profiles = settings.panelProfiles ?? DEFAULT_PANEL_PROFILES;
  if (
    !PANEL_PROFILE_KINDS.includes(profiles.front) ||
    !PANEL_PROFILE_KINDS.includes(profiles.back)
  ) {
    return [
      {
        id: `panel-profile-invalid-${sourceId}`,
        severity: 'error',
        code: 'PANEL_PROFILE_INVALID',
        message: 'Front and back panel profiles must use a supported bounded shape.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Choose flat, arch, gable, or stepped profiles.',
      },
    ];
  }
  if (settings.includeLid && hasRaisedPanelProfile(profiles)) {
    return [
      {
        id: `panel-profile-lid-${sourceId}`,
        severity: 'error',
        code: 'PANEL_PROFILE_LID_INCOMPATIBLE',
        message: 'Raised front or back profiles require an open top.',
        affectedEntityIds: ['construction-panel-front', 'construction-panel-back'],
        suggestedAction: 'Remove the lid or set both panel profiles to flat.',
      },
    ];
  }
  const overrides = settings.connectionOverrides ?? {};
  const unknownConnectionKey = Object.keys(overrides).find(
    (key) => !PANEL_CONNECTION_KEYS.includes(key as PanelConnectionKey),
  );
  if (unknownConnectionKey) {
    return [
      {
        id: `panel-connection-key-${sourceId}`,
        severity: 'error',
        code: 'PANEL_CONNECTION_OVERRIDE_INVALID',
        message: 'A connection override targets an inaccessible panel pairing.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Remove the unsupported connection override.',
      },
    ];
  }
  for (const spec of jointSpecs(settings).filter((candidate) => candidate.connectionKey)) {
    const override = settings.connectionOverrides?.[spec.connectionKey!];
    if (!override) continue;
    if (
      !(['butt', 'finger', 'crease'] as const).includes(override.treatment) ||
      (override.clearanceMm !== undefined &&
        (!Number.isFinite(override.clearanceMm) || override.clearanceMm < 0)) ||
      (override.treatment !== 'finger' && override.clearanceMm !== undefined) ||
      (override.glueTabOwnerPanelId !== undefined && override.treatment !== 'butt') ||
      (override.glueTabOwnerPanelId !== undefined &&
        override.glueTabOwnerPanelId !== `construction-panel-${spec.panelA}` &&
        override.glueTabOwnerPanelId !== `construction-panel-${spec.panelB}`)
    ) {
      return [
        {
          id: `panel-connection-override-${spec.connectionKey}-${sourceId}`,
          severity: 'error',
          code: 'PANEL_CONNECTION_OVERRIDE_INVALID',
          message: 'A connection override has an incompatible treatment, clearance, or tab owner.',
          affectedEntityIds: [sourceId, spec.connectionKey!],
          suggestedAction:
            'Use finger clearance only for finger joints and select one connected panel as a glue-tab owner.',
        },
      ];
    }
    const pitch = spec.lengthMm / segmentCount(spec.lengthMm, settings.fingerWidthMm);
    if (override.clearanceMm !== undefined && override.clearanceMm >= pitch) {
      return [
        {
          id: `panel-connection-clearance-${spec.connectionKey}-${sourceId}`,
          severity: 'error',
          code: 'PANEL_CONNECTION_CLEARANCE_TOO_LARGE',
          message: 'A connection clearance is at least as large as its finger pitch.',
          affectedEntityIds: [sourceId, spec.connectionKey!],
          suggestedAction: 'Reduce the connection clearance or use wider fingers.',
        },
      ];
    }
  }
  const issues: ValidationIssue[] = [];
  const dividerCount = dividerCounts.width + dividerCounts.depth;
  const usesFingers =
    settings.jointKind !== 'butt' ||
    Object.values(overrides).some((override) => override?.treatment === 'finger') ||
    dividerCount > 0;
  const widthSpacing =
    (settings.innerDepthMm - dividerCounts.width * dividerThickness) / (dividerCounts.width + 1);
  const depthSpacing =
    (settings.innerWidthMm - dividerCounts.depth * dividerThickness) / (dividerCounts.depth + 1);
  if (
    (dividerCounts.width > 0 && widthSpacing < dividerThickness * 4) ||
    (dividerCounts.depth > 0 && depthSpacing < dividerThickness * 4)
  ) {
    issues.push({
      id: `panel-divider-spacing-${sourceId}`,
      severity: 'error',
      code: 'PANEL_DIVIDER_SPACING_TOO_NARROW',
      message: 'The requested dividers leave sections narrower than four material thicknesses.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Use fewer dividers, a larger box, or thinner material.',
    });
  }
  if (Math.min(...dimensions) < maximumStockThickness * 4) {
    issues.push({
      id: `panel-dimension-too-small-${sourceId}`,
      severity: 'error',
      code: 'PANEL_DIMENSION_TOO_SMALL',
      message: 'Every enclosure dimension must be at least four material thicknesses.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Increase the enclosure dimensions or choose thinner material.',
    });
  }
  if (usesFingers && settings.fingerWidthMm < maximumStockThickness * 1.5) {
    issues.push({
      id: `panel-finger-narrow-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_FINGER_TOO_NARROW',
      message: 'The target finger width is narrow relative to material thickness.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Increase finger width and test the joint in scrap material.',
    });
  }
  const shortestJoint = Math.min(...dimensions);
  const minimumPitch = shortestJoint / segmentCount(shortestJoint, settings.fingerWidthMm);
  const dividerPitch =
    settings.innerHeightMm / segmentCount(settings.innerHeightMm, settings.fingerWidthMm);
  if (usesFingers && settings.fingerWidthMm > shortestJoint / 3) {
    issues.push({
      id: `panel-finger-sparse-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_TOO_FEW_FINGERS',
      message: 'The target width produces only a few large fingers on at least one joint.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Reduce target finger width for better load distribution.',
    });
  }
  if (usesFingers && Math.min(minimumPitch, dividerPitch) <= material.kerfMm * 4) {
    issues.push({
      id: `panel-finger-kerf-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_FINGER_NEAR_KERF_LIMIT',
      message: 'At least one finger pitch is very small relative to the material kerf.',
      affectedEntityIds: [sourceId, material.id],
      suggestedAction: 'Use wider fingers or a lower-kerf cutting process.',
    });
  }
  if (dividerCount > 0 && settings.clearanceMm >= dividerPitch) {
    issues.push({
      id: `panel-divider-clearance-large-${sourceId}`,
      severity: 'error',
      code: 'PANEL_DIVIDER_CLEARANCE_TOO_LARGE',
      message: 'Divider slot clearance is at least as large as the side-finger pitch.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Reduce slot clearance or use wider divider fingers.',
    });
  }
  if (
    usesFingers &&
    (material.category === 'paper' || (material.category === 'card' && panelThickness < 0.8))
  ) {
    issues.push({
      id: `panel-flexible-material-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_RIGID_JOINT_MATERIAL_REVIEW',
      message: 'Finger joints are intended for rigid sheet material; paper or card may tear.',
      affectedEntityIds: [material.id],
      suggestedAction: 'Use a rigid material or choose butt joints with adhesive.',
    });
  }
  if (settings.jointKind === 'butt') {
    issues.push({
      id: `panel-butt-fastener-${sourceId}`,
      severity: 'info',
      code: 'PANEL_BUTT_JOINT_FASTENER_REQUIRED',
      message: 'Butt-joint panels require adhesive, tape, or external fasteners.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Plan the assembly method before cutting.',
    });
  }
  if (settings.includeLid && settings.jointKind !== 'butt') {
    issues.push({
      id: `panel-closed-assembly-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_CLOSED_ASSEMBLY_REVIEW',
      message:
        'A jointed lid closes all enclosure edges and may require a specific assembly order.',
      affectedEntityIds: ['construction-panel-lid'],
      suggestedAction: 'Dry-fit the enclosure and leave the lid until last.',
    });
  }
  return issues;
}

function emptyResult(
  input: PanelConstructionInput,
  issues: ValidationIssue[],
): PanelConstructionResult {
  return {
    settings: input.settings,
    material: input.material,
    panels: [],
    joints: [],
    parts: [],
    issues,
    assembledPreview: { panels: [] },
    algorithmVersion: PANEL_CONSTRUCTION_ALGORITHM_VERSION,
    inputHash: deterministicPanelConstructionHash(input),
  };
}

export function generatePanelConstruction(input: PanelConstructionInput): PanelConstructionResult {
  input = {
    ...input,
    settings: {
      ...input.settings,
      ...(input.settings.features
        ? {
            features: [...input.settings.features].sort((left, right) =>
              left.id.localeCompare(right.id),
            ),
          }
        : {}),
    },
  };
  const issues = inputIssues(input);
  if (issues.some((issue) => issue.severity === 'error')) return emptyResult(input, issues);
  const specs = panelSpecs(input.settings, input.material);
  const treatmentsByRole = new Map<PanelRole, Map<PanelEdgeName, EdgeTreatment>>(
    specs.map((spec) => [spec.role, new Map()]),
  );
  const enclosureJoints: PanelConstructionJoint[] = jointSpecs(input.settings).map(
    (spec, index) => {
      const id = `construction-joint-${index + 1}`;
      const resolved = resolvedConnection(input.settings, spec);
      const count =
        resolved.kind === 'finger' ? segmentCount(spec.lengthMm, input.settings.fingerWidthMm) : 0;
      const treatmentA: EdgeTreatment = {
        jointId: id,
        kind: resolved.kind,
        segmentCount: count,
        phase: 0,
        depthMm: thicknessForRole(spec.panelB, input.settings, input.material),
        clearanceMm: resolved.fabricationClearanceMm,
      };
      const treatmentB: EdgeTreatment = {
        jointId: id,
        kind: resolved.kind,
        segmentCount: count,
        phase: resolved.kind === 'finger' ? 1 : 0,
        depthMm: thicknessForRole(spec.panelA, input.settings, input.material),
        clearanceMm: resolved.fabricationClearanceMm,
      };
      treatmentsByRole.get(spec.panelA)!.set(spec.edgeA, treatmentA);
      treatmentsByRole.get(spec.panelB)!.set(spec.edgeB, treatmentB);
      return {
        id,
        ...(spec.connectionKey ? { connectionKey: spec.connectionKey } : {}),
        kind: resolved.kind,
        panelAId: `construction-panel-${spec.panelA}`,
        panelBId: `construction-panel-${spec.panelB}`,
        edgeA: spec.edgeA,
        edgeB: spec.edgeB,
        sharedLengthMm: rounded(spec.lengthMm),
        fingerCount: count,
        clearanceMm: rounded(resolved.clearanceMm),
        pairLabel: `J${index + 1}`,
        ...(input.settings.connectionOverrides?.[spec.connectionKey!]?.glueTabOwnerPanelId
          ? {
              tabOwnerPanelId:
                input.settings.connectionOverrides[spec.connectionKey!]!.glueTabOwnerPanelId,
            }
          : {}),
      };
    },
  );
  const dividerFingerCount = segmentCount(
    input.settings.innerHeightMm,
    input.settings.fingerWidthMm,
  );
  const dividerJoints: PanelConstructionJoint[] = dividerSideJointSpecs(input.settings, specs).map(
    (spec, index) => ({
      id: `construction-joint-${enclosureJoints.length + index + 1}`,
      kind: 'finger',
      panelAId: `construction-panel-${spec.dividerRole}`,
      panelBId: `construction-panel-${spec.receiverRole}`,
      edgeA: spec.dividerEdge,
      edgeB: 'face',
      sharedLengthMm: rounded(spec.lengthMm),
      fingerCount: dividerFingerCount,
      clearanceMm: rounded(input.settings.clearanceMm),
      pairLabel: `J${enclosureJoints.length + index + 1}`,
      tabOwnerPanelId: `construction-panel-${spec.dividerRole}`,
      receiverCentreMm: roundedPoint(spec.receiverCentreMm),
    }),
  );
  const crossingJoints = crossingDividerJoints(
    specs,
    enclosureJoints.length + dividerJoints.length,
    input.settings,
  );
  const joints = [...enclosureJoints, ...dividerJoints, ...crossingJoints];
  const panels: PanelConstructionPanel[] = specs.map((spec) => {
    const roleJoints = joints.filter(
      (joint) =>
        joint.panelAId === `construction-panel-${spec.role}` ||
        joint.panelBId === `construction-panel-${spec.role}`,
    );
    const edgeJointIds: Partial<Record<PanelEdgeName, string>> = {};
    for (const joint of roleJoints) {
      const location =
        joint.panelAId === `construction-panel-${spec.role}` ? joint.edgeA : joint.edgeB;
      if (location !== 'face') edgeJointIds[location] = joint.id;
    }
    return {
      id: `construction-panel-${spec.role}`,
      partId: `construction-part-${spec.role}`,
      name: spec.name,
      role: spec.role,
      widthMm: rounded(spec.widthMm),
      heightMm: rounded(spec.heightMm),
      outline: isDividerRole(spec.role)
        ? dividerOutline(
            spec,
            dividerThicknessMm(input.settings, input.material),
            panelThicknessMm(input.settings, input.material),
            input.settings.clearanceMm,
            dividerFingerCount,
          )
        : panelOutline(spec, treatmentsByRole.get(spec.role)!),
      edgeJointIds,
    };
  });
  const panelsByRole = new Map(panels.map((panel) => [panel.role, panel]));
  const parts: FabricationPart[] = specs.map((spec) => {
    const panel = panelsByRole.get(spec.role)!;
    const panelJoints = joints.filter(
      (joint) => joint.panelAId === panel.id || joint.panelBId === panel.id,
    );
    const labels: FabricationLabel[] = [
      {
        id: `${panel.id}-label`,
        text: spec.role.toUpperCase(),
        position: { x: 0, y: 0 },
        operation: 'engrave',
        entityId: panel.id,
      },
    ];
    for (const joint of panelJoints) {
      const location = joint.panelAId === panel.id ? joint.edgeA : joint.edgeB;
      const position =
        location === 'face'
          ? ((joint.panelAId === panel.id
              ? (joint.receiverCentreAMm ?? joint.receiverCentreMm)
              : joint.receiverCentreMm) ?? { x: 0, y: 0 })
          : (() => {
              const geometry = edgeGeometry(location, spec.widthMm, spec.heightMm);
              const midpoint = pointAlong(geometry.start, geometry.end, 0.5);
              return {
                x: midpoint.x - geometry.outward.x * 2.5,
                y: midpoint.y - geometry.outward.y * 2.5,
              };
            })();
      labels.push({
        id: `${joint.id}-${spec.role}-label`,
        text: joint.pairLabel,
        position: roundedPoint(position),
        operation: 'engrave',
        entityId: joint.id,
      });
    }
    return {
      id: panel.partId,
      name: spec.name,
      label: spec.role.toUpperCase(),
      thicknessMm: thicknessForRole(spec.role, input.settings, input.material),
      sourceReference: inputSourceId(input),
      paths: [
        {
          id: `${panel.id}-outline`,
          operation: 'cut',
          closed: true,
          contourRole: 'outer',
          points: panel.outline,
          panelId: panel.id,
        },
        ...dividerReceiverSlotPaths(
          spec.role,
          joints,
          dividerThicknessMm(input.settings, input.material),
          input.settings.clearanceMm,
        ),
        ...(spec.role === 'base' ? dividerBaseSlots(input.settings, input.material, specs) : []),
      ],
      labels,
      construction: {
        panelId: panel.id,
        role: panel.role,
        jointIds: panelJoints.map((joint) => joint.id),
      },
    };
  });
  const featureApplication = applyPanelFeatures(
    input.settings.features ?? [],
    panels,
    parts,
    input.material,
    (role) => thicknessForRole(role, input.settings, input.material),
  );
  const edited = applyPanelConnectionEditing(input, panels, joints, featureApplication.parts);
  const assembledPreviewPanels = assembledPanels(
    input.settings,
    edited.panels,
    edited.parts,
    specs,
  );
  return {
    settings: input.settings,
    material: input.material,
    panels: edited.panels,
    joints: edited.joints,
    parts: edited.parts,
    tabs: edited.tabs,
    issues: [...issues, ...featureApplication.issues, ...edited.issues],
    assembledPreview: {
      panels: assembledPreviewPanels,
    },
    editableEdges: editablePanelEdges(
      input.settings,
      edited.panels,
      edited.joints,
      assembledPreviewPanels,
    ),
    algorithmVersion: PANEL_CONSTRUCTION_ALGORITHM_VERSION,
    inputHash: deterministicPanelConstructionHash(input),
  };
}
