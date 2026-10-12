import type { FabricationDesignGraph } from '../../domain/designGraph';

export function selectionIdentityMap(
  graph: FabricationDesignGraph,
): Record<string, { entityId: string; partId: string }> {
  const entries: Record<string, { entityId: string; partId: string }> = {};
  for (const panel of graph.panels)
    entries[panel.id] = { entityId: panel.id, partId: panel.pieceId };
  for (const connection of graph.connections) {
    const panel = graph.panels.find((p) => p.id === connection.panelAId);
    if (panel) entries[connection.id] = { entityId: connection.id, partId: panel.pieceId };
  }
  for (const feature of graph.features)
    entries[feature.id] = {
      entityId: feature.path?.featureId ?? feature.label?.featureId ?? feature.id,
      partId: feature.pieceId,
    };
  return entries;
}
