import { writePreparedSvg } from '../../exporters/writePreparedOutput';
import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import {
  buildCanonicalGenerationInput,
  canonicalGenerationSignature,
} from '../../domain/generationInputs';
import { hashSerializable } from '../../domain/canonicalHash';
import { generateNativeTemplate } from '../generateNativeTemplate';
import { crossTrayDefinition } from './crossTray';
import { authorInstance, parseTemplateDefinition } from './validate';
import { evaluateExpression } from './expression';
import { serializeProject } from '../../exporters/exportProject';
import { parseProjectFile } from '../../exporters/importProject';
import { compileToParts } from '../../geometry/designGraph/compileToParts';
import { validateGraph } from '../../geometry/designGraph/validateGraph';
import { templateRegistry, generateTemplateGraph } from '../registry';
import { isSimplePolygon } from '../../geometry/designGraph/polygons';
import { evaluateExportReadiness } from '../../geometry/output/evaluateExportReadiness';
import { expectedGenerationSignature } from '../../domain/generation';
import { IndexedDbProjectRepository, templateRepository } from '../../persistence/database';
import type { NumericExpression } from './types';
function customProject() {
  const project = createProject('Authored tray'),
    definition = parseTemplateDefinition(crossTrayDefinition());
  project.fabricationMode = 'fold-template';
  project.templateInstance = authorInstance(definition);
  project.templateDefinitions = [definition];
  return project;
}
function generate(project: ReturnType<typeof customProject>) {
  const input = buildCanonicalGenerationInput(project);
  if (input.mode !== 'fold-template') throw new Error('Wrong mode');
  return generateNativeTemplate(input.payload);
}
describe('version locked authoring and native physical templates', () => {
  it('resizes, reloads and exports the same explicit cross-tray topology with holes and labels', () => {
    const project = customProject(),
      definition = project.templateDefinitions![0]!;
    if (definition.kind !== 'custom') throw new Error('Wrong definition');
    definition.panels[0]!.holes = [
      [
        { x: 20, y: 20 },
        { x: 20, y: 25 },
        { x: 25, y: 25 },
        { x: 25, y: 20 },
      ],
    ];
    project.templateInstance = authorInstance(definition, {
      widthMm: 100,
      lengthMm: 90,
      heightMm: 20,
    });
    const result = generate(project);
    project.generatedParts = result.parts;
    project.foldingResult = result;
    project.designGraph = result.graph;
    project.generationRecord = {
      ...expectedGenerationSignature(project),
      signatureVersion: 3,
      algorithmVersion: result.algorithmVersion,
      resultHash: hashSerializable(result),
      generatedAt: new Date().toISOString(),
    };
    project.generationIssues = result.issues;
    expect(result.graph?.connections).toHaveLength(4);
    expect(result.parts[0]!.paths.filter((p) => p.contourRole === 'hole')).toHaveLength(1);
    expect(
      result.assembledPreview.panels
        .flatMap((p) => p.verticesMm)
        .some((p) => Math.abs(p[1] - 20) < 1e-6),
    ).toBe(true);
    const restored = parseProjectFile(serializeProject(project));
    expect(restored.templateDefinitions).toEqual(project.templateDefinitions);
    expect(generate(restored).parts).toEqual(result.parts);
    const firstReadiness = evaluateExportReadiness(project, { layoutMode: 'tight' });
    expect(firstReadiness.blockingIssues).toEqual([]);
    project.acknowledgedWarningIds = firstReadiness.warnings.map((i) => i.id);
    const ready = evaluateExportReadiness(project, { layoutMode: 'tight' });
    const svg = writePreparedSvg(ready)[0]!.data as string;
    const xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect(xml.documentElement.getAttribute('width')).toBe(
      `${ready.effectiveLayouts[0]!.widthMm}mm`,
    );
    expect(
      [...xml.querySelectorAll('path[data-operation="cut"]')].every((p) =>
        p.getAttribute('d')?.endsWith('Z'),
      ),
    ).toBe(true);
    expect(svg).toContain('custom:cross-tray');
    restored.templateInstance!.values.widthMm = 110;
    expect(canonicalGenerationSignature(restored).inputHash).not.toEqual(
      canonicalGenerationSignature(project).inputHash,
    );
    expect(generate(restored).graph?.connections.map((c) => c.id)).toEqual(
      result.graph?.connections.map((c) => c.id),
    );
    const damaged = structuredClone(project);
    damaged.templateInstance!.definitionHash = 'wrong';
    expect(() => parseProjectFile(serializeProject(damaged))).toThrow(/hash/);
  });
  it('bounds expressions, division, references, executable strings and topology cycles', () => {
    expect(evaluateExpression({ op: 'clamp', args: [20, 1, 10] }, {})).toBe(10);
    expect(() => evaluateExpression({ op: 'div', args: [1, 0] }, {})).toThrow(/zero/);
    expect(() => evaluateExpression({ ref: 'missing' }, {})).toThrow(/reference/);
    expect(() => evaluateExpression('fetch()' as unknown as NumericExpression, {})).toThrow();
    let expr: NumericExpression = 1;
    for (let i = 0; i < 20; i++) expr = { op: 'add', args: [1, expr] };
    expect(() => evaluateExpression(expr, {})).toThrow(/depth/);
    const project = customProject(),
      definition = project.templateDefinitions![0]!;
    if (definition.kind !== 'custom') throw new Error('Wrong type');
    definition.hinges.push({ ...definition.hinges[0]!, id: 'cycle' });
    project.templateInstance = authorInstance(definition);
    expect(() => generate(project)).toThrow(/forest/);
    definition.panels = Array.from({ length: 201 }, (_, i) => ({
      ...definition.panels[0]!,
      id: `panel${i}`,
    }));
    expect(() => parseTemplateDefinition(definition)).toThrow(/bounds/);
  });
  it('keeps user-library versions immutable and preserves definitions in transactional project storage', async () => {
    const definition = crossTrayDefinition(`custom:test-${crypto.randomUUID()}`);
    await templateRepository.save(definition);
    const modified = { ...definition, names: { en: 'Changed', he: 'שונה' } };
    await expect(templateRepository.save(modified)).rejects.toThrow(/immutable/);
    modified.version++;
    await templateRepository.save(modified);
    const project = customProject(),
      repo = new IndexedDbProjectRepository();
    await repo.save(project);
    expect((await repo.get(project.metadata.id))?.templateDefinitions).toEqual(
      project.templateDefinitions,
    );
    expect(
      (await templateRepository.list()).some((d) => d.id === definition.id && d.version === 1),
    ).toBe(true);
  });
  for (const kind of [
    'open-box',
    'box-with-lid',
    'tray',
    'sleeve',
    'envelope',
    'regular-prism',
    'pyramid-frustum',
  ] as const)
    for (const [widthMm, lengthMm, heightMm] of [
      [80, 60, 40],
      [140, 70, 35],
      [60, 90, 80],
    ])
      for (const thickness of [1, 3])
        it(`${kind} ${widthMm}/${lengthMm}/${heightMm} at ${thickness} mm emits closed validated geometry`, () => {
          const p = createProject();
          p.fabricationMode = 'fold-template';
          p.materialProfileSnapshot.thicknessMm = thickness;
          Object.assign(p.modeSettings.foldTemplate, {
            templateKind: kind,
            widthMm,
            lengthMm,
            heightMm,
            wallHeightMm: heightMm,
            tabDepthMm: 6,
            topScale: kind === 'pyramid-frustum' ? 0.5 : 0,
          });
          const result = generate(p);
          expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
          expect(result.parts.length).toBeGreaterThan(0);
          expect(validateGraph(result.graph!).filter((i) => i.severity === 'error')).toEqual([]);
          expect(compileToParts(result.graph!).parts).toEqual(result.parts);
          expect(
            result.parts.every((part) =>
              part.paths
                .filter((path) => path.operation === 'cut')
                .every((path) => path.closed && isSimplePolygon(path.points)),
            ),
          ).toBe(true);
        });
  it('registers five actual construction recipes with tested graphs and no unsupported FEFCO entry', () => {
    for (const definition of templateRegistry.filter((d) => d.recipeId)) {
      const graph = generateTemplateGraph(
        {
          templateId: definition.id,
          templateVersion: definition.version,
          values: Object.fromEntries(definition.parameters.map((p) => [p.id, p.default])),
        },
        { thicknessMm: 1 },
      );
      expect(graph.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(compileToParts(graph).parts.length).toBeGreaterThan(0);
      expect(graph.connections.some((c) => c.treatment === 'finger')).toBe(true);
    }
    expect(templateRegistry.some((d) => d.fefcoCode && !d.generatorId)).toBe(false);
  });
});
