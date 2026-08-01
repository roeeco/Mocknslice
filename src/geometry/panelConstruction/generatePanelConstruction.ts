import type { FabricationLabel, FabricationPart, FabricationPath } from '../../domain/fabrication';
import type { AssembledFoldPanel } from '../../domain/folding';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import type {
  PanelConstructionJoint,
  PanelConstructionMaterial,
  PanelConstructionPanel,
  PanelConstructionResult,
  PanelConstructionSettings,
  PanelEdgeName,
  PanelJointKind,
  PanelRole,
} from '../../domain/panelConstruction';
import type { ValidationIssue } from '../../domain/validation';

export const PANEL_CONSTRUCTION_ALGORITHM_VERSION = 'rectangular-joints-v3';

export interface PanelConstructionInput {
  modelId: string;
  material: PanelConstructionMaterial;
  settings: PanelConstructionSettings;
}

interface PanelSpec {
  role: PanelRole;
  name: string;
  widthMm: number;
  heightMm: number;
  dividerPositionMm?: number;
}

interface JointSpec {
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
  kind: PanelJointKind;
  segmentCount: number;
  phase: 0 | 1;
  depthMm: number;
  slotReceiver: boolean;
}

const edgeOrder: PanelEdgeName[] = ['bottom', 'right', 'top', 'left'];

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function dividerCountFor(settings: PanelConstructionSettings): number {
  return settings.dividerCount ?? 0;
}

