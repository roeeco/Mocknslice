const en = {
  profile: 'Output profile',
  laser: 'Laser SVG',
  assembly: 'Print assembly PDF',
  inspection: 'Inspection SVG',
  draft: 'Export draft SVG',
  draftPdf: 'Export draft PDF',
  production: 'Export cutting SVG',
  all: 'Export all sheets SVG',
  review: 'I reviewed the fabrication warnings',
  blocked: 'Cutting export blocked',
  draftStatus: 'Inspection draft only',
  ready: 'Prepared for cutting after warning review',
  blocking: 'Blocking issues',
  warnings: 'Fabrication warnings',
  multiple:
    'All occupied sheets download as separate SVG files. Your browser may ask to allow multiple downloads.',
  draftNotice: 'Drafts preserve inspectable geometry and are not fabrication-ready.',
  error: 'Could not write this output. The project is retained.',
};
const he: typeof en = {
  profile: 'פרופיל ייצוא',
  laser: 'SVG ללייזר',
  assembly: 'PDF להוראות הרכבה',
  inspection: 'SVG לבדיקה',
  draft: 'ייצוא SVG ראשוני',
  draftPdf: 'ייצוא PDF ראשוני',
  production: 'ייצוא SVG לחיתוך',
  all: 'ייצוא SVG לכל הגיליונות',
  review: 'בדקתי את אזהרות הייצור',
  blocked: 'ייצוא לחיתוך חסום',
  draftStatus: 'פריסה ראשונית לבדיקה בלבד',
  ready: 'מוכן לחיתוך לאחר בדיקת האזהרות',
  blocking: 'בעיות חוסמות',
  warnings: 'אזהרות ייצור',
  multiple: 'כל גיליון מאוכלס יורד כקובץ SVG נפרד. הדפדפן עשוי לבקש אישור להורדות מרובות.',
  draftNotice: 'הטיוטה שומרת גאומטריה לבדיקה ואינה מאושרת לייצור.',
  error: 'לא ניתן לכתוב את הייצוא. הפרויקט נשמר.',
};
export const outputCopy = (locale: 'en' | 'he') => (locale === 'he' ? he : en);

