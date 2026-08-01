import type { ModelHealthReport, ModelImportSettings } from '../../domain/model';
import type { ValidationIssue } from '../../domain/validation';

export function createMeshValidationIssues(
  report: ModelHealthReport,
  settings: ModelImportSettings,
  modelId: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    {
      id: 'phase-2-slicing-unavailable',
      severity: 'info',
      code: 'PHASE_2_INSPECTION_ONLY',
      message: 'The model is ready for inspection; slice generation begins in Phase 3.',
      affectedEntityIds: [modelId],
    },
  ];

  if (settings.removedZeroAreaTriangleCount > 0) {
    issues.push({
      id: `mesh-zero-area-${modelId}`,
      severity: 'info',
      code: 'ZERO_AREA_TRIANGLES_REMOVED',
      message: `${settings.removedZeroAreaTriangleCount} zero-area triangle(s) were removed during import.`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Compare the model with the source if removed faces were unexpected.',
    });
  }
  if (report.openEdgeCount > 0) {
    issues.push({
      id: `mesh-open-edges-${modelId}`,
      severity: 'warning',
      code: 'OPEN_MESH',
      message: `The model has ${report.openEdgeCount} open edge(s).`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Repair or close the source mesh before relying on fabrication output.',
    });
  }
  if (report.nonManifoldEdgeCount > 0) {
    issues.push({
      id: `mesh-non-manifold-${modelId}`,
      severity: 'warning',
      code: 'NON_MANIFOLD_MESH',
      message: `The model has ${report.nonManifoldEdgeCount} non-manifold edge(s).`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Repair edges shared by more than two faces.',
    });
  }
  if (report.disconnectedShellCount > 1) {
    issues.push({
      id: `mesh-shells-${modelId}`,
      severity: 'warning',
      code: 'DISCONNECTED_SHELLS',
      message: `The model contains ${report.disconnectedShellCount} disconnected shells.`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Confirm that every shell is intentional.',
    });
  }
  if (report.orientationIssueCount > 0) {
    issues.push({
      id: `mesh-orientation-${modelId}`,
      severity: 'warning',
      code: 'INCONSISTENT_FACE_ORIENTATION',
      message: `${report.orientationIssueCount} shared edge(s) have inconsistent face orientation.`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Recalculate face normals in the source model.',
    });
  }
  if (report.likelyInverted) {
    issues.push({
      id: `mesh-inverted-${modelId}`,
      severity: 'warning',
      code: 'LIKELY_INVERTED_MESH',
      message: 'The closed mesh appears to have inward-facing triangles.',
      affectedEntityIds: [modelId],
      suggestedAction: 'Reverse the source mesh face orientation.',
    });
  }
  return issues;
}
