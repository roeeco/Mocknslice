import type { FabricationDesignGraph } from '../../domain/designGraph';
import type { FabricationPart } from '../../domain/fabrication';
import { validateGraph } from './validateGraph';

export function compileToParts(graph: FabricationDesignGraph) {
  const issues = validateGraph(graph);
  if (issues.some((i) => i.severity === 'error')) return { parts: [] as FabricationPart[], issues };
  const features = new Map(graph.features.map((f) => [f.id, f]));
  const parts: FabricationPart[] = graph.pieces.map((piece) => ({
    ...structuredClone(piece.metadata),
    paths: piece.pathIds.map((id) => {
      const feature = features.get(id)!;
      if (!feature.path) throw new Error('Expected path metadata.');
      return {
        ...structuredClone(feature.path),
        points: feature.geometry2D.map((p) => ({ ...p })),
      };
    }),
    ...(piece.labelsPresent || piece.labelIds.length
      ? {
          labels: piece.labelIds.map((id) => {
            const feature = features.get(id)!;
            if (!feature.label) throw new Error('Expected label metadata.');
            return { ...structuredClone(feature.label), position: { ...feature.geometry2D[0]! } };
          }),
        }
      : {}),
  }));
  return { parts, issues };
}
