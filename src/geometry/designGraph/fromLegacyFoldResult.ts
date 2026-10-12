import type { FabricationDesignGraph } from '../../domain/designGraph';
import type { TemplateGenerationResult } from '../../domain/folding';
import { makeLegacyPanel, registerEdge } from './adapterHelpers';
import { legacyManufacturingFeatures } from './legacyFeatures';
import { graphIssue } from './validateGraph';

export function fromLegacyFoldResult(result: TemplateGenerationResult): FabricationDesignGraph {
  const issues = structuredClone(result.issues);
  const panels = result.panels.map((panel) =>
    makeLegacyPanel(
      panel,
      result.parts.find((part) => part.id === panel.partId)?.thicknessMm ?? 0,
      result.assembledPreview.panels.find((p) => p.id === panel.id)?.verticesMm,
      [],
      result.connections
        .filter(
          (c) => c.disposition === 'hinge' && (c.panelAId === panel.id || c.panelBId === panel.id),
        )
        .flatMap((c) => {
          const assembled = result.editableEdges?.find((e) => e.id === c.id);
          if (!assembled) return [];
          const edge = c.panelAId === panel.id ? c.edgeA : c.edgeB;
          return [
            {
              flatStart: edge.start,
              flatEnd: edge.end,
              worldStart: assembled.startMm,
              worldEnd: assembled.endMm,
            },
          ];
        }),
    ),
  );
  const byId = new Map(panels.map((p) => [p.id, p]));
  const connections = result.connections.flatMap((connection) => {
    const a = byId.get(connection.panelAId),
      b = byId.get(connection.panelBId);
    if (!a || !b) {
      issues.push(
        graphIssue(
          'GRAPH_REFERENCE_MISSING',
          [connection.id],
          'Legacy connection references an unknown panel.',
        ),
      );
      return [];
    }
    const tab = result.tabs.find((tab) => connection.tabIds.includes(tab.id));
    return [
      {
        id: connection.id,
        panelAId: a.id,
        panelBId: b.id,
        edgeA: registerEdge(a, connection.id, connection.edgeA.start, connection.edgeA.end),
        edgeB: registerEdge(
          b,
          connection.id,
          connection.disposition === 'hinge' ? connection.edgeB.end : connection.edgeB.start,
          connection.disposition === 'hinge' ? connection.edgeB.start : connection.edgeB.end,
        ),
        treatment: connection.disposition,
        flatJoined: connection.disposition === 'hinge',
        closure: connection.closure === 'openable-flap' ? ('none' as const) : connection.closure,
        required: connection.required,
        ...(tab ? { tabOwnerPanelId: tab.ownerPanelId } : {}),
        ...(result.edges.find((e) => e.id === connection.id.replace(/-connection$/, ''))
          ?.targetAngleDeg !== undefined
          ? {
              foldAngleDeg: result.edges.find(
                (e) => e.id === connection.id.replace(/-connection$/, ''),
              )!.targetAngleDeg!,
            }
          : {}),
      },
    ];
  });
  return {
    schemaVersion: 1,
    units: 'mm',
    source: {
      kind: 'template',
      sourceId: result.profile.sourceModelId,
      algorithmVersion: result.algorithmVersion,
      inputHash: result.inputHash,
    },
    panels: panels.sort((a, b) => a.id.localeCompare(b.id)),
    connections: connections.sort((a, b) => a.id.localeCompare(b.id)),
    ...legacyManufacturingFeatures(result.parts),
    issues,
    manufacturingStatus: 'legacy-unverified',
  };
}
