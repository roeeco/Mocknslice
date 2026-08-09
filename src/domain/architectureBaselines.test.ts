import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import { generatePanelConstruction } from '../geometry/panelConstruction/generatePanelConstruction';
import { generateStackedSlices } from '../geometry/slicing/generateStackedSlices';
import { generateWaffleSlices } from '../geometry/slicing/generateWaffleSlices';
import { generateMeshUnfold } from '../geometry/unfolding/generateMeshUnfold';
import { parseProjectFile } from '../exporters/importProject';
import { legacyProjectFixtures } from '../test-fixtures/legacyProjectFiles';
import { hashSerializable } from './generation';
import { TEMPLATE_KINDS } from './folding';
import { buildCanonicalGenerationInput } from './generationInputs';

const cube = createCubeMesh(40);

function physicalResult<T extends { algorithmVersion: string; inputHash: string }>(value: T) {
  const physical = { ...value } as Partial<T>;
  delete physical.algorithmVersion;
  delete physical.inputHash;
  delete (physical as { editableEdges?: unknown }).editableEdges;
  if (
    'tabs' in physical &&
    Array.isArray((physical as { tabs?: unknown[] }).tabs) &&
    (physical as { tabs: unknown[] }).tabs.length === 0
  ) {
    delete (physical as { tabs?: unknown[] }).tabs;
  }
  if ('joints' in physical && Array.isArray((physical as { joints?: unknown[] }).joints)) {
    (physical as { joints: Array<Record<string, unknown>> }).joints = (
      physical as { joints: Array<Record<string, unknown>> }
    ).joints.map((joint) => {
      const physicalJoint = { ...joint };
      delete physicalJoint.connectionKey;
      return physicalJoint;
    });
  }
  return physical;
}

describe('architecture regression baselines', () => {
  it('keeps representative project versions importable', () => {
    for (const fixture of legacyProjectFixtures) {
      const project = parseProjectFile(fixture.source);
      expect(project.metadata.id, `version ${fixture.version}`).toBe('project-legacy-fixture');
    }
  });

  it('regenerates migrated v6 stacked geometry without changing physical output', () => {
    const migrated = parseProjectFile(legacyProjectFixtures[5].source);
    const input = buildCanonicalGenerationInput(migrated);
    if (input.mode !== 'stacked-slices') throw new Error('Fixture mode changed unexpectedly.');
    const regenerated = generateStackedSlices(input.payload);
    const expected = generateStackedSlices({
      mesh: input.payload.mesh,
      bounds: input.payload.bounds,
      modelId: input.payload.modelId,
      settings: { axis: 'z', spacingMm: 10, thicknessMm: 0.35, contourEpsilonMm: 0.001 },
    });
    expect(hashSerializable(regenerated)).toBe(hashSerializable(expected));
  });

  it('freezes stacked and waffle physical geometry', () => {
    const stacked = generateStackedSlices({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'baseline-model',
      settings: { axis: 'z', spacingMm: 10, thicknessMm: 1, contourEpsilonMm: 0.001 },
    });
    const waffle = generateWaffleSlices({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'baseline-model',
      settings: {
        primaryAxis: 'x',
        secondaryAxis: 'y',
        primarySpacingMm: 20,
        secondarySpacingMm: 20,
        thicknessMm: 3,
        clearanceMm: 0.15,
        contourEpsilonMm: 0.001,
        slotPattern: 'alternating',
        reverseSlots: false,
      },
    });
    expect({ stacked: hashSerializable(stacked), waffle: hashSerializable(waffle) }).toEqual({
      stacked: 'sf9-635863d7',
      waffle: 'sf9-57a6aec4',
    });
  });

  it('freezes every standalone folding template', () => {
    const hashes = Object.fromEntries(
      TEMPLATE_KINDS.map((templateKind) => {
        const result = generateFoldTemplate({
          mesh: cube.mesh,
          bounds: cube.bounds,
          modelId: 'baseline-model',
          materialThicknessMm: 1,
          settings: {
            templateKind,
            fitAxis: 'y',
            clearanceMm: 0,
            profileToleranceMm: 1,
            sizeMode: 'custom',
            envelopeDimensions: { widthMm: 80, lengthMm: 60, heightMm: 40 },
            parameters: {
              standalone: true,
              wallHeightMm: 40,
              tabDepthMm: 8,
              lidDepthMm: 15,
              lidClearanceMm: 0.5,
              gussetDepthMm: 40,
              closureFlapMm: 12,
              prismSides: 6,
              prismRotationDeg: 0,
              topScale: 0.5,
              seamTabMm: 8,
              closureMethod: 'glue',
              slotClearanceMm: 0.1,
            },
          },
        });
        return [templateKind, hashSerializable(physicalResult(result))];
      }),
    );
    expect(hashes).toEqual({
      'open-box': 'sf9-62a4444b',
      'box-with-lid': 'sf9-d245b553',
      tray: 'sf9-cb16b5d7',
      sleeve: 'sf9-d3aa4fe5',
      envelope: 'sf9-b4dd26b8',
      'regular-prism': 'sf9-97b97f6f',
      'pyramid-frustum': 'sf9-37138773',
    });
  });

  it('freezes mesh unfolding and the panel-construction matrix', () => {
    const unfolding = generateMeshUnfold({
      mesh: cube.mesh,
      modelId: 'baseline-model',
      materialThicknessMm: 1,
      settings: {
        strategy: 'automatic',
        rootFaceIndex: 0,
        manualSeamKeys: [],
        tabDepthMm: 6,
        maximumFaceCount: 200,
        searchAttempts: 18,
      },
    });
    const cases = [
      { jointKind: 'butt' as const, includeLid: false },
      { jointKind: 'finger' as const, includeLid: true },
      { jointKind: 'finger' as const, includeLid: false, widthDividerCount: 1 },
      { jointKind: 'finger' as const, includeLid: false, depthDividerCount: 1 },
      {
        jointKind: 'finger' as const,
        includeLid: true,
        widthDividerCount: 1,
        depthDividerCount: 1,
        panelThicknessMm: 1,
        dividerThicknessMm: 2,
        lidThicknessMm: 3,
      },
    ];
    const panels = cases.map((settings) =>
      hashSerializable(
        physicalResult(
          generatePanelConstruction({
            modelId: 'baseline-model',
            material: {
              id: 'chipboard-1mm',
              category: 'card',
              thicknessMm: 1,
              kerfMm: 0.15,
            },
            settings: {
              innerWidthMm: 80,
              innerDepthMm: 60,
              innerHeightMm: 50,
              fingerWidthMm: 10,
              clearanceMm: 0.15,
              ...settings,
            },
          }),
        ),
      ),
    );
    expect({ unfolding: hashSerializable(physicalResult(unfolding)), panels }).toEqual({
      unfolding: 'sf9-eade5786',
      panels: ['sf9-4648fd8c', 'sf9-acfbe5be', 'sf9-240c104a', 'sf9-91262e65', 'sf9-d69afb69'],
    });
  });
});
