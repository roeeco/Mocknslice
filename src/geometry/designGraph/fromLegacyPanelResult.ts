import type { FabricationDesignGraph } from '../../domain/designGraph';
import type { PanelConstructionResult, PanelJointLocation } from '../../domain/panelConstruction';
import type { Point2D } from '../../domain/geometry';
import { makeLegacyPanel, registerEdge } from './adapterHelpers';
import { legacyManufacturingFeatures } from './legacyFeatures';
import { graphIssue } from './validateGraph';

function edge(
  outline: Point2D[],
  location: PanelJointLocation,
  length: number,
): [Point2D, Point2D] {
  const xs = outline.map((p) => p.x),
    ys = outline.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  switch (location) {
    case 'bottom':
      return [
        { x: cx - length / 2, y: minY },
        { x: cx + length / 2, y: minY },
      ];
    case 'top':
      return [
        { x: cx + length / 2, y: maxY },
        { x: cx - length / 2, y: maxY },
      ];
    case 'left':
      return [
        { x: minX, y: cy + length / 2 },
        { x: minX, y: cy - length / 2 },
      ];
    case 'right':
      return [
        { x: maxX, y: cy - length / 2 },
        { x: maxX, y: cy + length / 2 },
      ];
    case 'face':
      throw new Error('Interior joints require a separate verified adapter.');
  }
}

export function fromLegacyPanelResult(result: PanelConstructionResult): FabricationDesignGraph {
  const issues = structuredClone(result.issues);
  const panels = result.panels.map((panel) =>
    makeLegacyPanel(
      panel,
      result.parts.find((part) => part.id === panel.partId)?.thicknessMm ?? 0,
      result.assembledPreview.panels.find((p) => p.id === panel.id)?.verticesMm,
      result.parts
        .find((part) => part.id === panel.partId)
        ?.paths.filter((path) => path.contourRole === 'hole')
        .map((path) => path.points) ?? [],
    ),
  );
  const byId = new Map(panels.map((p) => [p.id, p]));
  const source = new Map(result.panels.map((p) => [p.id, p]));
  const connections = result.joints.flatMap((joint) => {
    const a = byId.get(joint.panelAId),
      b = byId.get(joint.panelBId);
    if (!a || !b || joint.kind !== 'butt' || joint.edgeA === 'face' || joint.edgeB === 'face') {
      issues.push(
        graphIssue(
          'GRAPH_LEGACY_JOINT_UNSUPPORTED',
          [joint.id],
          'PR 1 supports boundary butt joints only.',
        ),
      );
      return [];
    }
    const [as, ae] = edge(source.get(a.id)!.outline, joint.edgeA, joint.sharedLengthMm);
    const [bs, be] = edge(source.get(b.id)!.outline, joint.edgeB, joint.sharedLengthMm);
    return [
      {
        id: joint.id,
        panelAId: a.id,
        panelBId: b.id,
        edgeA: registerEdge(a, joint.id, as, ae),
        edgeB: registerEdge(b, joint.id, bs, be),
        treatment: 'butt' as const,
        flatJoined: false,
        closure: joint.tabOwnerPanelId ? ('glue-tab' as const) : ('none' as const),
        required: true,
        ...(joint.tabOwnerPanelId ? { tabOwnerPanelId: joint.tabOwnerPanelId } : {}),
      },
    ];
  });
  return {
    schemaVersion: 1,
    units: 'mm',
    source: {
      kind: 'panel-construction',
      sourceId: 'panel-construction',
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
