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
  Output: 'פלט',
  'Material profile': 'פרופיל חומר',
  'Applied kerf': 'רוחב חיתוך מיושם',
  colour: 'צבע',
  width: 'רוחב',
  Cut: 'חיתוך',
  Score: 'חריצה',
  'Mountain fold': 'קיפול הר',
  'Valley fold': 'קיפול עמק',
  Perforate: 'ניקוב',
  Engrave: 'חריטה',
  Guide: 'עזר',
  'Contour tolerance': 'סבילות מתאר',
  'Slot width': 'רוחב חריץ',
  'Automatic unfolding': 'פריסה אוטומטית',
  'Mesh edges and manual seams': 'קצוות רשת ותפרים ידניים',
  'Manual seams are forced cuts; extra cuts are added when needed to remove fold cycles.':
    'תפרים ידניים נכפים כחיתוכים; חיתוכים נוספים מתווספים לפי הצורך להסרת מחזורי קיפול.',
  'Polygon sides': 'מספר צלעות',
  sides: 'צלעות',
  'Glue tab depth': 'עומק לשונית הדבקה',
  'Press-fit lip depth': 'עומק לשונית לחיצה',
  'Lid wall depth': 'עומק דופן המכסה',
  'Lid clearance': 'מרווח המכסה',
  'Closure flap': 'דש סגירה',
  'Profile rotation': 'סיבוב פרופיל',
  'Top scale (0 = pyramid)': 'קנה מידה עליון (0 = פירמידה)',
  'Seam tab depth': 'עומק לשונית תפר',
  'Fit clearance': 'מרווח התאמה',
  'Profile tolerance': 'סבילות פרופיל',
  'A fitted rectangular base with four walls.': 'בסיס מלבני מותאם עם ארבע דפנות.',
  'A fitted open box plus a separate lid.': 'קופסה פתוחה מותאמת ומכסה נפרד.',
  'A shallow fitted rectangular tray.': 'מגש מלבני רדוד ומותאם.',
  'Four-sided end sections joined by a wrapping band.': 'חתכי קצה מרובעים המחוברים ברצועה עוטפת.',
  'Paired rectangular faces with a depth gusset.': 'פאות מלבניות זוגיות עם קפל עומק.',
  'A configurable regular polygon with a chosen extrusion length.':
    'מצולע משוכלל ניתן להגדרה עם אורך שיחול נבחר.',
  'Rectangular ends connected by tapered side panels.': 'קצוות מלבניים המחוברים בלוחות צד מתחדדים.',
  'Millimetres (mm)': 'מילימטרים (מ״מ)',
  'Centimetres (cm)': 'סנטימטרים (ס״מ)',
  'Metres (m)': 'מטרים (מ׳)',
  'Inches (in)': 'אינצ׳ים (in)',
  'Choose STL file': 'בחירת קובץ STL',
  Cancel: 'ביטול',
  'Reading and inspecting geometry…': 'קורא ובודק את הגאומטריה…',
  'STL imported and inspected.': 'קובץ ה־STL יובא ונבדק.',
  'Import cancelled.': 'הייבוא בוטל.',
  'Choose a MocknSlice project file': 'בחירת קובץ פרויקט MocknSlice',
  'Alternating fingers meet along every enclosure edge.':
    'אצבעות לסירוגין נפגשות לאורך כל קצה של המארז.',
  'One panel receives material-thickness tabs; its mate receives closed slot cuts.':
    'לוח אחד מקבל לשוניות בעובי החומר, והלוח שמולו מקבל חריצים סגורים.',
  'Straight panels rely on adhesive, tape, or separate fasteners.':
    'לוחות ישרים נשענים על דבק, סרט הדבקה או מחברים נפרדים.',
  'Export is disabled because generation is': 'הייצוא מושבת משום שמצב היצירה הוא',
  'Create a parametric folding form directly from its finished dimensions.':
    'יצירת צורת קיפול פרמטרית ישירות מהמידות הסופיות שלה.',
  'Two perpendicular slice families receive complementary half-depth slots.':
    'שתי משפחות פרוסות ניצבות מקבלות חריצים משלימים בחצי העומק.',
  'Flatten a closed, consistently oriented triangular mesh into editable seam islands. This bounded release does not repair meshes or guarantee an overlap-free net.':
    'פריסת רשת משולשים סגורה ובעלת כיוון עקבי לאיי תפרים הניתנים לעריכה. גרסה תחומה זו אינה מתקנת רשתות ואינה מבטיחה פריסה ללא חפיפות.',
  'Preparation is applied only to exported and previewed paths. Generated source geometry stays unchanged.':
    'הכנת הפלט חלה רק על נתיבים מיוצאים ובתצוגה המקדימה. גאומטריית המקור שנוצרה נשארת ללא שינוי.',
  'Area is exact for closed contours and estimated from folding panels where applicable.':
    'השטח מדויק למתארים סגורים ומוערך מלוחות קיפול לפי הצורך.',
  'STL files do not store reliable units. MocknSlice records this choice and converts to mm.':
    'קובצי STL אינם שומרים יחידות אמינות. MocknSlice שומרת בחירה זו וממירה למ״מ.',
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
