import type { FabricationDesignGraph } from '../../domain/designGraph';
import type { MeshUnfoldResult } from '../../domain/unfolding';
import { makeLegacyPanel } from './adapterHelpers';
import { legacyManufacturingFeatures } from './legacyFeatures';

/** Inspection adapter only: old triangle cuts are not a validated physical perimeter. */
export function fromLegacyUnfoldResult(result: MeshUnfoldResult): FabricationDesignGraph {
  const panels = result.faces.map((face) => ({
    ...makeLegacyPanel(
      { id: face.id, partId: face.partId, name: face.id, outline: face.points2D },
      result.parts.find((p) => p.id === face.partId)?.thicknessMm ?? 0,
      face.sourceVerticesMm,
    ),
    sourceFaceIds: [face.id],
  }));
  return {
    schemaVersion: 1,
    units: 'mm',
    source: {
      kind: 'mesh',
      sourceId: 'legacy-mesh',
      algorithmVersion: result.algorithmVersion,
      inputHash: result.inputHash,
    },
    panels: panels.sort((a, b) => a.id.localeCompare(b.id)),
    connections: [],
    ...legacyManufacturingFeatures(result.parts),
    issues: [
      ...structuredClone(result.issues),
      {
        id: 'legacy-perimeter-unverified',
        code: 'PART_CONTOUR_UNVERIFIED',
        severity: 'warning',
        message:
          'Legacy triangle cuts remain inspection geometry until closed perimeter validation.',
        affectedEntityIds: result.islands.map((i) => i.id),
      },
    ],
    manufacturingStatus: 'legacy-unverified',
  };
}
