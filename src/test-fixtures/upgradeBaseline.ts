import type { FabricationMode } from '../domain/fabrication';
import { TEMPLATE_KINDS, type TemplateKind } from '../domain/folding';
import { hashSerializable } from '../domain/generation';
import {
  buildCanonicalGenerationInput,
  canonicalGenerationSignature,
} from '../domain/generationInputs';
import type { PanelComposerSettings } from '../domain/modeSettings';
import type { ProjectData } from '../domain/project';
import { parseProjectFile } from '../exporters/importProject';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import { arrangePartsInRows } from '../geometry/layout/arrangeParts';
import { generatePanelConstruction } from '../geometry/panelConstruction/generatePanelConstruction';
import { generateStackedSlices } from '../geometry/slicing/generateStackedSlices';
import { generateWaffleSlices } from '../geometry/slicing/generateWaffleSlices';
import { generateMeshUnfold } from '../geometry/unfolding/generateMeshUnfold';
import { legacyProjectFixtures } from './legacyProjectFiles';

// Test-only inputs fixed at de26e1bb44536c4ea243cd285569e3fecc3d9c74.
// Do not recapture expectations to make a geometry regression pass.
interface BaselineCase {
  id: string;
  mode: FabricationMode;
  templateKind?: TemplateKind;
  panelSettings?: Partial<PanelComposerSettings>;
  editedFold?: boolean;
}

export const upgradeBaselineCases: BaselineCase[] = [
  { id: 'stacked-z', mode: 'stacked-slices' },
  { id: 'waffle-xy', mode: 'waffle-slices' },
  ...TEMPLATE_KINDS.map((templateKind) => ({
    id: `fold-${templateKind}`,
    mode: 'fold-template' as const,
    templateKind,
  })),
  { id: 'unfold-cube', mode: 'mesh-unfold' },
  { id: 'panel-butt', mode: 'panel-construction', panelSettings: { jointKind: 'butt' } },
  {
    id: 'panel-finger-lid',
    mode: 'panel-construction',
    panelSettings: { includeLid: true },
  },
  {
    id: 'panel-width-divider',
    mode: 'panel-construction',
    panelSettings: { widthDividerCount: 1 },
  },
  {
    id: 'panel-depth-divider',
    mode: 'panel-construction',
    panelSettings: { depthDividerCount: 1 },
  },
  {
    id: 'panel-mixed-stock',
    mode: 'panel-construction',
    panelSettings: {
      includeLid: true,
      widthDividerCount: 1,
      depthDividerCount: 1,
      panelThicknessMm: 1,
      dividerThicknessMm: 2,
      lidThicknessMm: 3,
    },
  },
  {
    id: 'panel-edited-v8',
    mode: 'panel-construction',
    panelSettings: {
      jointKind: 'butt',
      connectionOverrides: {
        'base-front': { treatment: 'crease' },
        'front-left': {
          treatment: 'butt',
          glueTabOwnerPanelId: 'construction-panel-front',
        },
      },
      features: [
        {
          id: 'baseline-opening',
          kind: 'rectangular-cutout',
          targetRole: 'back',
          anchor: { u: 0.5, v: 0.5 },
          rotationDeg: 0,
          widthMm: 12,
          heightMm: 8,
        },
        {
          id: 'baseline-label',
          kind: 'engraved-label',
          targetRole: 'right',
          anchor: { u: 0.5, v: 0.5 },
          rotationDeg: 0,
          text: 'Baseline',
          fontSizeMm: 3,
        },
      ],
    },
  },
  {
    id: 'fold-edited-v8',
    mode: 'fold-template',
    templateKind: 'open-box',
    editedFold: true,
  },
];

export function generateUpgradeBaseline(fixture: BaselineCase) {
  const project = parseProjectFile(legacyProjectFixtures[5].source);
  project.metadata = {
    id: 'project-upgrade-baseline',
    name: `Upgrade baseline: ${fixture.id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  project.fabricationMode = fixture.mode;
  project.materialProfileSnapshot.thicknessMm = 1;
  project.modeSettings.stackedSlices.thicknessMm = 1;
  project.modeSettings.waffleSlices = {
    primaryAxis: 'x',
    secondaryAxis: 'y',
    primarySpacingMm: 20,
    secondarySpacingMm: 20,
    thicknessMm: 3,
    clearanceMm: 0.15,
    contourEpsilonMm: 0.001,
    slotPattern: 'alternating',
    reverseSlots: false,
  };
  project.modeSettings.foldTemplate = {
    ...project.modeSettings.foldTemplate,
    templateKind: fixture.templateKind ?? 'open-box',
    widthMm: 80,
    lengthMm: 60,
    heightMm: 40,
    wallHeightMm: 40,
    topScale: 0.5,
  };
  if (fixture.editedFold) {
    project.modeSettings.foldTemplate.connectionOverrides = [
      {
        id: 'baseline-fold-cut',
        templateKind: 'open-box',
        connectionId: 'fold-open-box-main-fold-bottom-connection',
        treatment: 'cut',
        closure: 'none',
      },
    ];
  }
  project.modeSettings.panelConstruction = {
    ...project.modeSettings.panelConstruction,
    innerWidthMm: 80,
    innerDepthMm: 60,
    innerHeightMm: 50,
    fingerWidthMm: 10,
    clearanceMm: 0.15,
    jointKind: 'finger',
    includeLid: false,
    panelThicknessMm: 1,
    dividerThicknessMm: 1,
    lidThicknessMm: 1,
    ...fixture.panelSettings,
  };
  const input = buildCanonicalGenerationInput(project);
  const result = generate(input, project);
  project.generatedParts = result.parts;
  project.generationIssues = result.issues;
  project.sheetLayouts = arrangePartsInRows(result.parts, {
    id: 'sheet-upgrade-baseline',
    widthMm: 600,
    heightMm: 400,
    marginMm: 5,
    spacingMm: 3,
    placements: [],
  });
  project.generationRecord = {
    ...canonicalGenerationSignature(project),
    resultHash: hashSerializable(result.parts),
    algorithmVersion: 'algorithmVersion' in result ? result.algorithmVersion : 'slicing-baseline',
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
  return { input, result, project };
}

function generate(input: ReturnType<typeof buildCanonicalGenerationInput>, project: ProjectData) {
  switch (input.mode) {
    case 'stacked-slices':
      return generateStackedSlices(input.payload);
    case 'waffle-slices':
      return generateWaffleSlices(input.payload);
    case 'fold-template': {
      const result = generateFoldTemplate(input.payload);
      project.foldingResult = result;
      return result;
    }
    case 'mesh-unfold': {
      const result = generateMeshUnfold(input.payload);
      project.unfoldingResult = result;
      return result;
    }
    case 'panel-construction': {
      const result = generatePanelConstruction(input.payload);
      project.panelConstructionResult = result;
      return result;
    }
  }
}
