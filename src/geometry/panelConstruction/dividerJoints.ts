import type {
  CurrentPanelJointKind,
  PanelConstructionJoint,
  PanelConstructionMaterial,
  PanelConstructionSettings,
  PanelRole,
} from '../../domain/panelConstruction';
import type { FabricationPath } from '../../domain/fabrication';
import type { PanelConnectionTreatment } from '../../domain/connections';
import type { DividerSideJointSpec, JointSpec, PanelSpec } from './constructionTypes';
import { dividerThicknessMm, rounded, roundedPoint } from './constructionHelpers';
import { dividerTabWidth, isDividerRole } from './fingerJoints';

export function dividerBaseSlots(
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

export function jointSpecs(settings: PanelConstructionSettings): JointSpec[] {
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

export function resolvedConnection(
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

export function dividerSideJointSpecs(
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

export function crossingDividerJoints(
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

export function dividerReceiverSlotPaths(
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
