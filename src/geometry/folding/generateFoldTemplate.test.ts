import { describe, expect, it } from 'vitest';
import type { TemplateFitSettings, TemplateKind } from '../../domain/folding';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { generateFoldTemplate } from './generateFoldTemplate';
import type { Point2D } from '../../domain/geometry';

const cube = createCubeMesh(40);

function settings(
  templateKind: TemplateKind,
  parameters: Record<string, number> = {},
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

function generate(templateKind: TemplateKind, parameters?: Record<string, number>) {
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
    expect(first.algorithmVersion).toBe('convex-template-v1');
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

  it('applies regular-prism side count and rotation controls', () => {
    const sixSides = generate('regular-prism');
    const eightSides = generate('regular-prism', { prismSides: 8, prismRotationDeg: 15 });
    expect(sixSides.panels).toHaveLength(8);
    expect(eightSides.panels).toHaveLength(10);
    expect(eightSides.profile).toEqual(sixSides.profile);
    expect(eightSides.parts[0]?.name).toBe('8-sided prism net');
  });

  it('creates a separate fitted cap for a truncated pyramid', () => {
    const result = generate('pyramid-frustum', { topScale: 0.5 });
    expect(result.parts).toHaveLength(2);
    expect(result.parts[1]?.name).toBe('Frustum top cap');
    expect(result.tabs.length).toBeGreaterThan(4);
  });

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
});
