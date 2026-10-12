import { constructionRecipeDefinitions } from './constructionRecipes';
import type { FoldTemplateInput } from '../geometry/folding/generateFoldTemplate';
import { legacyTemplateDefinitions } from './definitions';
import { legacyTemplateGenerators, templateGraphGenerators } from './generators';
import type { TemplateDefinition, TemplateInstance } from './types';
import {
  parameterValueValid,
  resolveTemplateInstance,
  validateTemplateDefinition,
} from './validateTemplateDefinition';

export const templateRegistry: readonly TemplateDefinition[] = [
  ...legacyTemplateDefinitions,
  ...constructionRecipeDefinitions,
];
export { registeredLegacyKinds } from './definitions';

export function getTemplate(id: string, version?: number): TemplateDefinition {
  const definition = templateRegistry.find(
    (def) => def.id === id && (version === undefined || def.version === version),
  );
  if (!definition) throw new Error(`Unknown template identity/version: ${id}`);
  return definition;
}

export function validateRegistry(
  definitions: readonly TemplateDefinition[] = templateRegistry,
): string[] {
  const errors = definitions.flatMap((def) =>
    validateTemplateDefinition(
      def,
      new Set([...Object.keys(legacyTemplateGenerators), ...Object.keys(templateGraphGenerators)]),
    ),
  );
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id)) errors.push(`Duplicate template: ${definition.id}`);
    ids.add(definition.id);
  }
  return errors;
}

export function generateRegisteredTemplate(input: FoldTemplateInput) {
  const definition = templateRegistry.find((def) => def.legacyKind === input.settings.templateKind);
  if (!definition?.generatorId || definition.status === 'catalog-only')
    throw new Error('Template has no available generator.');
  const generator = legacyTemplateGenerators[definition.generatorId];
  if (!generator) throw new Error('Template generator is unavailable.');
  return generator(input);
}

export function generateTemplateGraph(
  instance: TemplateInstance,
  material: { thicknessMm: number },
) {
  const definition = getTemplate(instance.templateId, instance.templateVersion);
  if (definition.status === 'catalog-only' || !definition.generatorId)
    throw new Error('Catalog-only entries cannot generate cutting geometry.');
  for (const parameter of definition.parameters)
    if (!parameterValueValid(parameter, instance.values[parameter.id]!))
      throw new Error(`Invalid template parameter: ${parameter.id}`);
  const canonical = resolveTemplateInstance(definition, instance.values);
  const generator = templateGraphGenerators[definition.generatorId];
  if (!generator) throw new Error('Template graph generator is unavailable.');
  return generator(canonical.values, material);
}
