import type { FabricationPart, SheetLayout } from '../../domain/fabrication';
import type { ProjectData } from '../../domain/project';
import type { ValidationIssue } from '../../domain/validation';
import {
  deriveGenerationState,
  expectedGenerationSignature,
  hashSerializable,
} from '../../domain/generation';
import { validateGraph } from '../designGraph/validateGraph';
import { validatePapercraftNet } from '../papercraft/validateNet';
import { canonicalizeContours, outputIssue } from './canonicalizeContours';
import {
  prepareFabricationOutput,
  type PreparedFabricationOutput,
} from './prepareFabricationOutput';
import { intersectPlacedParts } from '../layout/intersectPlacedParts';
import { fabricationProfiles, type FabricationProfile } from './fabricationProfiles';
import { deriveTightOutputLayout } from '../layout/deriveTightOutputLayout';

export interface ExportReadiness {
  sourceInputHash: string;
  snapshotHash: string;
  status: 'blocked' | 'draft' | 'ready';
  blockingIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  requiredActions: { issueId: string; action: string }[];
  preparedParts: FabricationPart[];
  effectiveLayouts: SheetLayout[];
  prepared: PreparedFabricationOutput;
  projectSnapshot: ProjectData;
  profile: FabricationProfile;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
/** One immutable prepared snapshot is used for preflight, preview and the writer. */
export function evaluateExportReadiness(
  project: ProjectData,
  options: {
    layouts?: readonly SheetLayout[];
    profile?: FabricationProfile;
    layoutMode?: 'tight' | 'saved';
  } = {},
): ExportReadiness {
  const snapshot = structuredClone(project),
    profile = options.profile ?? 'inspection-svg';
  const blocking: ValidationIssue[] = [],
    warnings: ValidationIssue[] = [];
  let sourceInputHash =
    project.generationRecord && 'inputHash' in project.generationRecord
      ? project.generationRecord.inputHash
      : 'unverified';
  try {
    sourceInputHash = expectedGenerationSignature(project).inputHash;
  } catch {
    blocking.push(outputIssue('GENERATION_INVALID', [], 'Generation inputs are invalid.'));
  }
  const state = deriveGenerationState(project);
  if (state !== 'ready')
    blocking.push(
      outputIssue(
        `GENERATION_${state.toUpperCase().replace('-', '_')}`,
        [],
        'Current generation is absent, stale, invalid or unverified. Recalculate before cutting.',
      ),
    );
  if (
    project.generationRecord &&
    'signatureVersion' in project.generationRecord &&
    project.generationRecord.signatureVersion === 2
  )
    blocking.push(
      outputIssue(
        'GENERATION_UNVERIFIED',
        [],
        'Legacy generation remains available for inspection. Regenerate before production export.',
      ),
    );
  blocking.push(...(project.generationIssues ?? []).filter((i) => i.severity === 'error'));
  warnings.push(...(project.generationIssues ?? []).filter((i) => i.severity === 'warning'));
  if (project.fabricationMode === 'fold-template' && project.designGraph) {
    if (project.designGraph.source.inputHash !== sourceInputHash)
      blocking.push(
        outputIssue('OUTPUT_GRAPH_MISMATCH', [], 'Template graph belongs to different inputs.'),
      );
    blocking.push(...validateGraph(project.designGraph).filter((i) => i.severity === 'error'));
  }
  if (project.fabricationMode === 'mesh-unfold' && project.unresolvedEdits?.length)
    blocking.push(
      outputIssue(
        'SOURCE_EDITS_UNRESOLVED',
        project.unresolvedEdits.map((e) => e.id),
        'Resolve or explicitly discard unmatched source edits before cutting.',
      ),
    );
  const native = project.fabricationMode === 'mesh-unfold' ? project.papercraft?.result : undefined;
  if (native) {
    try {
      if (native.inputHash !== sourceInputHash)
        blocking.push(
          outputIssue(
            'OUTPUT_GRAPH_MISMATCH',
            [],
            'The cached graph belongs to different generation inputs.',
          ),
        );
      blocking.push(
        ...validateGraph(native.graph).filter((i) => i.severity === 'error'),
        ...validatePapercraftNet(native, native.tabs, native.graph).filter(
          (i) => i.severity === 'error',
        ),
      );
      if (hashSerializable(native.parts) !== hashSerializable(project.generatedParts))
        blocking.push(
          outputIssue(
            'OUTPUT_GRAPH_MISMATCH',
            [],
            'Fabrication parts differ from the validated graph.',
          ),
        );
    } catch {
      blocking.push(outputIssue('OUTPUT_GRAPH_INVALID', [], 'Saved graph cannot be validated.'));
    }
  }
  const canonical = canonicalizeContours(snapshot.generatedParts);
  blocking.push(...canonical.issues);
  const preparedRaw = prepareFabricationOutput({ ...snapshot, generatedParts: canonical.parts }),
    final = canonicalizeContours(preparedRaw.parts);
  blocking.push(...preparedRaw.issues.filter((i) => i.severity === 'error'), ...final.issues);
  warnings.push(
    ...preparedRaw.issues
      .filter((i) => i.severity === 'warning' || i.code === 'KERF_OPEN_PATH_SKIPPED')
      .map((i) => ({ ...i, severity: 'warning' as const })),
  );
  const knownOperations = new Set([
    'cut',
    'score',
    'mountain-fold',
    'valley-fold',
    'perforate',
    'engrave',
    'guide',
  ]);
  if (final.parts.some((part) => part.paths.some((path) => !knownOperations.has(path.operation))))
    blocking.push(
      outputIssue(
        'OUTPUT_OPERATION_LOST',
        [],
        'Unknown operation cannot be written to a manufacturing layer.',
      ),
    );
  const panelIds = new Set(
    [
      ...(project.foldingResult?.panels ?? []),
      ...(project.unfoldingResult?.faces ?? []),
      ...(project.panelConstructionResult?.panels ?? []),
    ].map((p) => p.id),
  );
  const edgeIds = new Set(
    [
      ...(project.foldingResult?.edges ?? []),
      ...(project.fabricationMode === 'fold-template'
        ? (project.designGraph?.connections ?? [])
        : []),
      ...(project.unfoldingResult?.edges ?? []),
      ...(project.panelConstructionResult?.editableEdges ?? []),
    ].map((e) => e.id),
  );
  const tabIds = new Set(
    [
      ...(project.foldingResult?.tabs ?? []),
      ...(project.unfoldingResult?.tabs ?? []),
      ...(project.panelConstructionResult?.tabs ?? []),
    ].map((t) => t.id),
  );
  for (const part of final.parts)
    for (const path of part.paths) {
      if (
        (path.panelId && !panelIds.has(path.panelId)) ||
        (path.edgeId && !edgeIds.has(path.edgeId)) ||
        (path.tabId && !tabIds.has(path.tabId))
      )
        blocking.push(
          outputIssue(
            'OUTPUT_REFERENCE_MISSING',
            [part.id, path.id],
            'Path references a nonexistent source panel, edge or tab.',
          ),
        );
      if (path.slot && !final.parts.some((p) => p.id === path.slot!.pairedPartId))
        blocking.push(
          outputIssue(
            'OUTPUT_REFERENCE_MISSING',
            [part.id, path.slot.pairedPartId],
            'Slot partner is missing.',
          ),
        );
    }
  const styleOperations = new Set(snapshot.exportSettings.operationStyles.map((s) => s.operation));
  if (
    styleOperations.size !== snapshot.exportSettings.operationStyles.length ||
    final.parts.some((p) => p.paths.some((path) => !styleOperations.has(path.operation)))
  )
    blocking.push(
      outputIssue('OUTPUT_OPERATION_LOST', [], 'Every operation needs exactly one output style.'),
    );
  for (const part of canonical.parts)
    for (const path of part.paths) {
      const preparedPart = final.parts.find((p) => p.id === part.id);
      if (
        !preparedPart?.paths.some(
          (p) => p.id === path.id || p.id.startsWith(`${path.id}-perforation-`),
        )
      )
        blocking.push(
          outputIssue(
            'OUTPUT_OPERATION_LOST',
            [part.id, path.id],
            'An input fabrication operation disappeared during preparation.',
          ),
        );
    }
  const settings = fabricationProfiles[profile];
  const preparedParts = final.parts.map((part) => ({
    ...part,
    paths: part.paths.filter((p) => settings.includeGuides || p.operation !== 'guide'),
    labels: settings.includeLabels ? (part.labels ?? []) : [],
  }));
  const effectiveLayouts = structuredClone(
    options.layouts ??
      (options.layoutMode === 'tight'
        ? [deriveTightOutputLayout(preparedParts)]
        : snapshot.sheetLayouts),
  ) as SheetLayout[];
  // Invalid contours remain draft-visible; do not call polygon clipping on malformed loops.
  if (
    !final.issues.some((i) =>
      ['OUTPUT_COORDINATE_INVALID', 'OUTPUT_CONTOUR_INVALID', 'OUTPUT_CONTOURS_OVERLAP'].includes(
        i.code,
      ),
    )
  )
    blocking.push(...intersectPlacedParts(preparedParts, effectiveLayouts));
  const physicalWarning = outputIssue(
    'FABRICATION_NOMINAL',
    [sourceInputHash],
    'Nominal geometry only. Stock fit, score allowance and assembly need a scrap test.',
    'warning',
  );
  warnings.push(physicalWarning);
  for (const part of preparedParts)
    if (part.paths.some((p) => p.operation === 'cut' && !p.closed))
      warnings.push(
        outputIssue(
          'OPEN_CENTRELINE_CUT',
          [part.id, sourceInputHash],
          'Open cuts remain intentional centreline operations; inspect their fabrication intent.',
          'warning',
        ),
      );
  snapshot.generatedParts = preparedParts;
  snapshot.sheetLayouts = effectiveLayouts;
  snapshot.exportSettings = {
    ...snapshot.exportSettings,
    includeLabels: settings.includeLabels && snapshot.exportSettings.includeLabels,
  };
  const uniqueBlocking = [...new Map(blocking.map((i) => [i.id, i])).values()],
    uniqueWarnings = [...new Map(warnings.map((i) => [i.id, i])).values()],
    requiredActions = [
      ...uniqueBlocking.map((i) => ({
        issueId: i.id,
        action: i.suggestedAction ?? 'Correct the highlighted issue.',
      })),
      ...uniqueWarnings
        .filter((i) => !project.acknowledgedWarningIds.includes(i.id))
        .map((i) => ({ issueId: i.id, action: 'Acknowledge this fabrication warning.' })),
    ];
  const unsafe =
    uniqueBlocking.some((i) =>
      [
        'OUTPUT_COORDINATE_INVALID',
        'OUTPUT_PATH_INVALID',
        'OUTPUT_PLACEMENT_INVALID',
        'OUTPUT_OPERATION_LOST',
        'SHEET_DIMENSIONS_INVALID',
      ].includes(i.code),
    ) || !preparedParts.length;
  let snapshotHash = 'invalid';
  try {
    snapshotHash = hashSerializable({
      sourceInputHash,
      parts: preparedParts,
      layouts: effectiveLayouts,
      settings: snapshot.exportSettings,
      profile,
    });
  } catch {
    uniqueBlocking.push(
      outputIssue('OUTPUT_COORDINATE_INVALID', [], 'Prepared output contains nonfinite values.'),
    );
  }
  return freeze({
    sourceInputHash,
    snapshotHash,
    status:
      unsafe || snapshotHash === 'invalid'
        ? 'blocked'
        : uniqueBlocking.length || requiredActions.length
          ? 'draft'
          : 'ready',
    blockingIssues: uniqueBlocking.map((i) => structuredClone(i)),
    warnings: uniqueWarnings.map((i) => structuredClone(i)),
    requiredActions,
    preparedParts,
    effectiveLayouts,
    prepared: {
      parts: preparedParts,
      issues: preparedRaw.issues,
      appliedKerfMm: preparedRaw.appliedKerfMm,
      ...(preparedRaw.appliedKerfByPart
        ? { appliedKerfByPart: preparedRaw.appliedKerfByPart }
        : {}),
    },
    projectSnapshot: snapshot,
    profile,
  });
}
