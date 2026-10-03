// الترجمة: كل النصوص اللي يشوفها المستخدم موجودة في ملفات JSON هنا، مو داخل الكود.
// لإضافة لغة جديدة (مثلاً العربية):
//   1) أنشئ ملف ar.json بنفس المفاتيح الموجودة في en.json
//   2) استورده هنا وأضفه إلى dictionaries
//   3) استدعِ setLang("ar")
import en from "./en.json" with { type: "json" };

const dictionaries = { en };
const FALLBACK = "en";
let currentLang = FALLBACK;

export function setLang(lang) {
  if (dictionaries[lang]) currentLang = lang;
}

export function getLang() {
  return currentLang;
}

// هل المفتاح موجود؟ نستخدمها للنصوص الاختيارية (مثل شرح كل خطوة explain_*):
// إذا ما كان موجود نخفي السطر بدل ما نطبع اسم المفتاح للمستخدم.
export function has(key) {
  return key in dictionaries[FALLBACK] || key in (dictionaries[currentLang] ?? {});
}

// t("knees_bent") → النص المناسب. إذا المفتاح ناقص نرجع للإنجليزي، ثم للمفتاح نفسه.
// المتغيرات: t("step_of", { x: 1, n: 5 }) تبدّل {x} و {n} داخل النص.
export function t(key, vars) {
  let text = dictionaries[currentLang]?.[key] ?? dictionaries[FALLBACK][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
}
