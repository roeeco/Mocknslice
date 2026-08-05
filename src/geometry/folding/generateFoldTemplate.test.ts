import { describe, expect, it } from 'vitest';
import type { TemplateFitSettings, TemplateKind } from '../../domain/folding';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { generateFoldTemplate } from './generateFoldTemplate';
import type { Point2D } from '../../domain/geometry';

const cube = createCubeMesh(40);

function settings(
  templateKind: TemplateKind,
  parameters: Record<string, number | string | boolean> = {},
): TemplateFitSettings {
  return {
    templateKind,
    fitAxis: 'z',
    clearanceMm: 1,
    profileToleranceMm: 1,
    parameters: {
      wallHeightMm: 42,
      tabDepthMm: 6,
      lidDepthMm: 12,
      lidClearanceMm: 0.5,
      gussetDepthMm: 42,
      closureFlapMm: 10,
      seamTabMm: 6,
      prismSides: 6,
      prismRotationDeg: 0,
      topScale: 0,
      ...parameters,
    },
  };
}

function generate(
  templateKind: TemplateKind,
  parameters?: Record<string, number | string | boolean>,
) {
  return generateFoldTemplate({
    mesh: cube.mesh,
    bounds: cube.bounds,
    modelId: 'cube',
    materialThicknessMm: 1,
    settings: settings(templateKind, parameters),
  });
}

function pointOnBoundary(point: Point2D, outline: readonly Point2D[]): boolean {
  return outline.some((start, index) => {
    const end = outline[(index + 1) % outline.length]!;
    const edgeX = end.x - start.x;
    const edgeY = end.y - start.y;
    const pointX = point.x - start.x;
    const pointY = point.y - start.y;
    const cross = Math.abs(edgeX * pointY - edgeY * pointX);
    const dot = pointX * edgeX + pointY * edgeY;
    const squaredLength = edgeX * edgeX + edgeY * edgeY;
    return (
      cross <= Math.sqrt(squaredLength) * 0.000001 &&
      dot >= -0.000001 &&
      dot <= squaredLength + 0.000001
    );
  });
}

