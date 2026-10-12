import { describe, expect, it } from 'vitest';
import { TEMPLATE_KINDS } from '../domain/folding';
import { canonicalGenerationSignature } from '../domain/generationInputs';
import { generateUpgradeBaseline, upgradeBaselineCases } from '../test-fixtures/upgradeBaseline';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import {
  generateRegisteredTemplate,
  generateTemplateGraph,
  getTemplate,
  registeredLegacyKinds,
  templateRegistry,
  validateRegistry,
} from './registry';
import { resolveTemplateInstance, validateTemplateDefinition } from './validateTemplateDefinition';
import { templateGraphGenerators } from './generators';
import { compileToParts } from '../geometry/designGraph/compileToParts';

describe('versioned local template registry', () => {
  it('registers all seven existing families with unique IDs and local generators', () => {
    expect(registeredLegacyKinds).toEqual(TEMPLATE_KINDS);
    expect(templateRegistry).toHaveLength(7);
    expect(validateRegistry()).toEqual([]);
    expect(templateRegistry.every((def) => def.thumbnail.startsWith('generated:'))).toBe(true);
    expect(templateRegistry.every((def) => def.status === 'experimental')).toBe(true);
  });

  it.each(TEMPLATE_KINDS)('keeps %s generation and canonical provenance equivalent', (kind) => {
    const { input, project, result } = generateUpgradeBaseline(
      upgradeBaselineCases.find((c) => c.id === `fold-${kind}`)!,
    );
    if (input.mode !== 'fold-template') throw new Error('Wrong fixture.');
    const signature = canonicalGenerationSignature(project);
    expect(generateRegisteredTemplate(input.payload)).toEqual(result);
    expect(canonicalGenerationSignature(project)).toEqual(signature);
  });

  it.each([
    [80, 60, 40],
    [140, 35, 25],
    [45, 90, 70],
  ])('preserves the extracted family at %i × %i × %i and two stocks', (width, length, height) => {
    const { input } = generateUpgradeBaseline(
      upgradeBaselineCases.find((c) => c.id === 'fold-open-box')!,
    );
    if (input.mode !== 'fold-template') throw new Error('Wrong fixture.');
    const definition = getTemplate('legacy:open-box', 1);
    const instance = resolveTemplateInstance(definition, {
      widthMm: width,
      lengthMm: length,
      heightMm: height,
    });
    for (const thickness of [1, 3]) {
      const graph = generateTemplateGraph(instance, { thicknessMm: thickness });
      const legacy = generateFoldTemplate({
        materialThicknessMm: thickness,
        settings: {
          templateKind: 'open-box',
          fitAxis: 'y',
          clearanceMm: 0,
          profileToleranceMm: 1,
          sizeMode: 'custom',
          envelopeDimensions: { widthMm: width, lengthMm: length, heightMm: height },
          parameters: { ...instance.values, standalone: true, wallHeightMm: height },
        },
      });
      expect(compileToParts(graph).parts).toEqual(legacy.parts);
      expect(graph.manufacturingStatus).toBe('legacy-unverified');
    }
  });

  it('rejects unavailable versions, undefined generators, unsafe metadata and invalid defaults', () => {
    const definition = getTemplate('legacy:open-box');
    expect(() => getTemplate(definition.id, 2)).toThrow(/Unknown/);
    const generators = new Set(Object.keys(templateGraphGenerators));
    expect(
      validateTemplateDefinition({ ...definition, generatorId: 'unknown' }, generators).length,
    ).toBeGreaterThan(0);
    expect(
      validateTemplateDefinition(
        { ...definition, thumbnail: 'https://untrusted.invalid/image.svg' },
        generators,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      validateTemplateDefinition({ ...definition, status: 'verified' }, generators).length,
    ).toBeGreaterThan(0);
    expect(validateRegistry([definition, definition])).toContain(
      `Duplicate template: ${definition.id}`,
    );
    expect(
      validateTemplateDefinition(
        { ...definition, parameters: [...definition.parameters, definition.parameters[0]!] },
        generators,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      validateTemplateDefinition(
        { ...definition, parameters: [{ ...definition.parameters[0]!, default: -10 }] },
        generators,
      ).length,
    ).toBeGreaterThan(0);
    const catalog = {
      ...definition,
      id: 'reference:unimplemented',
      status: 'catalog-only' as const,
    };
    delete catalog.generatorId;
    expect(validateTemplateDefinition(catalog, generators)).toEqual([]);
    expect(
      validateTemplateDefinition({ ...catalog, id: 'fefco:0201', fefcoCode: '0201' }, generators)
        .length,
    ).toBeGreaterThan(0);
  });

  it('resolves a complete immutable instance and rejects invalid supplied values without clamping', () => {
    const definition = getTemplate('legacy:open-box');
    const instance = resolveTemplateInstance(definition, { widthMm: 123 });
    expect(instance.values.widthMm).toBe(123);
    expect(instance.values.lengthMm).toBe(60);
    definition.parameters.find((p) => p.id === 'widthMm')!.default = 80;
    expect(instance.values.widthMm).toBe(123);
    expect(() => resolveTemplateInstance(definition, { widthMm: -1 })).toThrow(/Invalid/);
    expect(() => resolveTemplateInstance(definition, { widthMm: NaN })).toThrow(/Invalid/);
    expect(() => resolveTemplateInstance(definition, { unknown: 2 })).toThrow(/Unknown/);
    expect(() =>
      generateTemplateGraph({ ...instance, templateVersion: 2 }, { thicknessMm: 1 }),
    ).toThrow(/Unknown/);
  });
});
