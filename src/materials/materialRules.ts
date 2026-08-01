import type { MaterialProfile } from '../domain/material';
import type { ValidationIssue } from '../domain/validation';

export function validateMaterialProfile(material: MaterialProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (material.thicknessMm < 0) {
    issues.push({
      id: `material-negative-thickness-${material.id}`,
      severity: 'error',
      code: 'MATERIAL_NEGATIVE_THICKNESS',
      message: 'Material thickness cannot be negative.',
      affectedEntityIds: [material.id],
      suggestedAction: 'Enter a thickness of zero or greater.',
    });
  }

  if (material.category === 'corrugated-cardboard' && !material.fluteDirection) {
    issues.push({
      id: `material-flute-direction-${material.id}`,
      severity: 'warning',
      code: 'MATERIAL_FLUTE_DIRECTION_MISSING',
      message: 'Corrugated cardboard should define a flute direction.',
      affectedEntityIds: [material.id],
      suggestedAction: 'Choose a flute direction before generating folds.',
    });
  }

  return issues;
}
