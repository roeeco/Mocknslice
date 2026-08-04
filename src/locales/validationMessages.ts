import type { Locale } from './index';
import type { ValidationIssue, ValidationSeverity } from '../domain/validation';

export const EMITTED_VALIDATION_CODES = [
  'TEMPLATE_INCOMPATIBLE',
  'NET_OVERLAP',
  'PRESS_FIT_CLEARANCE_TOO_LARGE',
  'PRESS_FIT_RECEIVER_MISSING',
  'TAB_DEPTH_CLAMPED',
  'TAB_OVERLAP',
  'PROFILE_COMPLEXITY_HIGH',
  'PROFILE_FEATURE_TOO_NARROW',
  'PROFILE_OFFSET_FAILED',
  'PROFILE_SIMPLIFIED',
  'PROFILE_ZERO_AREA',
  'FOLD_CONNECTION_BOUNDARY_INVALID',
  'FOLD_CONNECTION_CLOSURE_INVALID',
  'FOLD_CONNECTION_LENGTH_MISMATCH',
  'FOLD_CONNECTION_PANEL_MISSING',
  'PARTS_OVERLAP',
  'PART_CROSSES_MARGIN',
  'PART_OUTSIDE_SHEET',
  'PART_PLACED_MULTIPLE_TIMES',
  'PART_UNPLACED',
  'PLACEMENT_PART_MISSING',
  'SHEET_DIMENSIONS_INVALID',
  'DISCONNECTED_SHELLS',
  'INCONSISTENT_FACE_ORIENTATION',
  'LIKELY_INVERTED_MESH',
  'NON_MANIFOLD_MESH',
  'OPEN_MESH',
  'PHASE_2_INSPECTION_ONLY',
  'ZERO_AREA_TRIANGLES_REMOVED',
  'KERF_EXCEEDS_FEATURE',
  'KERF_OFFSET_FAILED',
  'KERF_OPEN_PATH_SKIPPED',
  'KERF_VALUE_INVALID',
  'LABEL_SIZE_INVALID',
  'OPERATION_STYLE_INVALID',
  'PERFORATION_PATTERN_INVALID',
  'PANEL_BUTT_JOINT_FASTENER_REQUIRED',
  'PANEL_CLEARANCE_TOO_LARGE',
  'PANEL_CLOSED_ASSEMBLY_REVIEW',
  'PANEL_DIMENSION_TOO_SMALL',
  'PANEL_DIVIDER_CLEARANCE_TOO_LARGE',
  'PANEL_DIVIDER_SPACING_TOO_NARROW',
  'PANEL_FINGER_NEAR_KERF_LIMIT',
  'PANEL_FINGER_TOO_NARROW',
  'PANEL_RIGID_JOINT_MATERIAL_REVIEW',
  'PANEL_SETTINGS_INVALID',
  'PANEL_TOO_FEW_FINGERS',
  'AMBIGUOUS_SLICE_GRAPH',
  'COPLANAR_SLICE_TRIANGLES',
  'MULTIPLE_SLICE_ISLANDS',
  'NO_CLOSED_SLICES',
  'OPEN_SLICE_CONTOUR',
  'SLICE_THICKNESS_EXCEEDS_SPACING',
  'OVERLAPPING_WAFFLE_SLOTS',
  'WAFFLE_HOLE_SLOT_ENTRY_REQUIRES_REVIEW',
  'WAFFLE_SLICES_DO_NOT_INTERSECT',
  'WAFFLE_SLOT_OUTSIDE_USABLE_CONTOUR',
  'WAFFLE_SLOT_TOO_CLOSE_TO_EDGE',
  'UNFOLD_CYCLE_SEAMS_ADDED',
  'UNFOLD_FACE_LIMIT',
  'UNFOLD_FLATTEN_FAILED',
  'UNFOLD_MULTIPLE_ISLANDS',
  'UNFOLD_OVERLAP_REMAINS',
  'UNFOLD_REQUIRES_CLOSED_MANIFOLD',
  'UNFOLD_SETTINGS_INVALID',
  'UNFOLD_TAB_OVERLAP',
  'UNFOLD_UNKNOWN_SEAMS_IGNORED',
  'PANEL_UNFOLD_CONSTRAINT_CONFLICT',
  'MATERIAL_FLUTE_DIRECTION_MISSING',
  'MATERIAL_NEGATIVE_THICKNESS',
  'STACKED_SLICING_READY',
] as const;

