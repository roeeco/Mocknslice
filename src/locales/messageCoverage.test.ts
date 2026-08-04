import { describe, expect, it } from 'vitest';
import {
  hasRuntimeFailureTranslations,
  RUNTIME_FAILURE_CODES,
  runtimeFailure,
  runtimeFailureMessage,
} from '../domain/runtimeFailure';
import {
  EMITTED_VALIDATION_CODES,
  hasValidationTranslations,
  validationIssueMessage,
} from './validationMessages';

describe('localized diagnostic catalogues', () => {
  it('covers every emitted validation code in English and Hebrew', () => {
    expect(EMITTED_VALIDATION_CODES.every(hasValidationTranslations)).toBe(true);
  });

  it('covers every runtime failure code and never exposes an English exception in Hebrew', () => {
    expect(RUNTIME_FAILURE_CODES.every(hasRuntimeFailureTranslations)).toBe(true);
    const failure = runtimeFailure('IMPORT_FAILED', 'Secret raw English exception text');
    expect(runtimeFailureMessage(failure, 'he')).not.toContain('Secret raw English');
    expect(runtimeFailureMessage(failure, 'he')).toContain('STL');
  });

  it('uses a localized generic Hebrew message for unknown persisted validation codes', () => {
    expect(
      validationIssueMessage(
        {
          id: 'old',
          severity: 'warning',
          code: 'OLD_UNKNOWN_CODE',
          message: 'Raw historical English',
          affectedEntityIds: [],
        },
        'he',
      ),
    ).toBe('אירעה בעיית ייצור (OLD_UNKNOWN_CODE).');
  });
});
