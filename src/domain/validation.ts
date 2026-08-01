export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  affectedEntityIds: string[];
  suggestedAction?: string;
}
