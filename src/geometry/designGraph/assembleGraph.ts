import type { FabricationDesignGraph } from '../../domain/designGraph';
import type { AssembledFoldPanel } from '../../domain/folding';
import { applyPose } from './poses';
import { panelLoop, validateGraph } from './validateGraph';

export function assembleGraph(graph: FabricationDesignGraph) {
  const issues = validateGraph(graph);
  if (issues.some((i) => i.severity === 'error'))
    return { panels: [] as AssembledFoldPanel[], issues };
  return {
    panels: graph.panels
      .filter((p) => p.assembledPose)
      .map((panel) => ({
        id: panel.id,
        partId: panel.pieceId,
        name: panel.name,
        verticesMm: panelLoop(panel, panel.assemblyBoundary ?? panel.boundary).map((point) =>
          applyPose(point, panel.assembledPose!),
        ),
        ...(panel.holes.length
          ? {
              holesVerticesMm: panel.holes.map((loop) =>
                panelLoop(panel, loop).map((point) => applyPose(point, panel.assembledPose!)),
              ),
            }
          : {}),
      })),
    issues,
  };
}
