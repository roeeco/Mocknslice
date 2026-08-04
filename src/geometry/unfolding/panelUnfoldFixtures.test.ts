import { describe, expect, it } from 'vitest';
import { fabricationMeshes } from '../../test-fixtures/fabricationMeshes';
import { mergePlanarRegions } from '../mesh/mergePlanarRegions';
import { generatePanelUnfold, prepareAndGeneratePanelUnfold } from './generatePanelUnfold';

describe('panel-unfold v2 fixtures', () => {
  it('creates deterministic spanning-tree candidates for a panelized cube', () => {
    const prepared = mergePlanarRegions(fabricationMeshes.triangulatedCube);
    const first = generatePanelUnfold(prepared);
    expect(first).toEqual(generatePanelUnfold(prepared));
    expect(first.connections).toHaveLength(12);
    expect(first.candidates).toHaveLength(3);
    expect(first.candidates[0]?.hingeConnectionIds).toHaveLength(5);
    expect(first.candidates[0]?.seamConnectionIds).toHaveLength(7);
    expect(first.candidates[0]?.score.boundingArea).toBeGreaterThan(0);
    const candidate = first.candidates[0]!;
    for (const id of candidate.hingeConnectionIds) {
      const connection = first.connections.find((item) => item.id === id)!;
      const a = candidate.placements.find((item) => item.panelId === connection.panelAId)!;
      const b = candidate.placements.find((item) => item.panelId === connection.panelBId)!;
      const panelA = prepared.panels.find((panel) => panel.id === connection.panelAId)!;
      const panelB = prepared.panels.find((panel) => panel.id === connection.panelBId)!;
      expect(a.points2D[panelA.sourceVertexIndices.indexOf(connection.vertexA)]).toEqual(
        b.points2D[panelB.sourceVertexIndices.indexOf(connection.vertexA)],
      );
    }
  });

  it('prepares and unfolds through the serializable worker boundary function', () => {
    const result = prepareAndGeneratePanelUnfold({
      mesh: fabricationMeshes.triangulatedCube,
      maximumPlanarityErrorMm: 0.01,
      sharpAngleDeg: 2,
    });
    expect(result.preparedMesh.metrics.outputPanelCount).toBe(6);
    expect(result.unfolding.candidates[0]?.seamConnectionIds).toHaveLength(7);
    expect(structuredClone(result)).toEqual(result);
  });
});
