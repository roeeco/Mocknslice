import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import { deriveAssemblyInspection } from './assembly';

describe('assembly inspection', () => {
  it('derives resolved joins and a hinge-first assembly order from generated connections', () => {
    const project = createProject('Assembly inspection');
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
    const inspection = deriveAssemblyInspection({
      ...project,
      foldingResult: result,
      generatedParts: result.parts,
      generationIssues: result.issues,
    });
    expect(inspection).toMatchObject({
      requiredJoinCount: 8,
      resolvedJoinCount: 8,
      missingJoinCount: 0,
      hingeCount: 4,
      seamCount: 4,
      glueTabCount: 4,
    });
    expect(inspection.order.slice(0, 4).every((step) => step.kind === 'hinge')).toBe(true);
    expect(
      inspection.order
        .filter((step) => step.kind === 'seam')
        .every((step) => step.dependsOnIds.length > 0),
    ).toBe(true);
  });
});
