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
import { compareRecitation } from "./align.js";

// حالات الآية الواحدة
export const COMPLETE = "complete";
export const INCOMPLETE = "incomplete";
export const SKIPPED = "skipped";

// الآيات اللي تُفحص: آيات السورة فقط (بدون السنن)
export function checkableVerses(step) {
  return Array.isArray(step?.verses) ? step.verses : [];
}

// يفحص آية واحدة: نفس عقد compareRecitation، ومعه رقم الآية وحالتها.
export function checkVerse(transcript, verse, index = 0) {
  const result = compareRecitation(transcript, verse?.arabic ?? "");
  return {
    index,
    status: result.complete ? COMPLETE : INCOMPLETE,
    ...result,
  };
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