export type EmittedValidationCode = (typeof EMITTED_VALIDATION_CODES)[number];

const catalogue = {
  TEMPLATE_INCOMPATIBLE: ['Template is incompatible', 'התבנית אינה תואמת'],
  NET_OVERLAP: ['Net parts overlap', 'חלקי הפריסה חופפים'],
  PRESS_FIT_CLEARANCE_TOO_LARGE: [
    'Press-fit clearance is too large',
    'מרווח החיבור בלחיצה גדול מדי',
  ],
  PRESS_FIT_RECEIVER_MISSING: ['Press-fit receiver is missing', 'צד מקבל לחיבור בלחיצה חסר'],
  TAB_DEPTH_CLAMPED: ['Tab depth was limited', 'עומק הלשונית הוגבל'],
  TAB_OVERLAP: ['Tabs overlap', 'הלשוניות חופפות'],
  PROFILE_COMPLEXITY_HIGH: ['Profile complexity is high', 'מורכבות הפרופיל גבוהה'],
  PROFILE_FEATURE_TOO_NARROW: ['Profile feature is too narrow', 'פרט בפרופיל צר מדי'],
  PROFILE_OFFSET_FAILED: ['Profile offset failed', 'הסטת הפרופיל נכשלה'],
  PROFILE_SIMPLIFIED: ['Profile was simplified', 'הפרופיל פושט'],
  PROFILE_ZERO_AREA: ['Profile has no usable area', 'לפרופיל אין שטח שמיש'],
  FOLD_CONNECTION_BOUNDARY_INVALID: [
    'Fold connection boundary is invalid',
    'גבול חיבור הקיפול אינו תקין',
  ],
  FOLD_CONNECTION_CLOSURE_INVALID: ['Fold closure is invalid', 'סגירת הקיפול אינה תקינה'],
  FOLD_CONNECTION_LENGTH_MISMATCH: [
    'Fold connection lengths differ',
    'אורכי חיבור הקיפול אינם תואמים',
  ],
  FOLD_CONNECTION_PANEL_MISSING: ['Fold connection panel is missing', 'לוח בחיבור הקיפול חסר'],
  PARTS_OVERLAP: ['Placed parts overlap', 'חלקים שמוקמו חופפים'],
  PART_CROSSES_MARGIN: ['Part crosses the safe margin', 'חלק חוצה את השוליים הבטוחים'],
  PART_OUTSIDE_SHEET: ['Part is outside the sheet', 'חלק נמצא מחוץ לגיליון'],
  PART_PLACED_MULTIPLE_TIMES: ['Part is placed more than once', 'חלק מוקם יותר מפעם אחת'],
  PART_UNPLACED: ['Part is not placed', 'חלק לא מוקם'],
  PLACEMENT_PART_MISSING: ['Placement refers to a missing part', 'המיקום מפנה לחלק חסר'],
  SHEET_DIMENSIONS_INVALID: ['Sheet dimensions are invalid', 'מידות הגיליון אינן תקינות'],
  DISCONNECTED_SHELLS: ['Mesh contains disconnected shells', 'הרשת כוללת מעטפות מנותקות'],
  INCONSISTENT_FACE_ORIENTATION: ['Face orientation is inconsistent', 'כיוון הפאות אינו עקבי'],
  LIKELY_INVERTED_MESH: ['Mesh may be inverted', 'ייתכן שכיוון הרשת הפוך'],
  NON_MANIFOLD_MESH: ['Mesh is non-manifold', 'הרשת אינה יריעה תקינה'],
  OPEN_MESH: ['Mesh has open edges', 'לרשת יש קצוות פתוחים'],
  PHASE_2_INSPECTION_ONLY: ['Inspection information', 'מידע לבדיקה'],
  ZERO_AREA_TRIANGLES_REMOVED: ['Zero-area triangles were removed', 'משולשים חסרי שטח הוסרו'],
  KERF_EXCEEDS_FEATURE: ['Kerf exceeds a feature size', 'רוחב החיתוך גדול מפרט בגאומטריה'],
  KERF_OFFSET_FAILED: ['Kerf offset failed', 'פיצוי רוחב החיתוך נכשל'],
  KERF_OPEN_PATH_SKIPPED: ['Kerf was skipped on an open path', 'פיצוי רוחב החיתוך דולג בנתיב פתוח'],
  KERF_VALUE_INVALID: ['Kerf value is invalid', 'ערך רוחב החיתוך אינו תקין'],
  LABEL_SIZE_INVALID: ['Label size is invalid', 'גודל התווית אינו תקין'],
  OPERATION_STYLE_INVALID: ['Operation style is invalid', 'סגנון הפעולה אינו תקין'],
  PERFORATION_PATTERN_INVALID: ['Perforation pattern is invalid', 'תבנית הניקוב אינה תקינה'],
  PANEL_BUTT_JOINT_FASTENER_REQUIRED: [
    'Butt joints require fastening',
    'מחברי קצה ישרים דורשים אמצעי חיבור',
  ],
  PANEL_CLEARANCE_TOO_LARGE: ['Panel clearance is too large', 'מרווח הלוחות גדול מדי'],
  PANEL_CLOSED_ASSEMBLY_REVIEW: ['Review the closed assembly', 'יש לבדוק את ההרכבה הסגורה'],
  PANEL_DIMENSION_TOO_SMALL: ['Panel dimension is too small', 'מידת לוח קטנה מדי'],
  PANEL_DIVIDER_CLEARANCE_TOO_LARGE: ['Divider clearance is too large', 'מרווח המחיצה גדול מדי'],
  PANEL_DIVIDER_SPACING_TOO_NARROW: ['Divider spacing is too narrow', 'המרווח בין המחיצות צר מדי'],
  PANEL_FINGER_NEAR_KERF_LIMIT: [
    'Finger width is near the kerf limit',
    'רוחב האצבע קרוב למגבלת החיתוך',
  ],
  PANEL_FINGER_TOO_NARROW: ['Finger width is too narrow', 'רוחב האצבע צר מדי'],
  PANEL_RIGID_JOINT_MATERIAL_REVIEW: [
    'Review rigid joints for this material',
    'יש לבדוק מחברים קשיחים בחומר זה',
  ],
  PANEL_SETTINGS_INVALID: ['Panel settings are invalid', 'הגדרות הלוחות אינן תקינות'],
  PANEL_TOO_FEW_FINGERS: ['Joint has too few fingers', 'במחבר יש מעט מדי אצבעות'],
  AMBIGUOUS_SLICE_GRAPH: ['Slice graph is ambiguous', 'גרף הפריסה אינו חד־משמעי'],
  COPLANAR_SLICE_TRIANGLES: [
    'Slice contains coplanar triangles',
    'הפריסה כוללת משולשים מישוריים משותפים',
  ],
  MULTIPLE_SLICE_ISLANDS: ['Slice contains multiple islands', 'הפריסה כוללת כמה איים'],
  NO_CLOSED_SLICES: ['No closed slices were found', 'לא נמצאו פרוסות סגורות'],
  OPEN_SLICE_CONTOUR: ['Slice contour is open', 'מתאר הפרוסה פתוח'],
  SLICE_THICKNESS_EXCEEDS_SPACING: [
    'Part thickness exceeds slice spacing',
    'עובי החלק גדול מהמרווח בין הפרוסות',
  ],
  OVERLAPPING_WAFFLE_SLOTS: ['Interlocking slots overlap', 'חריצי השילוב חופפים'],
  WAFFLE_HOLE_SLOT_ENTRY_REQUIRES_REVIEW: [
    'Review slot entry through a hole',
    'יש לבדוק כניסת חריץ דרך חור',
  ],
  WAFFLE_SLICES_DO_NOT_INTERSECT: [
    'Slice families do not intersect',
    'משפחות הפרוסות אינן מצטלבות',
  ],
  WAFFLE_SLOT_OUTSIDE_USABLE_CONTOUR: [
    'Slot is outside the usable contour',
    'החריץ מחוץ למתאר השמיש',
  ],
  WAFFLE_SLOT_TOO_CLOSE_TO_EDGE: ['Slot is too close to an edge', 'החריץ קרוב מדי לקצה'],
  UNFOLD_CYCLE_SEAMS_ADDED: ['Extra seams were added', 'נוספו תפרים כדי להסיר מחזור'],
  UNFOLD_FACE_LIMIT: ['Mesh exceeds the unfolding face limit', 'הרשת חורגת ממגבלת הפאות לפריסה'],
  UNFOLD_FLATTEN_FAILED: ['A face could not be flattened', 'לא ניתן לפרוס פאה'],
  UNFOLD_MULTIPLE_ISLANDS: ['Unfolding produced multiple islands', 'הפריסה יצרה כמה איים'],
  UNFOLD_OVERLAP_REMAINS: ['Overlap remains in the unfolded net', 'נותרה חפיפה בפריסה'],
  UNFOLD_REQUIRES_CLOSED_MANIFOLD: [
    'Unfolding requires a closed manifold mesh',
    'הפריסה דורשת רשת סגורה ותקינה',
  ],
  UNFOLD_SETTINGS_INVALID: ['Unfolding settings are invalid', 'הגדרות הפריסה אינן תקינות'],
  UNFOLD_TAB_OVERLAP: ['Unfolding tabs overlap', 'לשוניות הפריסה חופפות'],
  UNFOLD_UNKNOWN_SEAMS_IGNORED: ['Unknown seams were ignored', 'תפרים לא מוכרים הושמטו'],
  PANEL_UNFOLD_CONSTRAINT_CONFLICT: [
    'Panel unfolding constraints conflict',
    'אילוצי פריסת הלוחות מתנגשים',
  ],
  MATERIAL_FLUTE_DIRECTION_MISSING: [
    'Material flute direction is missing',
    'כיוון הגלים בחומר חסר',
  ],
  MATERIAL_NEGATIVE_THICKNESS: ['Material thickness is invalid', 'עובי החומר אינו תקין'],
  STACKED_SLICING_READY: ['Stacked slicing is ready', 'הפריסה המוערמת מוכנה'],
} as const satisfies Record<EmittedValidationCode, readonly [string, string]>;

