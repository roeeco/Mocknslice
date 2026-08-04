export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  messageArgs?: Record<string, string | number>;
  affectedEntityIds: string[];
  suggestedAction?: string;
}
