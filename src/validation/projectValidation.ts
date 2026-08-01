import type { ProjectData } from '../domain/project';
import type { ValidationIssue } from '../domain/validation';
import { createMeshValidationIssues } from '../geometry/mesh/createMeshValidationIssues';

export function foundationValidationIssues(): ValidationIssue[] {
  return [
    {
      id: 'foundation-slicing-unavailable',
      severity: 'info',
      code: 'PHASE_2_STL_INSPECTION',
      message: 'Import an STL to inspect it; slice generation begins in Phase 3.',
      affectedEntityIds: [],
      suggestedAction: 'Inspect the example cube or import an STL model.',
    },
  ];
}

export function validationIssuesForProject(project: ProjectData): ValidationIssue[] {
  const { model } = project;
  if (model.healthReport && model.importSettings) {
    return createMeshValidationIssues(model.healthReport, model.importSettings, model.id);
  }
  return foundationValidationIssues();
}
