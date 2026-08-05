import type { FabricationPart, FabricationPath } from '../../domain/fabrication';
import type {
  AssembledFoldPanel,
  FoldConnection,
  FoldEdgeDefinition,
  FoldPanel,
  FoldTab,
  TemplateFitSettings,
  TemplateGenerationResult,
} from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
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

interface EditableBuiltTemplate {
  panels: FoldPanel[];
  edges: FoldEdgeDefinition[];
  connections: FoldConnection[];
  tabs: FoldTab[];
  parts: FabricationPart[];
  assembled: AssembledFoldPanel[];
  issues: ValidationIssue[];
}

function issue(
  id: string,
  code: string,
  message: string,
  affectedEntityIds: string[],
  suggestedAction: string,
): ValidationIssue {
  return { id, severity: 'error', code, message, affectedEntityIds, suggestedAction };
}

function editableEdgesFor(
  built: EditableBuiltTemplate,
): NonNullable<TemplateGenerationResult['editableEdges']> {
  const panels = new Map(built.panels.map((panel) => [panel.id, panel]));
  const assembled = new Map(built.assembled.map((panel) => [panel.id, panel]));
  const worldPoint = (panelId: string, point: Point2D) => {
    const panel = panels.get(panelId);
    const preview = assembled.get(panelId);
    const index = panel?.outline.findIndex(
      (candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 1e-5,
    );
    return preview?.verticesMm[index !== undefined && index >= 0 ? index : 0] ?? [0, 0, 0];
  };
  return [
    ...built.connections.map((connection) => ({
      id: connection.id,
      kind: 'connection' as const,
      panelAId: connection.panelAId,
      panelBId: connection.panelBId,
      startMm: worldPoint(connection.panelAId, connection.edgeA.start),
      endMm: worldPoint(connection.panelAId, connection.edgeA.end),
      editable: true,
    })),
    ...built.edges
      .filter((edge) => edge.disposition === 'boundary')
      .map((edge) => ({
        id: edge.id,
        kind: 'boundary' as const,
        panelAId: edge.panelAId,
        startMm: worldPoint(edge.panelAId, edge.start),
        endMm: worldPoint(edge.panelAId, edge.end),
        editable: true,
      })),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function tabSegments(outline: Point2D[], panelId: string, tabId: string): BoundarySegment[] {
  return outline.slice(0, -1).map((start, index) => ({
    start,
    end: outline[index + 1]!,
    panelId,
    tabId,
  }));
}

function centroid(points: readonly Point2D[]): Point2D {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function applyFoldingConnectionEditing(
  built: EditableBuiltTemplate,
  settings: TemplateFitSettings,
  thicknessMm: number,
): EditableBuiltTemplate & {
  editableEdges: NonNullable<TemplateGenerationResult['editableEdges']>;
} {
  const overrides = (settings.connectionOverrides ?? []).filter(
    (override) => override.templateKind === settings.templateKind,
  );
  const boundaryRecords = (settings.boundaryGlueTabs ?? []).filter(
    (tab) => tab.templateKind === settings.templateKind,
  );
  const editableEdges = editableEdgesFor(built);
  if (overrides.length === 0 && boundaryRecords.length === 0) return { ...built, editableEdges };

  const issues = [...built.issues];
  const connectionById = new Map(
    built.connections.map((connection) => [connection.id, connection]),
  );
  for (const override of overrides) {
    if (!connectionById.has(override.connectionId)) {
      issues.push(
        issue(
          `fold-connection-missing-${override.id}`,
          'CONNECTION_ID_UNKNOWN',
          'A folding override targets a connection that is not present in the active template.',
          [override.id, override.connectionId],
          'Reset the missing connection override and select an edge from the regenerated preview.',
        ),
      );
    }
  }
  const overrideByConnection = new Map(
    overrides.map((override) => [override.connectionId, override]),
  );
  const desired = built.connections.map((connection) => {
    const override = overrideByConnection.get(connection.id);
    return {
      connection,
      treatment: override?.treatment ?? (connection.disposition === 'hinge' ? 'crease' : 'cut'),
      closure:
        override?.closure ??
        (connection.closure === 'glue-tab' || connection.closure === 'press-fit'
          ? connection.closure
          : 'none'),
      ownerPanelId:
        override?.tabOwnerPanelId ??
        built.tabs.find((tab) => connection.tabIds.includes(tab.id))?.ownerPanelId,
    } as const;
  });
  for (const target of desired) {
    if (target.treatment === 'crease' && target.closure !== 'none') {
      issues.push(
        issue(
          `fold-crease-closure-${target.connection.id}`,
          'CONNECTION_TREATMENT_CONFLICT',
          'A scored crease cannot also use a seam closure.',
          [target.connection.id],
          'Set closure to none or change the treatment to cut.',
        ),
      );
    }
    if (
      target.treatment === 'cut' &&
      target.closure !== 'none' &&
      target.ownerPanelId !== target.connection.panelAId &&
      target.ownerPanelId !== target.connection.panelBId
    ) {
      issues.push(
        issue(
          `fold-tab-owner-${target.connection.id}`,
          'CONNECTION_TAB_OWNER_INVALID',
          'A folding seam closure requires an explicit owner from the connected panel pair.',
          [target.connection.id, target.ownerPanelId ?? 'missing-owner'],
          'Select one connected panel as the tab owner.',
        ),
      );
    }
  }

  const creaseConnections: TopologyConnection[] = desired
    .filter((target) => target.treatment === 'crease')
    .map(({ connection }) => {
      const alreadyAligned = sameSegment(
        connection.edgeA.start,
        connection.edgeA.end,
        connection.edgeB.start,
        connection.edgeB.end,
      );
      return {
        id: connection.id,
        panelAId: connection.panelAId,
        panelBId: connection.panelBId,
        edgeA: connection.edgeA,
        edgeB: alreadyAligned
          ? { start: connection.edgeB.end, end: connection.edgeB.start }
          : connection.edgeB,
      };
    });
  const layout = layoutCreaseComponents(built.panels, creaseConnections);
  if (layout.cycleConnectionIds.length > 0) {
    issues.push(
      issue(
        'fold-crease-cycle',
        'CONNECTION_CREASE_CYCLE',
        'The selected folding creases form a cycle and cannot be laid out as an acyclic net.',
        layout.cycleConnectionIds,
        'Change at least one connection in the cycle to cut.',
      ),
    );
  }
  if (issues.some((candidate) => candidate.severity === 'error')) {
    return { ...built, issues, editableEdges };
  }

  const depthMm = settings.glueTabDepthMm ?? 8;
  const panelById = new Map(built.panels.map((panel) => [panel.id, panel]));
  const generatedTabs: FoldTab[] = [];
  const parts: FabricationPart[] = [];
  const connectionTabEdges = new Map<
    string,
    {
      id: string;
      panelId: string;
      start: Point2D;
      end: Point2D;
      style: 'glue' | 'press-fit';
      receiverPanelId?: string;
      receiverStart?: Point2D;
      receiverEnd?: Point2D;
    }
  >();
  for (const target of desired.filter(
    (candidate) => candidate.treatment === 'cut' && candidate.closure !== 'none',
  )) {
    const ownerIsA = target.ownerPanelId === target.connection.panelAId;
    const segment = ownerIsA ? target.connection.edgeA : target.connection.edgeB;
    const receiverSegment = ownerIsA ? target.connection.edgeB : target.connection.edgeA;
    connectionTabEdges.set(`${target.ownerPanelId}:${target.connection.id}`, {
      id: `${target.connection.id}-manual-tab`,
      panelId: target.ownerPanelId!,
      start: segment.start,
      end: segment.end,
      style: target.closure === 'press-fit' ? 'press-fit' : 'glue',
      ...(target.closure === 'press-fit'
        ? {
            receiverPanelId: ownerIsA ? target.connection.panelBId : target.connection.panelAId,
            receiverStart: receiverSegment.start,
            receiverEnd: receiverSegment.end,
          }
        : {}),
    });
  }
  for (const record of boundaryRecords) {
    const edge = built.edges.find(
      (candidate) =>
        candidate.id === record.edgeId &&
        candidate.disposition === 'boundary' &&
        candidate.panelAId === record.ownerPanelId,
    );
    if (!edge) {
      issues.push(
        issue(
          `fold-boundary-tab-${record.id}`,
          'BOUNDARY_TAB_EDGE_INVALID',
          'A manual glue tab targets a missing or non-boundary folding edge.',
          [record.id, record.edgeId, record.ownerPanelId],
          'Select a straight exposed edge from the active template.',
        ),
      );
      continue;
    }
    connectionTabEdges.set(`${record.ownerPanelId}:${record.edgeId}`, {
      id: record.id,
      panelId: record.ownerPanelId,
      start: edge.start,
      end: edge.end,
      style: 'glue',
    });
  }

  for (const component of layout.components) {
    const segments: BoundarySegment[] = [];
    for (const panelId of component) {
      const panel = panelById.get(panelId)!;
      const transform = layout.transforms.get(panelId)!;
      panel.outline.forEach((start, index) => {
        const end = panel.outline[(index + 1) % panel.outline.length]!;
        const crease = creaseConnections.some((connection) => {
          const edge =
            connection.panelAId === panelId
              ? connection.edgeA
              : connection.panelBId === panelId
                ? connection.edgeB
                : undefined;
          return edge ? sameSegment(start, end, edge.start, edge.end) : false;
        });
        const tab = [...connectionTabEdges.values()].find(
          (candidate) =>
            candidate.panelId === panelId &&
            sameSegment(start, end, candidate.start, candidate.end),
        );
        if (crease || tab) return;
        segments.push({
          start: transformPoint(start, transform),
          end: transformPoint(end, transform),
          panelId,
        });
      });
      for (const tab of [...connectionTabEdges.values()].filter(
        (candidate) => candidate.panelId === panelId,
      )) {
        const length = Math.hypot(tab.end.x - tab.start.x, tab.end.y - tab.start.y);
        if (length < depthMm * 2 || depthMm > Math.min(15, length * 0.35) + 1e-6) {
          issues.push(
            issue(
              `fold-tab-depth-${tab.id}`,
              'GLUE_TAB_DEPTH_INVALID',
              'The manual glue-tab depth is too large for its selected edge.',
              [tab.id, panelId],
              'Reduce manual glue-tab depth or choose a longer edge.',
            ),
          );
          continue;
        }
        const outline = glueTabOutline(tab.start, tab.end, depthMm).map((point) =>
          transformPoint(point, transform),
        );
        const receiverTransform = tab.receiverPanelId
          ? layout.transforms.get(tab.receiverPanelId)
          : undefined;
        const receiverStart =
          receiverTransform && tab.receiverStart
            ? transformPoint(tab.receiverStart, receiverTransform)
            : undefined;
        const receiverEnd =
          receiverTransform && tab.receiverEnd
            ? transformPoint(tab.receiverEnd, receiverTransform)
            : undefined;
        const receiverSlot =
          receiverStart && receiverEnd
            ? (() => {
                const dx = receiverEnd.x - receiverStart.x;
                const dy = receiverEnd.y - receiverStart.y;
                const receiverLength = Math.hypot(dx, dy);
                const unit = { x: dx / receiverLength, y: dy / receiverLength };
                const slotLength = receiverLength * 0.6;
                const centre = {
                  x: (receiverStart.x + receiverEnd.x) / 2,
                  y: (receiverStart.y + receiverEnd.y) / 2,
                };
                return {
                  start: {
                    x: centre.x - unit.x * (slotLength / 2),
                    y: centre.y - unit.y * (slotLength / 2),
                  },
                  end: {
                    x: centre.x + unit.x * (slotLength / 2),
                    y: centre.y + unit.y * (slotLength / 2),
                  },
                };
              })()
            : undefined;
        segments.push(...tabSegments(outline, panelId, tab.id));
        generatedTabs.push({
          id: tab.id,
          partId: '',
          edgeId: `${tab.id}-base`,
          ownerPanelId: panelId,
          style: tab.style,
          depthMm,
          shoulderAngleDeg: tab.style === 'press-fit' ? 12 : 20,
          enabled: true,
          baseStart: transformPoint(tab.start, transform),
          baseEnd: transformPoint(tab.end, transform),
          outline,
          ...(tab.receiverPanelId ? { receiverPanelId: tab.receiverPanelId } : {}),
          ...(receiverSlot ? { slotStart: receiverSlot.start, slotEnd: receiverSlot.end } : {}),
        });
      }
    }
    const partId = `fold-${settings.templateKind}-component-${component.join('-')}`;
    for (const tab of generatedTabs.filter((candidate) =>
      component.includes(candidate.ownerPanelId),
    )) {
      tab.partId = partId;
    }
    const contours = traceClosedContours(segments);
    if (contours.length === 0) {
      issues.push(
        issue(
          `fold-contour-${partId}`,
          'CONNECTION_CONTOUR_INVALID',
          'The edited folding component could not be traced into a closed cut contour.',
          component,
          'Reset the conflicting connection or glue-tab edit.',
        ),
      );
    }
    const scores: FabricationPath[] = creaseConnections
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
    const tabScores: FabricationPath[] = generatedTabs
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
    parts.push({
      id: partId,
      name: `${settings.templateKind} component`,
      label: component.join(' + '),
      thicknessMm,
      paths: [
        ...contours.map((points, index): FabricationPath => ({
          id: `${partId}-outline-${index + 1}`,
          operation: 'cut',
          closed: true,
          contourRole: 'outer',
          points,
        })),
        ...scores,
        ...tabScores,
      ],
      labels: component.map((panelId) => ({
        id: `${panelId}-label`,
        text: panelById.get(panelId)!.name,
        position: transformPoint(
          centroid(panelById.get(panelId)!.outline),
          layout.transforms.get(panelId)!,
        ),
        operation: 'engrave',
        entityId: panelId,
      })),
      folding: { templateKind: settings.templateKind, panelIds: component },
    });
  }

  for (const tab of generatedTabs) {
    for (const panel of built.panels.filter(
      (candidate) =>
        candidate.id !== tab.ownerPanelId &&
        parts.find((part) => part.id === tab.partId)?.folding?.panelIds.includes(candidate.id),
    )) {
      const transformedOutline = panel.outline.map((point) =>
        transformPoint(point, layout.transforms.get(panel.id)!),
      );
      if (!polygonsOverlap(tab.outline, transformedOutline)) continue;
      issues.push(
        issue(
          `fold-tab-overlap-${tab.id}-${panel.id}`,
          'GLUE_TAB_OVERLAP',
          'A manual glue tab overlaps another panel in its flat component.',
          [tab.id, panel.id],
          'Reduce tab depth, choose another owner, or change the nearby crease.',
        ),
      );
    }
    if (!tab.receiverPanelId || !tab.slotStart || !tab.slotEnd) continue;
    const receiverPart = parts.find((part) =>
      part.folding?.panelIds.includes(tab.receiverPanelId!),
    );
    receiverPart?.paths.push({
      id: `${tab.id}-receiver-slit`,
      operation: 'cut',
      closed: false,
      points: [tab.slotStart, tab.slotEnd],
      panelId: tab.receiverPanelId,
      tabId: tab.id,
      edgeId: tab.edgeId,
    });
  }
  for (let first = 0; first < generatedTabs.length; first += 1) {
    for (let second = first + 1; second < generatedTabs.length; second += 1) {
      const tabA = generatedTabs[first]!;
      const tabB = generatedTabs[second]!;
      if (tabA.partId !== tabB.partId || !polygonsOverlap(tabA.outline, tabB.outline)) {
        continue;
      }
      issues.push(
        issue(
          `fold-tab-collision-${tabA.id}-${tabB.id}`,
          'GLUE_TAB_COLLISION',
          'Two glue tabs overlap in the same folding component.',
          [tabA.id, tabB.id],
          'Remove one tab, choose another owner, or reduce tab depth.',
        ),
      );
    }
  }

  const updatedConnections: FoldConnection[] = desired.map((target) => ({
    ...target.connection,
    disposition: target.treatment === 'crease' ? 'hinge' : 'seam',
    closure: target.treatment === 'crease' ? 'none' : target.closure,
    tabIds: generatedTabs
      .filter((tab) => tab.ownerPanelId === target.ownerPanelId)
      .map((tab) => tab.id),
  }));
  return {
    ...built,
    connections: updatedConnections,
    tabs: generatedTabs,
    parts,
    issues,
    editableEdges,
  };
}
