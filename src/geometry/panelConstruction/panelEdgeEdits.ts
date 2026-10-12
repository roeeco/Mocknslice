import { booleanPerimeter } from '../designGraph/booleanPerimeter';
import type {
  PanelConstructionJoint,
  PanelConstructionPanel,
  PanelConstructionResult,
  PanelConstructionSettings,
  PanelEdgeName,
} from '../../domain/panelConstruction';
import type { Point2D } from '../../domain/geometry';
import type { AssembledFoldPanel, FoldTab } from '../../domain/folding';
import type { FabricationPart, FabricationPath } from '../../domain/fabrication';
import type { ValidationIssue } from '../../domain/validation';
import type { BoundarySegment, TopologyConnection } from '../connections/topology2d';
import {
  glueTabOutline,
  layoutCreaseComponents,
  polygonsOverlap,
  sameSegment,
  traceClosedContours,
  transformPoint,
} from '../connections/topology2d';
import type { PanelConstructionInput } from './constructionTypes';
import { edgeOrder, inputSourceId, thicknessForRole } from './constructionHelpers';
import { edgeGeometry, isDividerRole, pointAlong } from './fingerJoints';

export function logicalPanelEdge(
  panel: PanelConstructionPanel,
  edge: PanelEdgeName,
  sharedLengthMm?: number,
): { start: Point2D; end: Point2D } {
  const geometry = edgeGeometry(edge, panel.widthMm, panel.heightMm);
  const length = Math.hypot(geometry.end.x - geometry.start.x, geometry.end.y - geometry.start.y);
  if (sharedLengthMm !== undefined && sharedLengthMm < length - 1e-6) {
    const guard = (length - sharedLengthMm) / 2;
    return {
      start: pointAlong(geometry.start, geometry.end, guard / length),
      end: pointAlong(geometry.start, geometry.end, 1 - guard / length),
    };
  }
  return { start: geometry.start, end: geometry.end };
}

export function editablePanelEdges(
  settings: PanelConstructionSettings,
  panels: readonly PanelConstructionPanel[],
  joints: readonly PanelConstructionJoint[],
  assembled: readonly AssembledFoldPanel[],
): NonNullable<PanelConstructionResult['editableEdges']> {
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const assembledById = new Map(assembled.map((panel) => [panel.id, panel]));
  const result: NonNullable<PanelConstructionResult['editableEdges']> = [];
  const worldSegment = (panelId: string, edge: PanelEdgeName, sharedLengthMm?: number) => {
    const panel = panelById.get(panelId)!;
    const assembledPanel = assembledById.get(panelId)!;
    const geometry = logicalPanelEdge(panel, edge, sharedLengthMm);
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
    const segment = worldSegment(
      joint.panelAId,
      joint.edgeA as PanelEdgeName,
      joint.sharedLengthMm,
    );
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

export function applyPanelConnectionEditing(
  input: PanelConstructionInput,
  panels: PanelConstructionPanel[],
  joints: PanelConstructionJoint[],
  parts: FabricationPart[],
  native = false,
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
        edgeA: logicalPanelEdge(panelA, joint.edgeA, joint.sharedLengthMm),
        edgeB: logicalPanelEdge(panelB, joint.edgeB, joint.sharedLengthMm),
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
  const tabEdges = new Map<
    string,
    { id: string; panelId: string; edge: PanelEdgeName; sharedLengthMm?: number }
  >();
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
    tabEdges.set(`${ownerId}:${edge}`, {
      id: `${joint.id}-glue-tab`,
      panelId: ownerId,
      edge,
      sharedLengthMm: joint.sharedLengthMm,
    });
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
          const logical = logicalPanelEdge(panel, candidate.edge, candidate.sharedLengthMm);
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
        const logical = logicalPanelEdge(panel, tab.edge, tab.sharedLengthMm);
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
    const contours = native
      ? (booleanPerimeter([
          ...componentPanels.map((panel) =>
            panel.outline.map((point) => transformPoint(point, layout.transforms.get(panel.id)!)),
          ),
          ...tabs.filter((tab) => tab.partId === partId).map((tab) => tab.outline),
        ]) ?? [])
      : traceClosedContours(segments);
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