function dividerAxisFor(settings: PanelConstructionSettings): 'width' | 'depth' {
  return settings.dividerAxis === 'depth' ? 'depth' : 'width';
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
    input.modelId,
    input.material.id,
    input.material.category,
    input.material.thicknessMm,
    input.material.kerfMm,
    input.settings.innerWidthMm,
    input.settings.innerDepthMm,
    input.settings.innerHeightMm,
    input.settings.jointKind,
    input.settings.fingerWidthMm,
    input.settings.clearanceMm,
    input.settings.includeLid,
    dividerCountFor(input.settings),
    dividerAxisFor(input.settings),
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
    if (!treatment || treatment.kind === 'butt' || treatment.slotReceiver) {
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
        pushUnique(points, {
          x: segmentStart.x + geometry.outward.x * treatment.depthMm,
          y: segmentStart.y + geometry.outward.y * treatment.depthMm,
        });
        pushUnique(points, {
          x: segmentEnd.x + geometry.outward.x * treatment.depthMm,
          y: segmentEnd.y + geometry.outward.y * treatment.depthMm,
        });
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
  thicknessMm: number,
  fingerSegmentCount: number,
): Point2D[] {
  const left = -spec.widthMm / 2;
  const right = spec.widthMm / 2;
  const bottom = -spec.heightMm / 2;
  const top = spec.heightMm / 2;
  const tabWidth = dividerTabWidth(spec.widthMm, thicknessMm);
  const halfTab = tabWidth / 2;
  const tabDepth = thicknessMm;
  const centres = [-spec.widthMm / 4, spec.widthMm / 4];
  const points: Point2D[] = [
    { x: left, y: bottom },
    { x: centres[0]! - halfTab, y: bottom },
    { x: centres[0]! - halfTab, y: bottom - tabDepth },
    { x: centres[0]! + halfTab, y: bottom - tabDepth },
    { x: centres[0]! + halfTab, y: bottom },
    { x: centres[1]! - halfTab, y: bottom },
    { x: centres[1]! - halfTab, y: bottom - tabDepth },
    { x: centres[1]! + halfTab, y: bottom - tabDepth },
    { x: centres[1]! + halfTab, y: bottom },
    { x: right, y: bottom },
  ].map(roundedPoint);
  appendFingerEdge(
    points,
    { x: right, y: bottom },
    { x: right, y: top },
    { x: 1, y: 0 },
    fingerSegmentCount,
    thicknessMm,
  );
  pushUnique(points, { x: left, y: top });
  appendFingerEdge(
    points,
    { x: left, y: top },
    { x: left, y: bottom },
    { x: -1, y: 0 },
    fingerSegmentCount,
    thicknessMm,
  );
  return points;
}

function dividerBaseSlots(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
  specs: readonly PanelSpec[],
): FabricationPath[] {
  const paths: FabricationPath[] = [];
  for (const spec of specs.filter((candidate) => isDividerRole(candidate.role))) {
    const position = spec.dividerPositionMm ?? 0;
    const tabWidth = dividerTabWidth(spec.widthMm, material.thicknessMm);
    const slotLength = tabWidth + settings.clearanceMm;
    const slotWidth = material.thicknessMm + settings.clearanceMm;
    const centres = [-spec.widthMm / 4, spec.widthMm / 4];
    centres.forEach((alongPosition, index) => {
      const centre =
        dividerAxisFor(settings) === 'width'
          ? { x: alongPosition, y: position }
          : { x: position, y: alongPosition };
      const halfX = (dividerAxisFor(settings) === 'width' ? slotLength : slotWidth) / 2;
      const halfY = (dividerAxisFor(settings) === 'width' ? slotWidth : slotLength) / 2;
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

function slotPaths(
  spec: PanelSpec,
  treatments: ReadonlyMap<PanelEdgeName, EdgeTreatment>,
  clearanceMm: number,
): FabricationPath[] {
  const paths: FabricationPath[] = [];
  for (const edge of edgeOrder) {
    const treatment = treatments.get(edge);
    if (!treatment?.slotReceiver) continue;
    const geometry = edgeGeometry(edge, spec.widthMm, spec.heightMm);
    const length = Math.hypot(geometry.end.x - geometry.start.x, geometry.end.y - geometry.start.y);
    const tangent = {
      x: (geometry.end.x - geometry.start.x) / length,
      y: (geometry.end.y - geometry.start.y) / length,
    };
    const inward = { x: -geometry.outward.x, y: -geometry.outward.y };
    const pitch = length / treatment.segmentCount;
    const slotLength = pitch + clearanceMm;
    const slotDepth = treatment.depthMm + clearanceMm;
    const inset = slotDepth / 2 + Math.max(0.5, treatment.depthMm * 0.25);
    for (let index = 0; index < treatment.segmentCount; index += 1) {
      if ((index + treatment.phase) % 2 !== 0) continue;
      const midpoint = pointAlong(
        geometry.start,
        geometry.end,
        (index + 0.5) / treatment.segmentCount,
      );
      const centre = {
        x: midpoint.x + inward.x * inset,
        y: midpoint.y + inward.y * inset,
      };
      const along = { x: tangent.x * (slotLength / 2), y: tangent.y * (slotLength / 2) };
      const across = { x: inward.x * (slotDepth / 2), y: inward.y * (slotDepth / 2) };
      paths.push({
        id: `${treatment.jointId}-${spec.role}-slot-${index + 1}`,
        operation: 'cut',
        closed: true,
        contourRole: 'hole',
        panelId: `construction-panel-${spec.role}`,
        edgeId: treatment.jointId,
        points: [
          roundedPoint({ x: centre.x - along.x - across.x, y: centre.y - along.y - across.y }),
          roundedPoint({ x: centre.x + along.x - across.x, y: centre.y + along.y - across.y }),
          roundedPoint({ x: centre.x + along.x + across.x, y: centre.y + along.y + across.y }),
          roundedPoint({ x: centre.x - along.x + across.x, y: centre.y - along.y + across.y }),
        ],
      });
    }
  }
  return paths;
}

function panelSpecs(settings: PanelConstructionSettings): PanelSpec[] {
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
    },
    {
      role: 'back',
      name: 'Back panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerHeightMm,
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
  const dividerCount = dividerCountFor(settings);
  const dividerSpanMm =
    dividerAxisFor(settings) === 'width' ? settings.innerWidthMm : settings.innerDepthMm;
  const positionSpanMm =
    dividerAxisFor(settings) === 'width' ? settings.innerDepthMm : settings.innerWidthMm;
  for (let index = 0; index < dividerCount; index += 1) {
    specs.push({
      role: `divider-${index + 1}`,
      name: `Divider ${index + 1}`,
      widthMm: dividerSpanMm,
      heightMm: settings.innerHeightMm,
      dividerPositionMm: -positionSpanMm / 2 + (positionSpanMm * (index + 1)) / (dividerCount + 1),
    });
  }
  return specs;
}

function jointSpecs(settings: PanelConstructionSettings): JointSpec[] {
  const joints: JointSpec[] = [
    {
      panelA: 'base',
      panelB: 'front',
      edgeA: 'bottom',
      edgeB: 'bottom',
      lengthMm: settings.innerWidthMm,
    },
    {
      panelA: 'base',
      panelB: 'back',
      edgeA: 'top',
      edgeB: 'bottom',
      lengthMm: settings.innerWidthMm,
    },
    {
      panelA: 'base',
      panelB: 'left',
      edgeA: 'left',
      edgeB: 'bottom',
      lengthMm: settings.innerDepthMm,
    },
    {
      panelA: 'base',
      panelB: 'right',
      edgeA: 'right',
      edgeB: 'bottom',
      lengthMm: settings.innerDepthMm,
    },
    {
      panelA: 'front',
      panelB: 'left',
      edgeA: 'left',
      edgeB: 'left',
      lengthMm: settings.innerHeightMm,
    },
    {
      panelA: 'front',
      panelB: 'right',
      edgeA: 'right',
      edgeB: 'left',
      lengthMm: settings.innerHeightMm,
    },
    {
      panelA: 'back',
      panelB: 'left',
      edgeA: 'left',
      edgeB: 'right',
      lengthMm: settings.innerHeightMm,
    },
    {
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
        panelA: 'lid',
        panelB: 'front',
        edgeA: 'bottom',
        edgeB: 'top',
        lengthMm: settings.innerWidthMm,
      },
      {
        panelA: 'lid',
        panelB: 'back',
        edgeA: 'top',
        edgeB: 'top',
        lengthMm: settings.innerWidthMm,
      },
      {
        panelA: 'lid',
        panelB: 'left',
        edgeA: 'left',
        edgeB: 'top',
        lengthMm: settings.innerDepthMm,
      },
      {
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

function dividerSideJointSpecs(
  settings: PanelConstructionSettings,
  specs: readonly PanelSpec[],
): DividerSideJointSpec[] {
  const axis = dividerAxisFor(settings);
  const result: DividerSideJointSpec[] = [];
  for (const spec of specs) {
    if (!isDividerRole(spec.role)) continue;
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
    const position = specsByRole.get(role)?.dividerPositionMm ?? 0;
    return dividerAxisFor(settings) === 'width'
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

function inputIssues(input: PanelConstructionInput): ValidationIssue[] {
  const { settings, material } = input;
  const dimensions = [settings.innerWidthMm, settings.innerDepthMm, settings.innerHeightMm];
  if (
    dimensions.some((value) => !Number.isFinite(value) || value <= 0) ||
    !Number.isFinite(settings.fingerWidthMm) ||
    settings.fingerWidthMm <= 0 ||
    !Number.isFinite(settings.clearanceMm) ||
    settings.clearanceMm < 0 ||
    !Number.isFinite(material.thicknessMm) ||
    material.thicknessMm <= 0 ||
    !Number.isInteger(dividerCountFor(settings)) ||
    dividerCountFor(settings) < 0 ||
    dividerCountFor(settings) > 6
  ) {
    return [
      {
        id: `panel-settings-invalid-${input.modelId}`,
        severity: 'error',
        code: 'PANEL_SETTINGS_INVALID',
        message:
          'Panel dimensions, material thickness, and finger width must be positive; clearance cannot be negative.',
        affectedEntityIds: [input.modelId],
        suggestedAction: 'Correct the panel-construction dimensions and generate again.',
      },
    ];
  }
  const issues: ValidationIssue[] = [];
  const dividerCount = dividerCountFor(settings);
  const usesFingers = settings.jointKind !== 'butt' || dividerCount > 0;
  const dividedSpan =
    dividerAxisFor(settings) === 'width' ? settings.innerDepthMm : settings.innerWidthMm;
  if (dividerCount > 0 && dividedSpan / (dividerCount + 1) < material.thicknessMm * 4) {
    issues.push({
      id: `panel-divider-spacing-${input.modelId}`,
      severity: 'error',
      code: 'PANEL_DIVIDER_SPACING_TOO_NARROW',
      message: 'The requested dividers leave sections narrower than four material thicknesses.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Use fewer dividers, a larger box, or thinner material.',
    });
  }
  if (Math.min(...dimensions) < material.thicknessMm * 4) {
    issues.push({
      id: `panel-dimension-too-small-${input.modelId}`,
      severity: 'error',
      code: 'PANEL_DIMENSION_TOO_SMALL',
      message: 'Every enclosure dimension must be at least four material thicknesses.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Increase the enclosure dimensions or choose thinner material.',
    });
  }
  if (usesFingers && settings.fingerWidthMm < material.thicknessMm * 1.5) {
    issues.push({
      id: `panel-finger-narrow-${input.modelId}`,
      severity: 'warning',
      code: 'PANEL_FINGER_TOO_NARROW',
      message: 'The target finger width is narrow relative to material thickness.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Increase finger width and test the joint in scrap material.',
    });
  }
  const shortestJoint = Math.min(...dimensions);
  const minimumPitch = shortestJoint / segmentCount(shortestJoint, settings.fingerWidthMm);
  const dividerPitch =
    settings.innerHeightMm / segmentCount(settings.innerHeightMm, settings.fingerWidthMm);
  if (usesFingers && settings.fingerWidthMm > shortestJoint / 3) {
    issues.push({
      id: `panel-finger-sparse-${input.modelId}`,
      severity: 'warning',
      code: 'PANEL_TOO_FEW_FINGERS',
      message: 'The target width produces only a few large fingers on at least one joint.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Reduce target finger width for better load distribution.',
    });
  }
  if (usesFingers && Math.min(minimumPitch, dividerPitch) <= material.kerfMm * 4) {
    issues.push({
      id: `panel-finger-kerf-${input.modelId}`,
      severity: 'warning',
      code: 'PANEL_FINGER_NEAR_KERF_LIMIT',
      message: 'At least one finger pitch is very small relative to the material kerf.',
      affectedEntityIds: [input.modelId, material.id],
      suggestedAction: 'Use wider fingers or a lower-kerf cutting process.',
    });
  }
  if (settings.jointKind === 'tab-slot' && settings.clearanceMm >= minimumPitch) {
    issues.push({
      id: `panel-clearance-large-${input.modelId}`,
      severity: 'error',
      code: 'PANEL_CLEARANCE_TOO_LARGE',
      message: 'Slot clearance is at least as large as the narrowest tab pitch.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Reduce slot clearance or use wider fingers.',
    });
  }
  if (dividerCount > 0 && settings.clearanceMm >= dividerPitch) {
    issues.push({
      id: `panel-divider-clearance-large-${input.modelId}`,
      severity: 'error',
      code: 'PANEL_DIVIDER_CLEARANCE_TOO_LARGE',
      message: 'Divider slot clearance is at least as large as the side-finger pitch.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Reduce slot clearance or use wider divider fingers.',
    });
  }
  if (
    usesFingers &&
    (material.category === 'paper' || (material.category === 'card' && material.thicknessMm < 0.8))
  ) {
    issues.push({
      id: `panel-flexible-material-${input.modelId}`,
      severity: 'warning',
      code: 'PANEL_RIGID_JOINT_MATERIAL_REVIEW',
      message:
        'Finger and tab-slot joints are intended for rigid sheet material; paper or card may tear.',
      affectedEntityIds: [material.id],
      suggestedAction: 'Use a rigid material or choose butt joints with adhesive.',
    });
  }
  if (settings.jointKind === 'butt') {
    issues.push({
      id: `panel-butt-fastener-${input.modelId}`,
      severity: 'info',
      code: 'PANEL_BUTT_JOINT_FASTENER_REQUIRED',
      message: 'Butt-joint panels require adhesive, tape, or external fasteners.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Plan the assembly method before cutting.',
    });
  }
  if (settings.includeLid && settings.jointKind !== 'butt') {
    issues.push({
      id: `panel-closed-assembly-${input.modelId}`,
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
  const issues = inputIssues(input);
  if (issues.some((issue) => issue.severity === 'error')) return emptyResult(input, issues);
  const specs = panelSpecs(input.settings);
  const specsByRole = new Map(specs.map((spec) => [spec.role, spec]));
  const treatmentsByRole = new Map<PanelRole, Map<PanelEdgeName, EdgeTreatment>>(
    specs.map((spec) => [spec.role, new Map()]),
  );
  const enclosureJoints: PanelConstructionJoint[] = jointSpecs(input.settings).map(
    (spec, index) => {
      const id = `construction-joint-${index + 1}`;
      const count =
        input.settings.jointKind === 'butt'
          ? 0
          : segmentCount(spec.lengthMm, input.settings.fingerWidthMm);
      const tabOwnerPanelId =
        input.settings.jointKind === 'tab-slot' ? `construction-panel-${spec.panelA}` : undefined;
      const treatmentA: EdgeTreatment = {
        jointId: id,
        kind: input.settings.jointKind,
        segmentCount: count,
        phase: 0,
        depthMm: input.material.thicknessMm,
        slotReceiver: false,
      };
      const treatmentB: EdgeTreatment = {
        jointId: id,
        kind: input.settings.jointKind,
        segmentCount: count,
        phase: input.settings.jointKind === 'finger' ? 1 : 0,
        depthMm: input.material.thicknessMm,
        slotReceiver: input.settings.jointKind === 'tab-slot',
      };
      treatmentsByRole.get(spec.panelA)!.set(spec.edgeA, treatmentA);
      treatmentsByRole.get(spec.panelB)!.set(spec.edgeB, treatmentB);
      return {
        id,
        kind: input.settings.jointKind,
        panelAId: `construction-panel-${spec.panelA}`,
        panelBId: `construction-panel-${spec.panelB}`,
        edgeA: spec.edgeA,
        edgeB: spec.edgeB,
        sharedLengthMm: rounded(spec.lengthMm),
        fingerCount: count,
        clearanceMm: rounded(input.settings.clearanceMm),
        pairLabel: `J${index + 1}`,
        ...(tabOwnerPanelId ? { tabOwnerPanelId } : {}),
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
  const joints = [...enclosureJoints, ...dividerJoints];
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
        ? dividerOutline(spec, input.material.thicknessMm, dividerFingerCount)
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
          ? (joint.receiverCentreMm ?? { x: 0, y: 0 })
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
      thicknessMm: input.material.thicknessMm,
      sourceReference: input.modelId,
      paths: [
        {
          id: `${panel.id}-outline`,
          operation: 'cut',
          closed: true,
          contourRole: 'outer',
          points: panel.outline,
          panelId: panel.id,
        },
        ...slotPaths(
          specsByRole.get(spec.role)!,
          treatmentsByRole.get(spec.role)!,
          input.settings.clearanceMm,
        ),
        ...dividerReceiverSlotPaths(
          spec.role,
          joints,
          input.material.thicknessMm,
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
  return {
    settings: input.settings,
    material: input.material,
    panels,
    joints,
    parts,
    issues,
    assembledPreview: { panels: assembledPanels(input.settings, panels, parts, specs) },
    algorithmVersion: PANEL_CONSTRUCTION_ALGORITHM_VERSION,
    inputHash: deterministicPanelConstructionHash(input),
  };
}
