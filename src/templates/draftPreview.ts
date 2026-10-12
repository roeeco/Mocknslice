import type { FoldTemplateSettings } from '../domain/modeSettings';
import type { ProjectData } from '../domain/project';
import { buildCanonicalGenerationInput } from '../domain/generationInputs';
import { arrangePartsInRows } from '../geometry/layout/arrangeParts';
import { generateNativeTemplate } from './generateNativeTemplate';

/** Runtime-only projection. Never commit this object to state, history or autosave. */
export function templateDraftPreview(project: ProjectData, patch: Partial<FoldTemplateSettings>) {
  try {
    const draft = {
      ...project,
      modeSettings: {
        ...project.modeSettings,
        foldTemplate: { ...project.modeSettings.foldTemplate, ...patch },
      },
    };
    const input = buildCanonicalGenerationInput(draft);
    if (input.mode !== 'fold-template')
      throw new Error('Template preview requires a template source.');
    const result = generateNativeTemplate(input.payload);
    if (result.issues.some((issue) => issue.severity === 'error')) return { issues: result.issues };
    return {
      project: {
        ...draft,
        foldingResult: result,
        designGraph: result.graph,
        generatedParts: result.parts,
        generationIssues: result.issues,
        sheetLayouts: draft.sheetLayouts[0]
          ? arrangePartsInRows(result.parts, draft.sheetLayouts[0])
          : draft.sheetLayouts,
      },
      issues: result.issues,
    };
  } catch {
    return {
      issues: [
        {
          id: 'template-draft-invalid',
          code: 'TEMPLATE_INCOMPATIBLE',
          severity: 'error' as const,
          message: 'Draft template inputs are invalid.',
          affectedEntityIds: [project.modeSettings.foldTemplate.templateKind],
        },
      ],
    };
  }
}
