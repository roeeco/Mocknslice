import { generateNativeTemplate } from '../../templates/generateNativeTemplate';
import { buildCanonicalGenerationInput } from '../../domain/generationInputs';
import type { AppSliceCreator, TemplateAuthoringSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import {
  parseTemplateDefinition,
  authorInstance,
  resolveAuthorValues,
} from '../../templates/authoring/validate';
export const createTemplateAuthoringSlice: AppSliceCreator<TemplateAuthoringSlice> = (
  set,
  get,
) => ({
  applyTemplateDefinition: (value, values) => {
    const definition = parseTemplateDefinition(value),
      instance = authorInstance(definition, values);
    const existing = get().project.templateDefinitions?.find(
      (d) => d.id === definition.id && d.version === definition.version,
    );
    if (existing && authorInstance(existing).definitionHash !== instance.definitionHash)
      throw new Error('Definition versions are immutable. Increment the version or clone.');
    const prospective = {
      ...get().project,
      fabricationMode: 'fold-template' as const,
      templateInstance: instance,
      templateDefinitions: [definition],
      modeSettings: {
        ...get().project.modeSettings,
        foldTemplate:
          definition.kind === 'variant'
            ? { ...definition.settings, ...instance.values }
            : {
                ...get().project.modeSettings.foldTemplate,
                templateKind: 'open-box' as const,
                ...instance.values,
                wallHeightMm: instance.values.heightMm ?? 25,
              },
      },
    };
    const input = buildCanonicalGenerationInput(prospective);
    if (input.mode !== 'fold-template') throw new Error('Wrong template mode');
    const preview = generateNativeTemplate(input.payload);
    if (preview.issues.some((i) => i.severity === 'error'))
      throw new Error(preview.issues.find((i) => i.severity === 'error')!.message);
    get().cancelSliceGeneration();
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          fabricationMode: 'fold-template',
          templateInstance: instance,
          templateDefinitions: [
            ...(project.templateDefinitions ?? []).filter(
              (d) => !(d.id === definition.id && d.version === definition.version),
            ),
            structuredClone(definition),
          ].slice(-50),
          modeSettings: {
            ...project.modeSettings,
            foldTemplate:
              definition.kind === 'variant'
                ? { ...definition.settings, ...instance.values }
                : {
                    ...project.modeSettings.foldTemplate,
                    templateKind: 'open-box',
                    ...instance.values,
                    wallHeightMm: instance.values.heightMm ?? 25,
                  },
          },
        }),
      ),
      sliceGenerationStatus: 'stale',
      sliceGenerationError: undefined,
    }));
    get().generateFoldTemplate({ mergeWithInputEdit: true });
  },
  updateTemplateValues: (patch) => {
    const project = get().project,
      instance = project.templateInstance;
    if (!instance) return;
    const definition = project.templateDefinitions?.find(
      (d) => d.id === instance.templateId && d.version === instance.templateVersion,
    );
    if (!definition) throw new Error('Embedded definition is missing.');
    const values = resolveAuthorValues(definition, { ...instance.values, ...patch });
    get().cancelSliceGeneration();
    set((state) => ({
      ...recordProjectChange(state, (current) =>
        touchProject({
          ...current,
          templateInstance: { ...instance, values },
          modeSettings: {
            ...current.modeSettings,
            foldTemplate: {
              ...current.modeSettings.foldTemplate,
              ...values,
              wallHeightMm: values.heightMm ?? current.modeSettings.foldTemplate.wallHeightMm,
            },
          },
        }),
      ),
      sliceGenerationStatus: 'stale',
    }));
    get().generateFoldTemplate({ mergeWithInputEdit: true });
  },
  resetTemplateValues: () => {
    const project = get().project,
      instance = project.templateInstance,
      definition = project.templateDefinitions?.find(
        (d) => d.id === instance?.templateId && d.version === instance.templateVersion,
      );
    if (definition) get().updateTemplateValues(resolveAuthorValues(definition));
  },
});
