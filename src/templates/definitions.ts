import type { TemplateKind } from '../domain/folding';
import type { TemplateDefinition, TemplateParameter } from './types';

const size = (id: string, value: number): TemplateParameter => ({
  id,
  labelKey: `template.${id}`,
  kind: 'length',
  default: value,
  min: 1,
  max: 2000,
  step: 0.5,
  displayGroup: 'size',
});
const common: TemplateParameter[] = [
  size('widthMm', 80),
  size('lengthMm', 60),
  size('heightMm', 40),
  {
    id: 'closureMethod',
    labelKey: 'template.closure',
    kind: 'enum',
    default: 'glue',
    choices: ['glue', 'press-fit'],
    displayGroup: 'closure',
  },
  { ...size('tabDepthMm', 8), min: 0.5, max: 15, displayGroup: 'closure' },
];
const inventory: Array<[TemplateKind, TemplateDefinition['family'], string, string]> = [
  ['open-box', 'carton', 'Open box', 'קופסה פתוחה'],
  ['box-with-lid', 'lid-base', 'Box with lid', 'קופסה עם מכסה'],
  ['tray', 'tray', 'Tray', 'מגש'],
  ['sleeve', 'sleeve', 'Sleeve', 'שרוול'],
  ['envelope', 'carton', 'Envelope', 'מעטפה'],
  ['regular-prism', 'polyhedron', 'Regular prism', 'מנסרה משוכללת'],
  ['pyramid-frustum', 'polyhedron', 'Pyramid / frustum', 'פירמידה / קטומה'],
];

export const legacyTemplateDefinitions: readonly TemplateDefinition[] = inventory.map(
  ([kind, family, en, he]) => ({
    id: `legacy:${kind}`,
    version: 1,
    family,
    labelKey: `templates.${kind}.name`,
    descriptionKey: `templates.${kind}.description`,
    names: { en, he },
    thumbnail: `generated:${kind}`,
    // Preserve legacy workflows; new catalog must not imply closed-contour certification.
    status: 'experimental',
    generatorId: `legacy:${kind}`,
    legacyKind: kind,
    parameters: [
      ...common.map((p) => structuredClone(p)),
      ...(kind === 'box-with-lid'
        ? [
            { ...size('lidDepthMm', 15), displayGroup: 'closure' as const },
            { ...size('lidClearanceMm', 0.5), min: 0, displayGroup: 'advanced' as const },
          ]
        : []),
      ...(kind === 'envelope'
        ? [{ ...size('closureFlapMm', 12), min: 0, displayGroup: 'closure' as const }]
        : []),
      ...(kind === 'regular-prism'
        ? [
            {
              id: 'prismSides',
              labelKey: 'template.sides',
              kind: 'integer' as const,
              default: 6,
              min: 3,
              max: 12,
              step: 1,
              displayGroup: 'advanced' as const,
            },
          ]
        : []),
      ...(kind === 'pyramid-frustum'
        ? [
            {
              id: 'topScale',
              labelKey: 'template.topScale',
              kind: 'ratio' as const,
              default: 0,
              min: 0,
              max: 0.95,
              step: 0.05,
              displayGroup: 'advanced' as const,
            },
          ]
        : []),
    ],
  }),
);

export const registeredLegacyKinds = legacyTemplateDefinitions.map(
  (definition) => definition.legacyKind!,
);