describe('generateFoldTemplate', () => {
  it.each([
    ['open-box', 1, 5],
    ['box-with-lid', 2, 10],
    ['tray', 1, 5],
    ['sleeve', 1, 4],
    ['envelope', 1, 6],
    ['regular-prism', 1, 8],
    ['pyramid-frustum', 1, 5],
  ] as const)('generates deterministic %s fabrication data', (kind, partCount, panelCount) => {
    const first = generate(kind);
    const second = generate(kind);

    expect(first).toEqual(second);
    expect(first.parts).toHaveLength(partCount);
    expect(first.panels).toHaveLength(panelCount);
    expect(first.assembledPreview.panels).toHaveLength(panelCount);
    expect(first.inputHash).toMatch(/^sf6-[0-9a-f]{8}$/);
    expect(first.algorithmVersion).toBe('interactive-connections-v8');
    expect(first.parts.flatMap((part) => part.paths).some((path) => path.operation === 'cut')).toBe(
      true,
    );
    expect(
      first.parts
        .flatMap((part) => part.paths)
        .some((path) => path.operation === 'valley-fold' || path.operation === 'score'),
    ).toBe(true);
    expect(first.issues.some((issue) => issue.severity === 'error')).toBe(false);
    for (const edge of first.edges.filter((candidate) => candidate.disposition === 'hinge')) {
      const panelA = first.panels.find((panel) => panel.id === edge.panelAId);
      const panelB = first.panels.find((panel) => panel.id === edge.panelBId);
      expect(panelA, `${kind} edge ${edge.id} panel A`).toBeDefined();
      expect(panelB, `${kind} edge ${edge.id} panel B`).toBeDefined();
      expect(pointOnBoundary(edge.start, panelA!.outline), `${edge.id} start A`).toBe(true);
      expect(pointOnBoundary(edge.end, panelA!.outline), `${edge.id} end A`).toBe(true);
      expect(pointOnBoundary(edge.start, panelB!.outline), `${edge.id} start B`).toBe(true);
      expect(pointOnBoundary(edge.end, panelB!.outline), `${edge.id} end B`).toBe(true);
      expect(edge.foldDirection).toMatch(/mountain|valley/);
      expect(edge.pairLabel).toMatch(/^F\d+$/);
    }
    for (const tab of first.tabs) {
      const owner = first.panels.find((panel) => panel.id === tab.ownerPanelId);
      expect(owner, `${kind} tab ${tab.id}`).toBeDefined();
      expect(pointOnBoundary(tab.baseStart, owner!.outline), `${tab.id} start`).toBe(true);
      expect(pointOnBoundary(tab.baseEnd, owner!.outline), `${tab.id} end`).toBe(true);
      expect(tab.depthMm).toBeGreaterThanOrEqual(1);
    }
  });

  it('splits a default crease into separate fabrication components when changed to cut', () => {
    const baseline = generate('open-box');
    const connection = baseline.connections.find((candidate) => candidate.disposition === 'hinge')!;
    const editedSettings = settings('open-box');
    editedSettings.connectionOverrides = [
      {
        id: 'cut-one-hinge',
        templateKind: 'open-box',
        connectionId: connection.id,
        treatment: 'cut',
        closure: 'none',
      },
    ];
    const edited = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: editedSettings,
    });

    expect(edited.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(edited.parts).toHaveLength(2);
    expect(edited.connections.find((candidate) => candidate.id === connection.id)).toMatchObject({
      disposition: 'seam',
      closure: 'none',
    });
    expect(
      edited.parts.flatMap((part) => part.paths).some((path) => path.edgeId === connection.id),
    ).toBe(false);
  });

  it('emits a receiving slit for an explicitly owned press-fit cut', () => {
    const baseline = generate('open-box');
    const connection = baseline.connections.find((candidate) => candidate.disposition === 'hinge')!;
    const editedSettings = settings('open-box');
    editedSettings.connectionOverrides = [
      {
        id: 'press-fit-cut',
        templateKind: 'open-box',
        connectionId: connection.id,
        treatment: 'cut',
        closure: 'press-fit',
        tabOwnerPanelId: connection.panelAId,
      },
    ];
    const edited = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: editedSettings,
    });

    expect(edited.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(edited.tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerPanelId: connection.panelAId,
          receiverPanelId: connection.panelBId,
          style: 'press-fit',
        }),
      ]),
    );
    expect(
      edited.parts.flatMap((part) => part.paths).some((path) => path.id.endsWith('receiver-slit')),
    ).toBe(true);
  });

  it('rejects cyclic seam-to-crease edits without discarding the override', () => {
    const baseline = generate('open-box');
    const seam = baseline.connections.find((candidate) => candidate.disposition === 'seam')!;
    const editedSettings = settings('open-box');
    editedSettings.connectionOverrides = [
      {
        id: 'close-cycle',
        templateKind: 'open-box',
        connectionId: seam.id,
        treatment: 'crease',
        closure: 'none',
      },
    ];
    const edited = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: editedSettings,
    });

    expect(edited.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CONNECTION_CREASE_CYCLE' })]),
    );
    expect(edited.settings.connectionOverrides).toEqual(editedSettings.connectionOverrides);
  });

  it('deterministically re-nets an acyclic seam-to-crease edit', () => {
    const baseline = generate('open-box');
    const seam = baseline.connections.find((candidate) => candidate.disposition === 'seam')!;
    const replacedHinge = baseline.connections.find(
      (candidate) =>
        candidate.disposition === 'hinge' &&
        (candidate.panelBId === seam.panelAId || candidate.panelBId === seam.panelBId),
    )!;
    const editedSettings = settings('open-box');
    editedSettings.connectionOverrides = [
      {
        id: 'release-old-hinge',
        templateKind: 'open-box',
        connectionId: replacedHinge.id,
        treatment: 'cut',
        closure: 'none',
      },
      {
        id: 'crease-old-seam',
        templateKind: 'open-box',
        connectionId: seam.id,
        treatment: 'crease',
        closure: 'none',
      },
    ];
    const input = {
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: editedSettings,
    };
    const first = generateFoldTemplate(input);
    const second = generateFoldTemplate(input);

    expect(first).toEqual(second);
    expect(first.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(first.parts).toHaveLength(1);
    expect(
      first.parts[0]?.paths.some((path) => path.edgeId === seam.id && path.operation === 'score'),
    ).toBe(true);
  });

  it('applies regular-prism side count and rotation controls', () => {
    const sixSides = generate('regular-prism');
    const eightSides = generate('regular-prism', { prismSides: 8, prismRotationDeg: 15 });
    expect(sixSides.panels).toHaveLength(8);
    expect(eightSides.panels).toHaveLength(10);
    expect(eightSides.profile).toEqual(sixSides.profile);
    expect(eightSides.parts[0]?.name).toBe('8-sided prism net');
  });

  it('creates a separate fitted cap for a truncated pyramid', () => {
    const result = generate('pyramid-frustum', {
      topScale: 0.5,
      closureMethod: 'press-fit',
      slotClearanceMm: 0.2,
    });
    expect(result.parts).toHaveLength(2);
    expect(result.parts[1]?.name).toBe('Frustum top cap');
    expect(result.tabs.length).toBeGreaterThan(4);
    expect(
      result.tabs
        .filter((tab) => tab.partId === 'fold-pyramid-cap')
        .every((tab) =>
          result.parts[0]?.paths.some((path) => path.id === `${tab.id}-receiver-slit`),
        ),
    ).toBe(true);
  });

  it.each([
    ['open-box', 4],
    ['box-with-lid', 8],
    ['tray', 4],
    ['sleeve', 1],
    ['envelope', 2],
    ['regular-prism', 1],
    ['pyramid-frustum', 4],
  ] as const)(
    'creates bounded press-fit lips and matching slits for %s',
    (templateKind, expectedTabs) => {
      const result = generateFoldTemplate({
        mesh: cube.mesh,
        bounds: cube.bounds,
        modelId: 'ignored-model',
        materialThicknessMm: 1,
        settings: {
          ...settings(templateKind, {
            standalone: true,
            closureMethod: 'press-fit',
            slotClearanceMm: 0.2,
            tabDepthMm: 100,
            seamTabMm: 100,
          }),
          sizeMode: 'custom',
          envelopeDimensions: { widthMm: 80, lengthMm: 60, heightMm: 40 },
        },
      });

      expect(result.profile.sourceModelId).toBe('standalone-template');
      expect(result.resolvedDimensions).toEqual({ widthMm: 80, lengthMm: 60, heightMm: 40 });
      expect(result.tabs).toHaveLength(expectedTabs);
      expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
      for (const tab of result.tabs) {
        const baseLength = Math.hypot(
          tab.baseEnd.x - tab.baseStart.x,
          tab.baseEnd.y - tab.baseStart.y,
        );
        expect(tab.style).toBe('press-fit');
        expect(tab.receiverPanelId).toBeDefined();
        expect(tab.slotStart).toBeDefined();
        expect(tab.slotEnd).toBeDefined();
        expect(tab.depthMm).toBeLessThanOrEqual(Math.min(baseLength * 0.35, 15) + 1e-6);
        expect(
          result.parts
            .flatMap((part) => part.paths)
            .some((path) => path.id === `${tab.id}-receiver-slit`),
        ).toBe(true);
      }
    },
  );

  it('records matched fold edges, glue tabs, and panel labels', () => {
    const result = generate('open-box');
    expect(result.edges.filter((edge) => edge.disposition === 'hinge')).toHaveLength(4);
    expect(
      result.edges.filter((edge) => edge.disposition === 'hinge').map((edge) => edge.pairLabel),
    ).toEqual(['F1', 'F2', 'F3', 'F4']);
    expect(result.tabs).toHaveLength(4);
    expect(result.parts[0]?.labels).toHaveLength(5);
    expect(result.parts[0]?.folding?.panelIds).toEqual(result.panels.map((panel) => panel.id));
  });

  it('reports a short box wall instead of silently changing it', () => {
    const result = generate('open-box', { wallHeightMm: 10 });
    expect(result.issues.map((issue) => issue.code)).toContain('TEMPLATE_INCOMPATIBLE');
  });

  it.each(['x', 'y', 'z'] as const)(
    'resizes a custom template envelope without changing the source mesh on %s',
    (fitAxis) => {
      const result = generateFoldTemplate({
        mesh: cube.mesh,
        bounds: cube.bounds,
        modelId: 'cube',
        materialThicknessMm: 1,
        settings: {
          ...settings('sleeve'),
          fitAxis,
          sizeMode: 'custom',
          envelopeDimensions: { widthMm: 60, lengthMm: 70, heightMm: 80 },
        },
      });
      expect(result.resolvedDimensions).toEqual({ widthMm: 60, lengthMm: 70, heightMm: 80 });
      expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
      expect(cube.mesh.positionsMm).toEqual(createCubeMesh(40).mesh.positionsMm);
    },
  );

  it('rejects a custom template envelope smaller than the fitted profile', () => {
    const result = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: {
        ...settings('open-box'),
        sizeMode: 'custom',
        envelopeDimensions: { widthMm: 20, lengthMm: 20, heightMm: 20 },
      },
    });
    expect(result.parts).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', code: 'TEMPLATE_INCOMPATIBLE' }),
      ]),
    );
  });

  it('rejects a profile that is too narrow for the selected material', () => {
    const result = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      materialThicknessMm: 30,
      settings: settings('sleeve'),
    });
    expect(result.parts).toHaveLength(0);
    expect(result.profile.fittedPoints).not.toHaveLength(0);
    expect(result.issues.map((issue) => issue.code)).toContain('PROFILE_FEATURE_TOO_NARROW');
  });

  it('rejects standalone dimensions and press-fit clearance that cannot support the material', () => {
    const tooThin = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'standalone',
      materialThicknessMm: 5,
      settings: {
        ...settings('open-box', { standalone: true }),
        sizeMode: 'custom',
        envelopeDimensions: { widthMm: 8, lengthMm: 40, heightMm: 40 },
      },
    });
    const looseSlot = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'standalone',
      materialThicknessMm: 1,
      settings: {
        ...settings('open-box', {
          standalone: true,
          closureMethod: 'press-fit',
          slotClearanceMm: 20,
        }),
        sizeMode: 'custom',
        envelopeDimensions: { widthMm: 80, lengthMm: 60, heightMm: 40 },
      },
    });

    expect(tooThin.parts).toHaveLength(0);
    expect(tooThin.issues.map((issue) => issue.code)).toContain('TEMPLATE_INCOMPATIBLE');
    expect(looseSlot.issues.map((issue) => issue.code)).toContain('PRESS_FIT_CLEARANCE_TOO_LARGE');
  });
});
