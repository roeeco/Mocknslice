import type { ParamValue, TemplateDefinition, TemplateInstance, TemplateParameter } from './types';

export function parameterValueValid(parameter: TemplateParameter, value: ParamValue): boolean {
  if (parameter.kind === 'boolean') return typeof value === 'boolean';
  if (parameter.kind === 'enum')
    return typeof value === 'string' && Boolean(parameter.choices?.includes(value));
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (parameter.kind !== 'integer' || Number.isInteger(value)) &&
    (parameter.min === undefined || value >= parameter.min) &&
    (parameter.max === undefined || value <= parameter.max)
  );
}

export function validateTemplateDefinition(
  definition: TemplateDefinition,
  knownGenerators: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  if (
    (definition.fefcoCode || definition.id.startsWith('fefco:')) &&
    (!definition.generatorId || !knownGenerators.has(definition.generatorId))
  )
    errors.push('FEFCO entries require an implemented local template generator.');
  if (
    !/^[a-z0-9][a-z0-9:-]*$/.test(definition.id) ||
    !Number.isInteger(definition.version) ||
    definition.version < 1
  )
    errors.push('Invalid template identity/version.');
  if (
    !definition.labelKey ||
    !definition.descriptionKey ||
    !definition.names.en ||
    !definition.names.he
  )
    errors.push('Template requires bilingual metadata.');
  if (!/^generated:[a-z0-9-]+$/.test(definition.thumbnail))
    errors.push('Thumbnail must be an original local generated preview.');
  if (
    definition.status !== 'catalog-only' &&
    (!definition.generatorId || !knownGenerators.has(definition.generatorId))
  )
    errors.push('Available template requires a registered local generator.');
  if (
    definition.status === 'verified' &&
    (!definition.inspection?.reference || !definition.inspection.physicallyInspected)
  )
    errors.push('Verified status requires an explicit inspection record.');
  const ids = new Set<string>();
  for (const parameter of definition.parameters) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(parameter.id) || ids.has(parameter.id))
      errors.push('Duplicate or invalid parameter ID.');
    ids.add(parameter.id);
    if (!parameter.labelKey || !parameterValueValid(parameter, parameter.default))
      errors.push(`Invalid default for ${parameter.id}.`);
    if (
      (parameter.min !== undefined && !Number.isFinite(parameter.min)) ||
      (parameter.max !== undefined && !Number.isFinite(parameter.max)) ||
      (parameter.min !== undefined && parameter.max !== undefined && parameter.min > parameter.max)
    )
      errors.push(`Invalid range for ${parameter.id}.`);
    if (parameter.step !== undefined && (!Number.isFinite(parameter.step) || parameter.step <= 0))
      errors.push(`Invalid step for ${parameter.id}.`);
    if (
      parameter.kind === 'enum' &&
      (!parameter.choices?.length || new Set(parameter.choices).size !== parameter.choices.length)
    )
      errors.push(`Invalid choices for ${parameter.id}.`);
  }
  return errors;
}

export function resolveTemplateInstance(
  definition: TemplateDefinition,
  overrides: Record<string, ParamValue> = {},
): TemplateInstance {
  const values: Record<string, ParamValue> = {};
  const known = new Set(definition.parameters.map((p) => p.id));
  for (const key of Object.keys(overrides))
    if (!known.has(key)) throw new Error(`Unknown template parameter: ${key}`);
  for (const parameter of definition.parameters) {
    const value = Object.hasOwn(overrides, parameter.id)
      ? overrides[parameter.id]!
      : parameter.default;
    if (!parameterValueValid(parameter, value))
      throw new Error(`Invalid template parameter: ${parameter.id}`);
    values[parameter.id] = value;
  }
  return { templateId: definition.id, templateVersion: definition.version, values };
}
