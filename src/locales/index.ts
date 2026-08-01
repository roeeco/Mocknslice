import { copy as englishCopy } from './en';
import { copy as hebrewCopy } from './he';

export type Locale = 'en' | 'he';
export type LocalizedCopy = typeof englishCopy;

export let copy: LocalizedCopy = englishCopy;
let activeLocale: Locale = 'en';

const hebrewPhrases: Record<string, string> = {
  'Project workflow': 'תהליך הפרויקט',
  Sheets: 'גיליונות',
  'This sheet is empty': 'הגיליון הזה ריק',
  'Select an unplaced part or arrange all parts from the layout panel.':
    'בחרו חלק שלא מוקם או סדרו את כל החלקים מלוח הסידור.',
  'Camera presets': 'זוויות מצלמה',
  Isometric: 'איזומטרי',
  Front: 'חזית',
  Side: 'צד',
  Top: 'על',
  'Fit model': 'התאמת המודל',
  Model: 'מודל',
  'Import an STL to preview': 'ייבאו קובץ STL כדי להציג תצוגה מקדימה',
  '10 mm grid': 'רשת 10 מ״מ',
  Setup: 'הגדרות',
  'Import or create': 'ייבוא או יצירה',
  'Choose STL model': 'בחירת מודל STL',
  'Projection check': 'בדיקת ההיטל',
  'Projected model and fitted profile': 'המודל המוטל והפרופיל המותאם',
  Fabrication: 'ייצור',
  'Template size': 'גודל התבנית',
  'Auto-fit to model': 'התאמה אוטומטית למודל',
  'Custom envelope': 'מעטפת מותאמת',
  'Connection method': 'שיטת חיבור',
  'Glue tabs': 'לשוניות הדבקה',
  'Press-fit lips and slits': 'לשוניות לחיצה וחריצים',
  'Slit clearance': 'מרווח חריץ',
  'Across the width': 'לרוחב',
  'Across the depth': 'לעומק',
  'Parametric template': 'תבנית פרמטרית',
  'Mesh unfolding': 'פריסת רשת',
  'Seam strategy': 'אסטרטגיית תפרים',
  'Automatic tree search': 'חיפוש עץ אוטומטי',
  'Manual seam constraints': 'אילוצי תפרים ידניים',
  'Root triangle': 'משולש בסיס',
  'Tab depth (mm)': 'עומק לשונית (מ״מ)',
  'Face limit': 'מגבלת פאות',
  'Search attempts': 'ניסיונות חיפוש',
  'Flat net → reconstructed fold tree': 'פריסה שטוחה ← עץ קיפול משוחזר',
  'Alternate top and bottom': 'לסירוגין מלמעלה ומלמטה',
  'Family A from one side': 'משפחה א׳ מצד אחד',
  'Complementary finger joints': 'מחברי אצבע משלימים',
  'Tabs and through-slots': 'לשוניות וחריצים עוברים',
  'Straight butt joints': 'מחברי קצה ישרים',
  'Longest dimension': 'המידה הארוכה ביותר',
  Inspect: 'בדיקה',
  'Uniform model scale': 'קנה מידה אחיד למודל',
  'Width (X)': 'רוחב (X)',
  'Length / depth (Z)': 'אורך / עומק (Z)',
  'Height (Y)': 'גובה (Y)',
  Width: 'רוחב',
  'Length / depth': 'אורך / עומק',
  Height: 'גובה',
  'All axes scale together so the STL keeps its proportions.':
    'כל הצירים משתנים יחד כדי לשמור על יחסי המודל.',
  'Rotate model 90°': 'סיבוב המודל ב־90°',
  'Centred bounds in millimetres': 'גבולות ממורכזים במילימטרים',
  Minimum: 'מינימום',
  Maximum: 'מקסימום',
  Triangles: 'משולשים',
  'Welded vertices': 'קודקודים מאוחדים',
  'Open edges': 'קצוות פתוחים',
  'Non-manifold edges': 'קצוות לא־יריעתיים',
  'Disconnected shells': 'מעטפות מנותקות',
  'Orientation issues': 'בעיות כיוון',
  'No current fabrication issues.': 'אין כרגע בעיות ייצור.',
  Layout: 'סידור',
  'Active sheet': 'גיליון פעיל',
  Unplaced: 'לא מוקם',
  'Select a part in either viewport to edit its placement.':
    'בחרו חלק באחת התצוגות כדי לערוך את מיקומו.',
  'Vector output': 'פלט וקטורי',
  None: 'ללא',
  Custom: 'מותאם',
  'Custom kerf': 'רוחב חיתוך מותאם',
  'Preserve mountain / valley layers': 'שמירת שכבות קיפול הר / עמק',
  'Combine as score lines': 'איחוד לקווי חריצה',
  'Perforation pattern': 'תבנית ניקוב',
  'Dash length': 'אורך מקטע',
  'Gap length': 'אורך מרווח',
  'Label size': 'גודל תווית',
  'Sheet boundary': 'גבול הגיליון',
  'Material usage estimate': 'הערכת ניצול חומר',
  'Material estimate': 'הערכת חומר',
  'Used sheets': 'גיליונות בשימוש',
  'Part area': 'שטח חלקים',
  'Estimated waste': 'פחת משוער',
  'Cut length': 'אורך חיתוך',
};

export function setCopyLocale(locale: Locale) {
  activeLocale = locale;
  copy = (locale === 'he' ? hebrewCopy : englishCopy) as LocalizedCopy;
}

export function t(english: string) {
  return activeLocale === 'he' ? (hebrewPhrases[english] ?? english) : english;
}

export function materialLabel(id: string, fallback: string) {
  return copy.materialNames[id as keyof typeof copy.materialNames] ?? fallback;
}