const issueMessagesHe: Record<string, string> = {
  FABRICATION_NOMINAL:
    'זו גאומטריה נומינלית בלבד. יש לבדוק התאמה לחומר, קווי קיפול והרכבה בניסוי בחומר.',
  GENERATION_STALE: 'הפריסה הקודמת אינה תואמת להגדרות הנוכחיות. חשבו מחדש לפני חיתוך.',
  GENERATION_UNVERIFIED: 'הפריסה הקודמת זמינה לבדיקה. נדרש חישוב מחדש לפני ייצוא לחיתוך.',
  GENERATION_LEGACY_UNVERIFIED: 'לא ניתן לאמת את מקור הפריסה הישנה. חשבו מחדש לפני חיתוך.',
  GENERATION_ABSENT: 'טרם נוצרה גאומטריה לחיתוך.',
  GENERATION_INVALID: 'יש לתקן את הגדרות החישוב לפני חיתוך.',
  PART_CONTOUR_UNVERIFIED: 'לחלק אין קו חיתוך חיצוני סגור שנבדק. ייצוא ראשוני לבדיקה עדיין זמין.',
  PART_OUTSIDE_SHEET: 'הגאומטריה המוכנה לחיתוך חורגת מגבולות הגיליון או משוליו לאחר פיצוי קרף.',
  PARTS_OVERLAP: 'שני חלקים לחיתוך חופפים בגיליון.',
  PART_UNPLACED: 'חלק אינו ממוקם בגיליון.',
  PART_PLACED_MULTIPLE_TIMES: 'אותו חלק ממוקם יותר מפעם אחת.',
  PLACEMENT_PART_MISSING: 'מיקום בגיליון מפנה לחלק שאינו קיים.',
  SHEET_DIMENSIONS_INVALID: 'מידות הגיליון והשוליים חייבות להשאיר שטח עבודה חיובי ותקין.',
  OUTPUT_COORDINATE_INVALID: 'קואורדינטות הייצוא אינן תקינות.',
  OUTPUT_PATH_INVALID: 'קו ייצור חייב להכיל לפחות שתי נקודות תקינות.',
  OUTPUT_CONTOUR_INVALID: 'קו החיתוך הסגור מנוון או חותך את עצמו.',
  OUTPUT_CONTOUR_ROLE_INVALID: 'תפקיד קו החיתוך אינו מתאים לסדר החורים והמסגרת.',
  OUTPUT_PIECE_DISCONNECTED: 'יש להפריד מסגרות חיצוניות נפרדות לחלקים פיזיים נפרדים.',
  OUTPUT_CONTOURS_OVERLAP: 'קווי חיתוך סגורים חופפים או נוגעים זה בזה.',
  OUTPUT_DUPLICATE_CUT: 'אותו מקטע חיתוך פיזי מופיע יותר מפעם אחת.',
  OUTPUT_REFERENCE_MISSING: 'קו ייצור מפנה לפאה, קצה, לשונית או חלק שאינם קיימים.',
  OUTPUT_GRAPH_MISMATCH: 'חלקי החיתוך אינם תואמים לגאומטריה שנבדקה.',
  OUTPUT_GRAPH_INVALID: 'לא ניתן לאמת את הגאומטריה השמורה.',
  OUTPUT_PLACEMENT_INVALID: 'הזזה או סיבוב של חלק אינם תקינים.',
  OUTPUT_OPERATION_LOST: 'פעולת ייצור אבדה או שהגדרות השכבות אינן תקינות.',
  KERF_OFFSET_FAILED: 'פיצוי קרף לא יצר קו חיתוך סגור אמין. הקטינו קרף או בדקו את הקו.',
  KERF_EXCEEDS_FEATURE: 'קיים פרט שגודלו קטן מרוחב הקרף שנבחר.',
  KERF_OPEN_PATH_SKIPPED: 'קווי חיתוך פתוחים נשארים על קו האמצע, ללא פיצוי קרף.',
  OPEN_CENTRELINE_CUT: 'יש לבדוק את מטרת קווי החיתוך הפתוחים לפני חיתוך בחומר.',
  PAPERCRAFT_CLOSURE_SUPPRESSED: 'לפי הבחירה שלכם, לחיבור זה אין לשונית הדבקה. יש לבדוק את ההרכבה.',
  PAPERCRAFT_TAB_UNRESOLVED:
    'לא נמצאה לשונית ללא התנגשויות בעומק המתאים לחומר. החליפו צד, פצלו את הפריסה או בטלו במפורש את הסגירה.',
  PAPERCRAFT_FORCED_JOIN_CYCLE: 'החיבורים שנבחרו יוצרים מעגל. פצלו אחד מהקצוות המסומנים.',
  PAPERCRAFT_FORCED_JOIN_COLLISION: 'החיבור שנבחר גורם לחפיפה בין פאות. שנו את האילוץ המסומן.',
  PAPERCRAFT_SOURCE_HASH: 'העריכות מתייחסות למקור אחר. נדרשת בדיקת התאמה ואישור לפני החישוב.',
  PAPERCRAFT_FACE_LIMIT:
    'המקור חורג ממספר המשולשים שנבחר. אשרו פישוט בגבולות הסטייה או ייבאו מודל פשוט יותר.',
};
export function outputIssueMessage(
  issue: { code: string; message: string },
  locale: 'en' | 'he',
): string {
  return locale === 'he'
    ? (issueMessagesHe[issue.code] ??
        (issue.code.startsWith('OUTPUT_') || issue.code.startsWith('PAPERCRAFT_')
          ? 'יש לבדוק ולתקן את היישויות המסומנות לפני חישוב או ייצוא.'
          : issue.message))
    : issue.message;
}
