import type { ValidationIssue } from '../../domain/validation';
import type { PanelConnectionKey } from '../../domain/panelConstruction';
import {
  DEFAULT_PANEL_PROFILES,
  PANEL_CONNECTION_KEYS,
  PANEL_PROFILE_KINDS,
  hasRaisedPanelProfile,
  maximumPanelDividerCount,
} from '../../domain/panelConstruction';
import type { PanelConstructionInput } from './constructionTypes';
import {
  dividerCountsFor,
  dividerThicknessMm,
  inputSourceId,
  lidThicknessMm,
  panelThicknessMm,
} from './constructionHelpers';
import { segmentCount } from './fingerJoints';
import { jointSpecs } from './dividerJoints';

export function inputIssues(input: PanelConstructionInput): ValidationIssue[] {
  const { settings, material } = input;
  const sourceId = inputSourceId(input);
  const dividerCounts = dividerCountsFor(settings);
  const panelThickness = panelThicknessMm(settings, material);
  const dividerThickness = dividerThicknessMm(settings, material);
  const lidThickness = lidThicknessMm(settings, material);
  const maximumStockThickness = Math.max(
    panelThickness,
    dividerThickness,
    settings.includeLid ? lidThickness : 0,
  );
  const dimensions = [settings.innerWidthMm, settings.innerDepthMm, settings.innerHeightMm];
  if (
    dimensions.some((value) => !Number.isFinite(value) || value <= 0) ||
    !Number.isFinite(settings.fingerWidthMm) ||
    settings.fingerWidthMm <= 0 ||
    !Number.isFinite(settings.clearanceMm) ||
    settings.clearanceMm < 0 ||
    [panelThickness, dividerThickness, lidThickness].some(
      (value) => !Number.isFinite(value) || value < 1 || value > 10,
    ) ||
    !Number.isInteger(dividerCounts.width) ||
    !Number.isInteger(dividerCounts.depth) ||
    dividerCounts.width < 0 ||
    dividerCounts.depth < 0 ||
    dividerCounts.width > maximumPanelDividerCount(settings.innerDepthMm, dividerThickness) ||
    dividerCounts.depth > maximumPanelDividerCount(settings.innerWidthMm, dividerThickness)
  ) {
    return [
      {
        id: `panel-settings-invalid-${sourceId}`,
        severity: 'error',
        code: 'PANEL_SETTINGS_INVALID',
        message:
          'Panel dimensions and finger width must be positive; stock must be 1–10 mm and divider counts must fit the available space.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Correct the panel-construction dimensions and generate again.',
      },
    ];
  }
  if (settings.jointKind === 'tab-slot') {
    return [
      {
        id: `panel-joint-unsupported-${sourceId}`,
        severity: 'error',
        code: 'PANEL_JOINT_UNSUPPORTED',
        message: 'Tabs and through-slots are temporarily unavailable.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Use complementary finger joints or straight butt joints.',
      },
    ];
  }
  const profiles = settings.panelProfiles ?? DEFAULT_PANEL_PROFILES;
  if (
    !PANEL_PROFILE_KINDS.includes(profiles.front) ||
    !PANEL_PROFILE_KINDS.includes(profiles.back)
  ) {
    return [
      {
        id: `panel-profile-invalid-${sourceId}`,
        severity: 'error',
        code: 'PANEL_PROFILE_INVALID',
        message: 'Front and back panel profiles must use a supported bounded shape.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Choose flat, arch, gable, or stepped profiles.',
      },
    ];
  }
  if (settings.includeLid && hasRaisedPanelProfile(profiles)) {
    return [
      {
        id: `panel-profile-lid-${sourceId}`,
        severity: 'error',
        code: 'PANEL_PROFILE_LID_INCOMPATIBLE',
        message: 'Raised front or back profiles require an open top.',
        affectedEntityIds: ['construction-panel-front', 'construction-panel-back'],
        suggestedAction: 'Remove the lid or set both panel profiles to flat.',
      },
    ];
  }
  const overrides = settings.connectionOverrides ?? {};
  const unknownConnectionKey = Object.keys(overrides).find(
    (key) => !PANEL_CONNECTION_KEYS.includes(key as PanelConnectionKey),
  );
  if (unknownConnectionKey) {
    return [
      {
        id: `panel-connection-key-${sourceId}`,
        severity: 'error',
        code: 'PANEL_CONNECTION_OVERRIDE_INVALID',
        message: 'A connection override targets an inaccessible panel pairing.',
        affectedEntityIds: [sourceId],
        suggestedAction: 'Remove the unsupported connection override.',
      },
    ];
  }
  for (const spec of jointSpecs(settings).filter((candidate) => candidate.connectionKey)) {
    const override = settings.connectionOverrides?.[spec.connectionKey!];
    if (!override) continue;
    if (
      !(['butt', 'finger', 'crease'] as const).includes(override.treatment) ||
      (override.clearanceMm !== undefined &&
        (!Number.isFinite(override.clearanceMm) || override.clearanceMm < 0)) ||
      (override.treatment !== 'finger' && override.clearanceMm !== undefined) ||
      (override.glueTabOwnerPanelId !== undefined && override.treatment !== 'butt') ||
      (override.glueTabOwnerPanelId !== undefined &&
        override.glueTabOwnerPanelId !== `construction-panel-${spec.panelA}` &&
        override.glueTabOwnerPanelId !== `construction-panel-${spec.panelB}`)
    ) {
      return [
        {
          id: `panel-connection-override-${spec.connectionKey}-${sourceId}`,
          severity: 'error',
          code: 'PANEL_CONNECTION_OVERRIDE_INVALID',
          message: 'A connection override has an incompatible treatment, clearance, or tab owner.',
          affectedEntityIds: [sourceId, spec.connectionKey!],
          suggestedAction:
            'Use finger clearance only for finger joints and select one connected panel as a glue-tab owner.',
        },
      ];
    }
    const pitch = spec.lengthMm / segmentCount(spec.lengthMm, settings.fingerWidthMm);
    if (override.clearanceMm !== undefined && override.clearanceMm >= pitch) {
      return [
        {
          id: `panel-connection-clearance-${spec.connectionKey}-${sourceId}`,
          severity: 'error',
          code: 'PANEL_CONNECTION_CLEARANCE_TOO_LARGE',
          message: 'A connection clearance is at least as large as its finger pitch.',
          affectedEntityIds: [sourceId, spec.connectionKey!],
          suggestedAction: 'Reduce the connection clearance or use wider fingers.',
        },
      ];
    }
  }
  const issues: ValidationIssue[] = [];
  const dividerCount = dividerCounts.width + dividerCounts.depth;
  const usesFingers =
    settings.jointKind !== 'butt' ||
    Object.values(overrides).some((override) => override?.treatment === 'finger') ||
    dividerCount > 0;
  const widthSpacing =
    (settings.innerDepthMm - dividerCounts.width * dividerThickness) / (dividerCounts.width + 1);
  const depthSpacing =
    (settings.innerWidthMm - dividerCounts.depth * dividerThickness) / (dividerCounts.depth + 1);
  if (
    (dividerCounts.width > 0 && widthSpacing < dividerThickness * 4) ||
    (dividerCounts.depth > 0 && depthSpacing < dividerThickness * 4)
  ) {
    issues.push({
      id: `panel-divider-spacing-${sourceId}`,
      severity: 'error',
      code: 'PANEL_DIVIDER_SPACING_TOO_NARROW',
      message: 'The requested dividers leave sections narrower than four material thicknesses.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Use fewer dividers, a larger box, or thinner material.',
    });
  }
  if (Math.min(...dimensions) < maximumStockThickness * 4) {
    issues.push({
      id: `panel-dimension-too-small-${sourceId}`,
      severity: 'error',
      code: 'PANEL_DIMENSION_TOO_SMALL',
      message: 'Every enclosure dimension must be at least four material thicknesses.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Increase the enclosure dimensions or choose thinner material.',
    });
  }
  if (usesFingers && settings.fingerWidthMm < maximumStockThickness * 1.5) {
    issues.push({
      id: `panel-finger-narrow-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_FINGER_TOO_NARROW',
      message: 'The target finger width is narrow relative to material thickness.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Increase finger width and test the joint in scrap material.',
    });
  }
  const shortestJoint = Math.min(...dimensions);
  const minimumPitch = shortestJoint / segmentCount(shortestJoint, settings.fingerWidthMm);
  const dividerPitch =
    settings.innerHeightMm / segmentCount(settings.innerHeightMm, settings.fingerWidthMm);
  if (usesFingers && settings.fingerWidthMm > shortestJoint / 3) {
    issues.push({
      id: `panel-finger-sparse-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_TOO_FEW_FINGERS',
      message: 'The target width produces only a few large fingers on at least one joint.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Reduce target finger width for better load distribution.',
    });
  }
  if (usesFingers && Math.min(minimumPitch, dividerPitch) <= material.kerfMm * 4) {
    issues.push({
      id: `panel-finger-kerf-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_FINGER_NEAR_KERF_LIMIT',
      message: 'At least one finger pitch is very small relative to the material kerf.',
      affectedEntityIds: [sourceId, material.id],
      suggestedAction: 'Use wider fingers or a lower-kerf cutting process.',
    });
  }
  if (dividerCount > 0 && settings.clearanceMm >= dividerPitch) {
    issues.push({
      id: `panel-divider-clearance-large-${sourceId}`,
      severity: 'error',
      code: 'PANEL_DIVIDER_CLEARANCE_TOO_LARGE',
      message: 'Divider slot clearance is at least as large as the side-finger pitch.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Reduce slot clearance or use wider divider fingers.',
    });
  }
  if (
    usesFingers &&
    (material.category === 'paper' || (material.category === 'card' && panelThickness < 0.8))
  ) {
    issues.push({
      id: `panel-flexible-material-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_RIGID_JOINT_MATERIAL_REVIEW',
      message: 'Finger joints are intended for rigid sheet material; paper or card may tear.',
      affectedEntityIds: [material.id],
      suggestedAction: 'Use a rigid material or choose butt joints with adhesive.',
    });
  }
  if (settings.jointKind === 'butt') {
    issues.push({
      id: `panel-butt-fastener-${sourceId}`,
      severity: 'info',
      code: 'PANEL_BUTT_JOINT_FASTENER_REQUIRED',
      message: 'Butt-joint panels require adhesive, tape, or external fasteners.',
      affectedEntityIds: [sourceId],
      suggestedAction: 'Plan the assembly method before cutting.',
    });
  }
  if (settings.includeLid && settings.jointKind !== 'butt') {
    issues.push({
      id: `panel-closed-assembly-${sourceId}`,
      severity: 'warning',
      code: 'PANEL_CLOSED_ASSEMBLY_REVIEW',
      message:
        'A jointed lid closes all enclosure edges and may require a specific assembly order.',
      affectedEntityIds: ['construction-panel-lid'],
      suggestedAction: 'Dry-fit the enclosure and leave the lid until last.',
    });
  }
  return issues;
}
