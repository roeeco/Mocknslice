import * as v from 'valibot';
import { hashSerializable } from '../../domain/canonicalHash';
import { modeSettingsSchema } from '../../domain/modeSettingsSchema';
import { TEMPLATE_KINDS } from '../../domain/folding';
import { evaluateExpression } from './expression';
import type { UserTemplateDefinition, SavedTemplateInstance } from './types';
const finite = v.pipe(v.number(), v.finite(), v.minValue(-100000), v.maxValue(100000));
const id = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9:-]{0,127}$/));
const names = v.object({
  en: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  he: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
});
const parameter = v.object({ id, name: names, default: finite, min: finite, max: finite });
const expression = v.unknown();
const point = v.object({ x: expression, y: expression });
const points = v.pipe(v.array(point), v.minLength(3), v.maxLength(100));
const index = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99));
const base = {
  id,
  version: v.pipe(index, v.minValue(1)),
  names,
  parameters: v.pipe(v.array(parameter), v.minLength(1), v.maxLength(32)),
};
const schema = v.variant('kind', [
  v.strictObject({
    ...base,
    kind: v.literal('custom'),
    panels: v.pipe(
      v.array(
        v.strictObject({
          id,
          name: v.pipe(v.string(), v.maxLength(200)),
          outline: points,
          holes: v.pipe(v.array(points), v.maxLength(100)),
        }),
      ),
      v.minLength(1),
      v.maxLength(200),
    ),
    hinges: v.pipe(
      v.array(
        v.strictObject({
          id,
          panelA: id,
          panelB: id,
          edgeA: index,
          edgeB: index,
          angleDeg: expression,
        }),
      ),
      v.maxLength(199),
    ),
    tabs: v.pipe(
      v.array(
        v.strictObject({
          id,
          panelId: id,
          edge: index,
          depthMm: expression,
          receiverPanelId: v.optional(id),
        }),
      ),
      v.maxLength(200),
    ),
    marks: v.pipe(
      v.array(
        v.strictObject({ id, panelId: id, point, text: v.pipe(v.string(), v.maxLength(256)) }),
      ),
      v.maxLength(200),
    ),
  }),
  v.strictObject({
    ...base,
    kind: v.literal('variant'),
    legacyKind: v.picklist(TEMPLATE_KINDS),
    settings: v.unknown(),
  }),
]);
export function resolveAuthorValues(
  definition: UserTemplateDefinition,
  overrides: Readonly<Record<string, number>> = {},
) {
  const values: Record<string, number> = {};
  for (const key of Object.keys(overrides))
    if (!definition.parameters.some((p) => p.id === key))
      throw new Error(`Unknown parameter: ${key}`);
  for (const p of definition.parameters) {
    const value = Object.hasOwn(overrides, p.id) ? overrides[p.id]! : p.default;
    if (
      !Number.isFinite(value) ||
      value < p.min ||
      value > p.max ||
      p.min > p.max ||
      p.default < p.min ||
      p.default > p.max
    )
      throw new Error(`Invalid parameter: ${p.id}`);
    values[p.id] = value;
  }
  return values;
}
export function parseTemplateDefinition(value: unknown): UserTemplateDefinition {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success)
    throw new Error('Template definition is malformed or exceeds supported bounds.');
  const definition = parsed.output as UserTemplateDefinition;
  const values = resolveAuthorValues(definition);
  const ids =
    definition.kind === 'custom'
      ? [
          ...definition.parameters,
          ...definition.panels,
          ...definition.hinges,
          ...definition.tabs,
          ...definition.marks,
        ].map((x) => x.id)
      : definition.parameters.map((p) => p.id);
  if (ids.some((id) => ['constructor', 'prototype', '__proto__'].includes(id)))
    throw new Error('Reserved template identity.');
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate template entity identity.');
  if (definition.kind === 'variant') {
    // Reuse current mode validation; preserve the embedded snapshot rather than resolving a newer registry version.
    v.parse(modeSettingsSchema.entries.foldTemplate, definition.settings);
    if (
      definition.settings.templateKind !== definition.legacyKind ||
      definition.parameters.some((p) => !Object.hasOwn(definition.settings, p.id))
    )
      throw new Error('Variant parameter does not belong to the saved template settings.');
  } else {
    const expressions = definition.panels
      .flatMap((p) => [...p.outline, ...p.holes.flat()].flatMap((q) => [q.x, q.y]))
      .concat(
        definition.hinges.map((h) => h.angleDeg),
        definition.tabs.map((t) => t.depthMm),
        definition.marks.flatMap((m) => [m.point.x, m.point.y]),
      );
    const budget = { nodes: 0 };
    expressions.forEach((expr) => evaluateExpression(expr, values, 0, budget));
    for (const h of definition.hinges) {
      const a = definition.panels.find((p) => p.id === h.panelA),
        b = definition.panels.find((p) => p.id === h.panelB);
      if (!a || !b || a === b || h.edgeA >= a.outline.length || h.edgeB >= b.outline.length)
        throw new Error('Hinge references invalid panels or edges.');
    }
    for (const t of definition.tabs)
      if (
        !definition.panels.some((p) => p.id === t.panelId && t.edge < p.outline.length) ||
        (t.receiverPanelId && !definition.panels.some((p) => p.id === t.receiverPanelId))
      )
        throw new Error('Tab references invalid panels.');
    for (const m of definition.marks)
      if (!definition.panels.some((p) => p.id === m.panelId))
        throw new Error('Mark references invalid panel.');
  }
  return definition;
}
export function authorInstance(
  definition: UserTemplateDefinition,
  values: Record<string, number> = {},
): SavedTemplateInstance {
  return {
    templateId: definition.id,
    templateVersion: definition.version,
    definitionHash: hashSerializable(definition),
    values: resolveAuthorValues(definition, values),
  };
}
