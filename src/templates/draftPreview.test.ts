import { describe, expect, it } from 'vitest';
import { generateUpgradeBaseline, upgradeBaselineCases } from '../test-fixtures/upgradeBaseline';
import { templateDraftPreview } from './draftPreview';
import { canonicalGenerationSignature } from '../domain/generationInputs';

describe('runtime-only template drafts', () => {
  it('projects changed dimensions without changing saved input, geometry or provenance', () => {
    const { project } = generateUpgradeBaseline(
      upgradeBaselineCases.find((c) => c.id === 'fold-open-box')!,
    );
    const before = JSON.stringify(project),
      signature = canonicalGenerationSignature(project);
    const preview = templateDraftPreview(project, { widthMm: 135 });
    expect(preview.project?.foldingResult?.resolvedDimensions?.widthMm).toBe(135);
    expect(preview.project?.generatedParts).not.toEqual(project.generatedParts);
    expect(JSON.stringify(project)).toBe(before);
    expect(canonicalGenerationSignature(project)).toEqual(signature);
  });
  it('returns structured failures instead of publishing invalid draft geometry', () => {
    const { project } = generateUpgradeBaseline(
      upgradeBaselineCases.find((c) => c.id === 'fold-open-box')!,
    );
    const before = JSON.stringify(project);
    const preview = templateDraftPreview(project, { widthMm: 0 });
    expect(preview.project).toBeUndefined();
    expect(preview.issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
  });
});
