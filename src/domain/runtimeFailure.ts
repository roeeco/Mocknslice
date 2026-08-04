import type { Locale } from '../locales';

export const RUNTIME_FAILURE_CODES = [
  'MODEL_MESH_MISSING',
  'WAFFLE_AXES_MATCH',
  'GENERATION_INPUT_CHANGED',
  'SLICE_GENERATION_FAILED',
  'WAFFLE_GENERATION_FAILED',
  'FOLD_GENERATION_FAILED',
  'UNFOLD_GENERATION_FAILED',
  'PANEL_GENERATION_FAILED',
  'GENERATION_CANCELLED',
  'IMPORT_FILE_TYPE_INVALID',
  'IMPORT_FAILED',
  'IMPORT_CANCELLED',
  'PROJECT_IMPORT_FAILED',
] as const;

export type RuntimeFailureCode = (typeof RUNTIME_FAILURE_CODES)[number];

export interface RuntimeFailure {
  code: RuntimeFailureCode;
  fallback: string;
  args?: Record<string, string | number>;
}

const messages: Record<RuntimeFailureCode, Record<Locale, string>> = {
  MODEL_MESH_MISSING: {
    en: 'The model does not contain the geometry required for this operation.',
    he: 'המודל אינו מכיל את הגאומטריה הנדרשת לפעולה זו.',
  },
  WAFFLE_AXES_MATCH: {
    en: 'Choose two different axes for the interlocking slice families.',
    he: 'יש לבחור שני צירים שונים למשפחות הפרוסות המשתלבות.',
  },
  GENERATION_INPUT_CHANGED: {
    en: 'The source or settings changed during generation. Generate again.',
    he: 'המקור או ההגדרות השתנו בזמן היצירה. יש ליצור מחדש.',
  },
  SLICE_GENERATION_FAILED: {
    en: 'Slice generation failed.',
    he: 'יצירת הפרוסות נכשלה.',
  },
  WAFFLE_GENERATION_FAILED: {
    en: 'Interlocking-slice generation failed.',
    he: 'יצירת הפרוסות המשתלבות נכשלה.',
  },
  FOLD_GENERATION_FAILED: {
    en: 'Folding-template generation failed.',
    he: 'יצירת תבנית הקיפול נכשלה.',
  },
  UNFOLD_GENERATION_FAILED: {
    en: 'Mesh unfolding failed.',
    he: 'פריסת הרשת נכשלה.',
  },
  PANEL_GENERATION_FAILED: {
    en: 'Panel generation failed.',
    he: 'יצירת הלוחות נכשלה.',
  },
  GENERATION_CANCELLED: {
    en: 'Generation was cancelled.',
    he: 'היצירה בוטלה.',
  },
  IMPORT_FILE_TYPE_INVALID: {
    en: 'Choose an STL file with the .stl extension.',
    he: 'יש לבחור קובץ STL עם הסיומת ‎.stl.',
  },
  IMPORT_FAILED: {
    en: 'The STL file could not be imported.',
    he: 'לא ניתן לייבא את קובץ ה־STL.',
  },
  IMPORT_CANCELLED: {
    en: 'STL import was cancelled.',
    he: 'ייבוא ה־STL בוטל.',
  },
  PROJECT_IMPORT_FAILED: {
    en: 'The project file could not be imported.',
    he: 'לא ניתן לייבא את קובץ הפרויקט.',
  },
};

export function runtimeFailure(
  code: RuntimeFailureCode,
  fallback = messages[code].en,
  args?: Record<string, string | number>,
): RuntimeFailure {
  return { code, fallback, ...(args ? { args } : {}) };
}

export function runtimeFailureMessage(failure: RuntimeFailure, locale: Locale): string {
  const localized = messages[failure.code]?.[locale];
  if (localized) {
    return localized.replace(/\{(\w+)\}/g, (match, key: string) =>
      String(failure.args?.[key] ?? match),
    );
  }
  return locale === 'he' ? `אירעה שגיאה (${failure.code}).` : failure.fallback;
}

export function hasRuntimeFailureTranslations(code: RuntimeFailureCode): boolean {
  return Boolean(messages[code]?.en && messages[code]?.he);
}
