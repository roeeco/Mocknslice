import { nativePanelOutline } from './nativePanelOutline';
import { cleanPanelPerimeter } from './cleanPanelPerimeter';
import { validateReciprocalJoints } from './validateReciprocalJoints';
import { hashSerializable } from '../../domain/canonicalHash';
import type {
  PanelConstructionJoint,
  PanelConstructionPanel,
  PanelConstructionResult,
  PanelEdgeName,
  PanelRole,
} from '../../domain/panelConstruction';
import { DEFAULT_PANEL_PROFILES } from '../../domain/panelConstruction';
import type { ValidationIssue } from '../../domain/validation';
import type { FabricationLabel, FabricationPart } from '../../domain/fabrication';
import { applyPanelFeatures } from './panelFeatures';
import { PANEL_CONSTRUCTION_ALGORITHM_VERSION } from './constructionConstants';
import type { EdgeTreatment, PanelConstructionInput } from './constructionTypes';
import {
  dividerCountsFor,
  dividerThicknessMm,
  fnv1a,
  inputSourceId,
  lidThicknessMm,
  panelThicknessMm,
  rounded,
  roundedPoint,
  thicknessForRole,
} from './constructionHelpers';
import {
  dividerOutline,
  edgeGeometry,
  isDividerRole,
  panelOutline,
  pointAlong,
  segmentCount,
} from './fingerJoints';
import {
  crossingDividerJoints,
  dividerBaseSlots,
  dividerReceiverSlotPaths,
  dividerSideJointSpecs,
  jointSpecs,
  resolvedConnection,
} from './dividerJoints';
import { panelSpecs } from './panelSpecs';
import { assembledPanels } from './assembledPanels';
import { applyPanelConnectionEditing, editablePanelEdges } from './panelEdgeEdits';
import { inputIssues } from './validateConstruction';
export { PANEL_CONSTRUCTION_ALGORITHM_VERSION } from './constructionConstants';
export type { PanelConstructionInput } from './constructionTypes';

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

export function generatePanelConstruction(
  input: PanelConstructionInput,
  options?: { validateReciprocal?: boolean },
): PanelConstructionResult {
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
        phase: spec.panelA === 'base' || spec.panelA === 'lid' ? 1 : 0,
        relief: spec.panelA === 'base' || spec.panelA === 'lid' ? 'protrude' : 'inset',
        depthMm: thicknessForRole(spec.panelB, input.settings, input.material),
        clearanceMm: resolved.fabricationClearanceMm,
        startGuardMm: 0,
        endGuardMm: 0,
        startFingerExtensionMm: 0,
        endFingerExtensionMm: 0,
        suppressStartFinger: false,
        suppressEndFinger: false,
      };
      const treatmentB: EdgeTreatment = {
        jointId: id,
        kind: resolved.kind,
        segmentCount: count,
        phase: 0,
        relief: 'protrude',
        depthMm: thicknessForRole(spec.panelA, input.settings, input.material),
        clearanceMm: resolved.fabricationClearanceMm,
        startGuardMm:
          (spec.panelB === 'front' || spec.panelB === 'back') &&
          (spec.edgeB === 'bottom' || spec.edgeB === 'top')
            ? panelThicknessMm(input.settings, input.material)
            : 0,
        endGuardMm:
          (spec.panelB === 'front' || spec.panelB === 'back') &&
          (spec.edgeB === 'bottom' || spec.edgeB === 'top')
            ? panelThicknessMm(input.settings, input.material)
            : 0,
        startFingerExtensionMm:
          (spec.panelB === 'left' || spec.panelB === 'right') &&
          (spec.edgeB === 'bottom' || spec.edgeB === 'top')
            ? panelThicknessMm(input.settings, input.material)
            : 0,
        endFingerExtensionMm:
          (spec.panelB === 'left' || spec.panelB === 'right') &&
          (spec.edgeB === 'bottom' || spec.edgeB === 'top')
            ? panelThicknessMm(input.settings, input.material)
            : 0,
        suppressStartFinger: false,
        suppressEndFinger: false,
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
    options?.validateReciprocal
      ? {
          ...input.settings,
          clearanceMm: input.settings.roleClearanceMm?.divider ?? input.settings.clearanceMm,
        }
      : input.settings,
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
            options?.validateReciprocal
              ? (input.settings.roleClearanceMm?.divider ?? input.settings.clearanceMm)
              : input.settings.clearanceMm,
          )
        : options?.validateReciprocal
          ? (() => {
              const outline = nativePanelOutline(spec, treatmentsByRole.get(spec.role)!);
              if (!outline)
                issues.push({
                  id: `native-panel-contour-${spec.role}`,
                  code: 'PANEL_CONTOUR_INVALID',
                  severity: 'error',
                  message: 'Panel material boundary exceeded its budget or could not be verified.',
                  affectedEntityIds: [`construction-panel-${spec.role}`],
                });
              return outline ?? panelOutline(spec, treatmentsByRole.get(spec.role)!);
            })()
          : panelOutline(spec, treatmentsByRole.get(spec.role)!),
      edgeJointIds,
    };
  });
  if (options?.validateReciprocal)
    for (const panel of panels) {
      const cleaned = cleanPanelPerimeter(panel.outline);
      if (cleaned) panel.outline = cleaned;
    }
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
  const reciprocalIssues = options?.validateReciprocal
    ? validateReciprocalJoints(input.settings, input.material, panels, joints, parts)
    : [];
  const featureApplication = applyPanelFeatures(
    input.settings.features ?? [],
    panels,
    parts,
    input.material,
    (role) => thicknessForRole(role, input.settings, input.material),
  );
  const edited = applyPanelConnectionEditing(
    input,
    panels,
    joints,
    featureApplication.parts,
    Boolean(options?.validateReciprocal),
  );
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
    issues: [...issues, ...reciprocalIssues, ...featureApplication.issues, ...edited.issues],
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