function interpolate(message: string, args?: Record<string, string | number>): string {
  if (!args) return message;
  return message.replace(/\{(\w+)\}/g, (match, key: string) => String(args[key] ?? match));
}

export function validationIssueMessage(issue: ValidationIssue, locale: Locale): string {
  const entry = catalogue[issue.code as EmittedValidationCode];
  if (locale === 'en')
    return interpolate(issue.message || entry?.[0] || issue.code, issue.messageArgs);
  return interpolate(entry?.[1] ?? `אירעה בעיית ייצור (${issue.code}).`, issue.messageArgs);
}

const severityLabels: Record<ValidationSeverity, Record<Locale, string>> = {
  info: { en: 'Info', he: 'מידע' },
  warning: { en: 'Warning', he: 'אזהרה' },
  error: { en: 'Error', he: 'שגיאה' },
};

export function validationSeverityLabel(severity: ValidationSeverity, locale: Locale): string {
  return severityLabels[severity][locale];
}

export function validationSuggestedAction(
  issue: ValidationIssue,
  locale: Locale,
): string | undefined {
  if (!issue.suggestedAction) return undefined;
  if (locale === 'en') return issue.suggestedAction;
  return issue.severity === 'error'
    ? 'יש לתקן את ההגדרות או את גאומטריית המקור וליצור מחדש.'
    : 'מומלץ לבדוק את התוצאה לפני הייצוא.';
}

export function hasValidationTranslations(code: EmittedValidationCode): boolean {
  return Boolean(catalogue[code]?.[0] && catalogue[code]?.[1]);
}
