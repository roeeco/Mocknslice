import { describe, expect, it } from 'vitest';
import type {
  PanelConstructionMaterial,
  PanelConstructionSettings,
} from '../../domain/panelConstruction';
import { generatePanelConstruction } from './generatePanelConstruction';

const material: PanelConstructionMaterial = {
  id: 'plywood-3mm',
  category: 'sheet-wood',
  thicknessMm: 3,
  kerfMm: 0.18,
};

const settings: PanelConstructionSettings = {
  innerWidthMm: 80,
  innerDepthMm: 60,
  innerHeightMm: 50,
  jointKind: 'finger',
  fingerWidthMm: 10,
  clearanceMm: 0.15,
  includeLid: false,
};

function generate(overrides: Partial<PanelConstructionSettings> = {}) {
  return generatePanelConstruction({
    modelId: 'panel-kit',
    material,
    settings: { ...settings, ...overrides },
  });
}

describe('generatePanelConstruction', () => {
  it.each([
    ['butt', 5, 8, 0],
    ['finger', 5, 8, 0],
    ['tab-slot', 5, 8, 20],
  ] as const)(
    'generates deterministic %s panel joints',
    (jointKind, panelCount, jointCount, minimumSlots) => {
      const first = generate({ jointKind });
      const second = generate({ jointKind });

      expect(first).toEqual(second);
      expect(first.panels).toHaveLength(panelCount);
      expect(first.parts).toHaveLength(panelCount);
      expect(first.joints).toHaveLength(jointCount);
      expect(first.assembledPreview.panels).toHaveLength(panelCount);
      expect(first.algorithmVersion).toBe('rectangular-joints-v4');
      expect(first.inputHash).toMatch(/^sf9-[0-9a-f]{8}$/);
      expect(first.issues.some((issue) => issue.severity === 'error')).toBe(false);
      expect(
        first.parts.flatMap((part) => part.paths.filter((path) => path.contourRole === 'hole'))
          .length,
      ).toBeGreaterThanOrEqual(minimumSlots);
      for (const part of first.parts) {
        expect(part.paths[0]?.closed).toBe(true);
        expect(part.paths[0]?.contourRole).toBe('outer');
        expect(part.labels?.some((label) => label.text === part.label)).toBe(true);
        expect(part.construction?.jointIds.length).toBeGreaterThan(0);
      }
    },
  );

  it('uses complementary finger phases on every paired joint', () => {
    const result = generate({ jointKind: 'finger' });

    for (const joint of result.joints) {
      expect(joint.fingerCount).toBeGreaterThanOrEqual(3);
      expect(joint.fingerCount % 2).toBe(1);
      expect(joint.pairLabel).toMatch(/^J\d+$/);
      const panelA = result.panels.find((panel) => panel.id === joint.panelAId)!;
      const panelB = result.panels.find((panel) => panel.id === joint.panelBId)!;
      if (joint.edgeA !== 'face') expect(panelA.edgeJointIds[joint.edgeA]).toBe(joint.id);
      if (joint.edgeB !== 'face') expect(panelB.edgeJointIds[joint.edgeB]).toBe(joint.id);
    }
    expect(result.panels.every((panel) => panel.outline.length > 4)).toBe(true);
  });

  it('adds a fully jointed lid and assembly-order warning', () => {
    const result = generate({ includeLid: true });

    expect(result.panels).toHaveLength(6);
    expect(result.joints).toHaveLength(12);
    expect(result.parts.at(-1)?.construction?.role).toBe('lid');
    expect(result.issues.map((issue) => issue.code)).toContain('PANEL_CLOSED_ASSEMBLY_REVIEW');
  });

  it.each(['width', 'depth'] as const)(
    'adds base tabs, finger-jointed sides, wall slots, and exact 3D geometry across %s',
    (dividerAxis) => {
      const result = generate({ dividerCount: 2, dividerAxis, jointKind: 'finger' });

      const expectedReceiverRoles = dividerAxis === 'width' ? ['left', 'right'] : ['front', 'back'];
      const dividerJoints = result.joints.filter((joint) => joint.edgeB === 'face');

      expect(result.panels).toHaveLength(7);
      expect(result.parts).toHaveLength(7);
      expect(result.joints).toHaveLength(12);
      expect(dividerJoints).toHaveLength(4);
      expect(
        dividerJoints.map((joint) => joint.panelBId.replace('construction-panel-', '')).sort(),
      ).toEqual([...expectedReceiverRoles, ...expectedReceiverRoles].sort());
      expect(dividerJoints.every((joint) => joint.tabOwnerPanelId?.includes('divider-'))).toBe(
        true,
      );
      expect(result.panels.filter((panel) => panel.role.startsWith('divider-'))).toHaveLength(2);
      expect(
        result.panels
          .filter((panel) => panel.role.startsWith('divider-'))
          .every((panel) => panel.outline.some((point) => Math.abs(point.x) > panel.widthMm / 2)),
      ).toBe(true);
      expect(
        result.parts
          .find((part) => part.construction?.role === 'base')
          ?.paths.filter((path) => path.id.includes('base-slot')),
      ).toHaveLength(4);
      expect(
        result.parts.flatMap((part) => part.paths.filter((path) => path.id.includes('-side-slot-')))
          .length,
      ).toBeGreaterThan(0);
      expect(
        result.assembledPreview.panels.find((panel) => panel.id === 'construction-panel-base')
          ?.holesVerticesMm,
      ).toHaveLength(4);
      expect(
        result.assembledPreview.panels.find((panel) => panel.id === 'construction-panel-front')
          ?.verticesMm.length,
      ).toBeGreaterThan(4);
      expect(
        result.assembledPreview.panels
          .filter((panel) =>
            expectedReceiverRoles.some((role) => panel.id === `construction-panel-${role}`),
          )
          .every((panel) => (panel.holesVerticesMm?.length ?? 0) > 0),
      ).toBe(true);
    },
  );

  it('creates simultaneous divider families with complementary half-lap notches', () => {
    const result = generate({
      widthDividerCount: 2,
      depthDividerCount: 3,
      jointKind: 'finger',
    });
    const dividerPanels = result.panels.filter((panel) => panel.role.startsWith('divider-'));
    const halfLapJoints = result.joints.filter((joint) => joint.kind === 'half-lap');
    const baseSlots = result.parts
      .find((part) => part.construction?.role === 'base')
      ?.paths.filter((path) => path.id.includes('base-slot'));

    expect(result).toEqual(
      generate({ widthDividerCount: 2, depthDividerCount: 3, jointKind: 'finger' }),
    );
    expect(dividerPanels).toHaveLength(5);
    expect(halfLapJoints).toHaveLength(6);
    expect(result.joints).toHaveLength(24);
    expect(baseSlots).toHaveLength(10);
    expect(halfLapJoints.every((joint) => joint.receiverCentreAMm && joint.receiverCentreMm)).toBe(
      true,
    );

    const widthDividers = dividerPanels.slice(0, 2);
    const depthDividers = dividerPanels.slice(2);
    expect(
      widthDividers.every((panel) =>
        panel.outline.some((point) => point.y === 0 && Math.abs(point.x) < panel.widthMm / 2),
      ),
    ).toBe(true);
    expect(
      depthDividers.every((panel) =>
        panel.outline.some((point) => point.y === 0 && Math.abs(point.x) < panel.widthMm / 2),
      ),
    ).toBe(true);
  });

  it('reports material and dimension incompatibilities without silent repair', () => {
    const paper = generatePanelConstruction({
      modelId: 'paper-kit',
      material: { ...material, id: 'paper', category: 'paper', thicknessMm: 0.2 },
      settings,
    });
    const tooSmall = generate({ innerHeightMm: 5 });
    const narrow = generate({ fingerWidthMm: 3 });
    const excessiveClearance = generate({ jointKind: 'tab-slot', clearanceMm: 30 });

    expect(paper.issues.map((issue) => issue.code)).toContain('PANEL_RIGID_JOINT_MATERIAL_REVIEW');
    expect(tooSmall.parts).toHaveLength(0);
    expect(tooSmall.issues.map((issue) => issue.code)).toContain('PANEL_DIMENSION_TOO_SMALL');
    expect(narrow.issues.map((issue) => issue.code)).toContain('PANEL_FINGER_TOO_NARROW');
    expect(narrow.settings.fingerWidthMm).toBe(3);
    expect(excessiveClearance.parts).toHaveLength(0);
    expect(excessiveClearance.issues.map((issue) => issue.code)).toContain(
      'PANEL_CLEARANCE_TOO_LARGE',
    );
  });
});
