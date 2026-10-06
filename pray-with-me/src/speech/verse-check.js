// فحص الفاتحة **آية آية** بدل التلاوة كاملة.
//
// ⚠️ هذا ملف **جديد** ولا يعدّل align.js ولا asr.worker.js إطلاقاً: ينادي
// compareRecitation كما هي (نفس ترتيب matchers.js).
//
// ليش آية آية: النموذج يقسّم ويدمج الكلمات، فمقارنة ٢٥ كلمة مرة واحدة تخلّي أي دمج
// على حدود آية يفسد بقية المقارنة. الآية الواحدة من ٢ إلى ٩ كلمات، فالخطأ ما يتسلسل،
// ونقدر نقول للمستخدم أي آية يعيدها بالضبط.
//
// النصوص: نستخدم step.verses[i].arabic كما هي من fajr.json (بدون تشكيل أصلاً)،
// ومجموعها بعد التطبيع = النص المرجعي reference حرفاً بحرف (الاختبار يتأكد).
// البسملة والتأمين في step.sunnahVerses — مصفوفة منفصلة ما تُمرَّر هنا أبداً، فهي
// **ما تُفحص** بحكم البناء مو بحكم فلترة.
import { compareRecitation, normalizeArabic } from "./align.js";

// حالات الآية الواحدة
export const COMPLETE = "complete";
export const INCOMPLETE = "incomplete";
export const SKIPPED = "skipped";
// قرأ أكثر من الآية المعروضة (مثلاً السورة كاملة في شاشة آية وحدة وأسقط آية ثانية):
// كلمات الآية موجودة، لكن ما نقدر نقول "صحيح" لأن الفحص يشوف هذي الآية بس.
export const TOO_LONG = "too_long";

// كم كلمة زيادة نسمح فيها قبل ما نقول "قرأت أكثر من الآية":
// النموذج أحياناً يقسّم كلمة لكلمتين، أو المستخدم يزيد كلمة. أكثر من كذا = قرأ آية ثانية.
// البسملة والتأمين (sunnahVerses) ما تنحسب زيادة أبداً: مكانها قبل وبعد الفاتحة.
export const EXTRA_WORDS_ALLOWED = 2;

const words = (text) => {
  const n = normalizeArabic(text);
  return n ? n.split(" ") : [];
};

// يشيل البسملة والتأمين (مرة وحدة لكل واحدة) من النص المسموع قبل ما نعدّ الكلمات الزيادة.
function withoutSunnah(transcript, sunnahPhrases) {
  let hyp = words(transcript);
  for (const phrase of sunnahPhrases) {
    const p = words(phrase);
    if (!p.length) continue;
    const at = hyp.findIndex((_, i) => p.every((w, k) => hyp[i + k] === w));
    if (at !== -1) hyp = [...hyp.slice(0, at), ...hyp.slice(at + p.length)];
  }
  return hyp;
}

// الآيات اللي تُفحص: آيات السورة فقط (بدون السنن)
export function checkableVerses(step) {
  return Array.isArray(step?.verses) ? step.verses : [];
}

// يفحص آية واحدة: نفس عقد compareRecitation، ومعه رقم الآية وحالتها وعدد الكلمات الزيادة.
// sunnahPhrases: نصوص البسملة والتأمين (من step.sunnahVerses)، ما تنحسب زيادة.
export function checkVerse(transcript, verse, index = 0, sunnahPhrases = []) {
  const result = compareRecitation(transcript, verse?.arabic ?? "");
  const extra = Math.max(0, withoutSunnah(transcript, sunnahPhrases).length - result.matched);
  const status = !result.complete ? INCOMPLETE : extra > EXTRA_WORDS_ALLOWED ? TOO_LONG : COMPLETE;
  return { index, status, extra, ...result };
}

// نتيجة الخطوة كاملة من نتائج الآيات.
// allComplete = كل آية انتهت complete. الآية المتخطّاة (skipped) لا تُحسب ناجحة أبداً.
export function aggregate(results, total) {
  const n = Number.isFinite(total) ? total : results.length;
  const byVerse = Array.from({ length: n }, (_, i) => results[i] ?? null);
  return {
    finished: byVerse.every((r) => r !== null),
    allComplete: n > 0 && byVerse.every((r) => r?.status === COMPLETE),
    byVerse,
  };
}
