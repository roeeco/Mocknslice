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
      expect(first.algorithmVersion).toBe('interactive-connections-v8');
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

  it('merges crease-connected panels into a closed component with a direct score path', () => {
    const result = generate({
      connectionOverrides: { 'base-front': { treatment: 'crease' } },
      glueTabDepthMm: 8,
      boundaryGlueTabs: [],
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(result.parts).toHaveLength(4);
    const component = result.parts.find((part) =>
      part.construction?.panelIds?.includes('construction-panel-base'),
    )!;
    expect(component.construction?.panelIds).toEqual([
      'construction-panel-base',
      'construction-panel-front',
    ]);
    expect(component.paths.some((path) => path.operation === 'score')).toBe(true);
    expect(
      component.paths.filter((path) => path.contourRole === 'outer').every((path) => path.closed),
    ).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CARDBOARD_FIT_UNVERIFIED' })]),
    );
  });

  it('adds a shouldered paired glue tab with a score at its base', () => {
    const result = generate({
      jointKind: 'butt',
      connectionOverrides: {
        'base-front': {
          treatment: 'butt',
          glueTabOwnerPanelId: 'construction-panel-base',
        },
      },
      glueTabDepthMm: 8,
      boundaryGlueTabs: [],
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs?.[0]).toMatchObject({
      ownerPanelId: 'construction-panel-base',
      depthMm: 8,
    });
    expect(
      result.parts
        .flatMap((part) => part.paths)
        .some((path) => path.tabId === result.tabs?.[0]?.id),
    ).toBe(true);
  });

  it('blocks crease cycles and creases between unlike stock thicknesses', () => {
    const cycle = generate({
      connectionOverrides: {
        'base-front': { treatment: 'crease' },
        'base-left': { treatment: 'crease' },
        'front-left': { treatment: 'crease' },
      },
    });
    expect(cycle.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CONNECTION_CREASE_CYCLE' })]),
    );

    const mismatch = generate({
      includeLid: true,
      lidThicknessMm: 2,
      connectionOverrides: { 'lid-front': { treatment: 'crease' } },
    });
    expect(mismatch.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'CONNECTION_THICKNESS_MISMATCH' })]),
    );
  });

  it('rejects legacy tab-slot generation instead of emitting unreliable geometry', () => {
    const result = generate({ jointKind: 'tab-slot' });

    expect(result.parts).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PANEL_JOINT_UNSUPPORTED' })]),
    );
  });

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

  it('resolves mixed joint families once per stable physical connection', () => {
    const result = generate({
      jointKind: 'finger',
      connectionOverrides: {
        'base-front': { treatment: 'butt' },
        'front-left': { treatment: 'finger', clearanceMm: 0.3 },
      },
    });
    const baseFront = result.joints.find(
      (joint) =>
        joint.panelAId === 'construction-panel-base' &&
        joint.panelBId === 'construction-panel-front',
    )!;
    const frontLeft = result.joints.find(
      (joint) =>
        joint.panelAId === 'construction-panel-front' &&
        joint.panelBId === 'construction-panel-left',
    )!;
    const panel = (id: string) => result.panels.find((candidate) => candidate.id === id)!;

    expect(baseFront).toMatchObject({ kind: 'butt', fingerCount: 0 });
    expect(frontLeft).toMatchObject({ kind: 'finger', clearanceMm: 0.3 });
    if (baseFront.edgeA !== 'face')
      expect(panel(baseFront.panelAId).edgeJointIds[baseFront.edgeA]).toBe(baseFront.id);
    if (baseFront.edgeB !== 'face')
      expect(panel(baseFront.panelBId).edgeJointIds[baseFront.edgeB]).toBe(baseFront.id);
    if (frontLeft.edgeA !== 'face')
      expect(panel(frontLeft.panelAId).edgeJointIds[frontLeft.edgeA]).toBe(frontLeft.id);
    if (frontLeft.edgeB !== 'face')
      expect(panel(frontLeft.panelBId).edgeJointIds[frontLeft.edgeB]).toBe(frontLeft.id);
    expect(result.inputHash).not.toBe(generate().inputHash);
  });

  it.each(['arch', 'gable', 'stepped'] as const)(
    'uses the same bounded %s profile in fabrication and assembly geometry',
    (profile) => {
      const result = generate({ panelProfiles: { front: profile, back: profile } });
      const front = result.panels.find((panel) => panel.role === 'front')!;
      const assembledFront = result.assembledPreview.panels.find((panel) => panel.id === front.id)!;
      const topEndpoints = front.outline.filter((point) => point.y === settings.innerHeightMm / 2);

      expect(Math.max(...front.outline.map((point) => point.y))).toBeGreaterThan(
        settings.innerHeightMm / 2,
      );
      expect(topEndpoints).toEqual(
        expect.arrayContaining([
          { x: settings.innerWidthMm / 2, y: settings.innerHeightMm / 2 },
          { x: -settings.innerWidthMm / 2, y: settings.innerHeightMm / 2 },
        ]),
      );
      expect(assembledFront.verticesMm).toEqual(
        front.outline.map((point) => [
          point.x,
          point.y + settings.innerHeightMm / 2,
          -settings.innerDepthMm / 2,
        ]),
      );
    },
  );

  it('blocks incompatible profile/lid and connection override settings explicitly', () => {
    const profileWithLid = generate({
      includeLid: true,
      panelProfiles: { front: 'arch', back: 'flat' },
    });
    const buttClearance = generate({
      connectionOverrides: { 'base-front': { treatment: 'butt', clearanceMm: 0.2 } },
    });

    expect(profileWithLid.parts).toHaveLength(0);
    expect(profileWithLid.issues.map((issue) => issue.code)).toContain(
      'PANEL_PROFILE_LID_INCOMPATIBLE',
    );
    expect(buttClearance.parts).toHaveLength(0);
    expect(buttClearance.issues.map((issue) => issue.code)).toContain(
      'PANEL_CONNECTION_OVERRIDE_INVALID',
    );
  });

  it('adds a fully jointed lid and assembly-order warning', () => {
    const result = generate({ includeLid: true, lidThicknessMm: 2 });

    expect(result.panels).toHaveLength(6);
    expect(result.joints).toHaveLength(12);
    expect(result.parts.at(-1)?.construction?.role).toBe('lid');
    expect(result.parts.at(-1)?.thicknessMm).toBe(2);
    expect(result.issues.map((issue) => issue.code)).toContain('PANEL_CLOSED_ASSEMBLY_REVIEW');
  });

  it('uses independent base/wall, divider, and lid stock thicknesses', () => {
    const result = generate({
      includeLid: true,
      widthDividerCount: 1,
      panelThicknessMm: 3,
      dividerThicknessMm: 2,
      lidThicknessMm: 4,
    });
    const thicknessFor = (role: string) =>
      result.parts.find((part) => part.construction?.role === role)?.thicknessMm;
    const baseSlots = result.parts
      .find((part) => part.construction?.role === 'base')!
      .paths.filter((path) => path.id.includes('base-slot'));

    expect(thicknessFor('base')).toBe(3);
    expect(thicknessFor('front')).toBe(3);
    expect(thicknessFor('divider-1')).toBe(2);
    expect(thicknessFor('lid')).toBe(4);
    expect(Math.abs(baseSlots[0]!.points[1]!.y - baseSlots[0]!.points[2]!.y)).toBeCloseTo(2.15);
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
      material: { ...material, id: 'paper', category: 'paper', thicknessMm: 1 },
      settings,
    });
    const tooSmall = generate({ innerHeightMm: 5 });
    const narrow = generate({ fingerWidthMm: 3 });
    const unsupportedJoint = generate({ jointKind: 'tab-slot' });

    expect(paper.issues.map((issue) => issue.code)).toContain('PANEL_RIGID_JOINT_MATERIAL_REVIEW');
    expect(tooSmall.parts).toHaveLength(0);
    expect(tooSmall.issues.map((issue) => issue.code)).toContain('PANEL_DIMENSION_TOO_SMALL');
    expect(narrow.issues.map((issue) => issue.code)).toContain('PANEL_FINGER_TOO_NARROW');
    expect(narrow.settings.fingerWidthMm).toBe(3);
    expect(unsupportedJoint.parts).toHaveLength(0);
    expect(unsupportedJoint.issues.map((issue) => issue.code)).toContain('PANEL_JOINT_UNSUPPORTED');
  });

  it('generates feature cutouts and matching assembled-preview holes', () => {
    const result = generatePanelConstruction({
      sourceId: 'panel-construction',
      material,
      settings: {
        ...settings,
        features: [
          {
            id: 'feature-1',
            kind: 'circular-cutout',
            targetRole: 'front',
            anchor: { u: 0.5, v: 0.5 },
            rotationDeg: 0,
            diameterMm: 10,
          },
        ],
      },
    });
    const front = result.parts.find((part) => part.construction?.role === 'front')!;
    const cutout = front.paths.find((path) => path.featureId === 'feature-1')!;
    expect(cutout).toMatchObject({
      id: 'feature-1-cutout',
      contourRole: 'hole',
      closed: true,
      panelId: 'construction-panel-front',
    });
    expect(cutout.points).toHaveLength(48);
    expect(
      result.assembledPreview.panels
        .find((panel) => panel.id === 'construction-panel-front')
        ?.holesVerticesMm?.some((hole) => hole.length === 48),
    ).toBe(true);
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
  });

  it('keeps invalid feature definitions and reports structured issues', () => {
    const features = [
      {
        id: 'outside',
        kind: 'rectangular-cutout' as const,
        targetRole: 'front' as const,
        anchor: { u: 1.2, v: 0.5 },
        rotationDeg: 0,
        widthMm: 20,
        heightMm: 10,
      },
      {
        id: 'missing-lid',
        kind: 'circular-cutout' as const,
        targetRole: 'lid' as const,
        anchor: { u: 0.5, v: 0.5 },
        rotationDeg: 0,
        diameterMm: 10,
      },
    ];
    const result = generatePanelConstruction({
      sourceId: 'panel-construction',
      material,
      settings: { ...settings, features },
    });
    expect(result.settings.features).toEqual(
      [...features].sort((left, right) => left.id.localeCompare(right.id)),
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['PANEL_FEATURE_OUTSIDE_PANEL', 'PANEL_FEATURE_TARGET_MISSING']),
    );
  });
});
