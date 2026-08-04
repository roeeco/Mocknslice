import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { generateFoldTemplate } from './generateFoldTemplate';
import { measureConnectionAlignment } from './measureConnectionAlignment';

describe('fold connection alignment', () => {
  it('verifies every open-box connection at the fully assembled pose', () => {
    const project = createProject('Connection alignment');
    if (!project.model.mesh || !project.model.bounds) throw new Error('Missing fixture mesh.');
    const result = generateFoldTemplate({
      mesh: project.model.mesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings: {
        templateKind: 'open-box',
        fitAxis: 'z',
        clearanceMm: 1,
        profileToleranceMm: 0.5,
        parameters: { wallHeightMm: 20, tabDepthMm: 8 },
      },
    });
    const report = measureConnectionAlignment(
      result.panels,
      result.assembledPreview.panels,
      result.connections,
    );
    expect(report.unmeasurableConnectionIds).toEqual([]);
    expect(report.connections).toHaveLength(result.connections.length);
    expect(report.connections.every((connection) => connection.aligned)).toBe(true);
    expect(report.maximumEndpointErrorMm).toBeLessThan(0.001);
  });
});
