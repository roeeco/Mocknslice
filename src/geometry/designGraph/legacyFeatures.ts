import type { DesignFeature, DesignPiece } from '../../domain/designGraph';
import type { FabricationPart } from '../../domain/fabrication';

export function legacyManufacturingFeatures(parts: readonly FabricationPart[]): {
  pieces: DesignPiece[];
  features: DesignFeature[];
} {
  const features: DesignFeature[] = [];
  const pieces = parts.map((part) => {
    const { paths, labels, ...metadata } = part;
    for (const path of paths) {
      const { points, ...pathMetadata } = path;
      features.push({
        id: path.id,
        pieceId: part.id,
        ...(path.panelId ? { hostPanelId: path.panelId } : {}),
        kind: path.tabId
          ? 'tab'
          : path.slot
            ? 'slot'
            : path.contourRole === 'hole'
              ? 'hole'
              : path.operation === 'cut'
                ? 'contour'
                : path.operation === 'engrave'
                  ? 'engrave'
                  : path.operation === 'guide'
                    ? 'guide'
                    : 'score',
        operation: path.operation,
        geometry2D: points.map((p) => ({ ...p })),
        path: { ...pathMetadata },
      });
    }
    for (const label of labels ?? []) {
      const { position, ...labelMetadata } = label;
      features.push({
        id: label.id,
        pieceId: part.id,
        kind: label.operation === 'guide' ? 'guide' : 'engrave',
        operation: label.operation,
        geometry2D: [{ ...position }],
        label: { ...labelMetadata },
      });
    }
    return {
      id: part.id,
      metadata: structuredClone(metadata),
      pathIds: paths.map((p) => p.id),
      labelIds: (labels ?? []).map((l) => l.id),
      ...(labels ? { labelsPresent: true } : {}),
    };
  });
  return { pieces, features: features.sort((a, b) => a.id.localeCompare(b.id)) };
}
