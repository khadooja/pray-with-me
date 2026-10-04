// "خطوات تحتاج تدريب": نختار من سجل المحاولات الخطوات اللي تعبت فيها.
// دالة صافية بدون DOM ولا localStorage، عشان نقدر نختبرها في Node.
//
// المحاولات مسجّلة بالموضع (ruku#1 و sujood#3 ...)، فنقدر نفرّق بين الركعة الأولى والثانية.
// الخطوات الإرشادية (guided) ما تسجّل محاولات أصلاً، فما تطلع هنا أبداً.

// هل هذا الموضع يحتاج تدريب؟ نعم إذا جُرّب و(ما نجح أبداً، أو احتاج أكثر من محاولة).
function needsPractice(tries) {
  if (!tries.length) return false; // ما جرّبها: ما عندنا شيء نقوله عنها
  return !tries.some((a) => a.ok) || tries.length > 1;
}

// الترتيب:
//   1) اللي ما نجح فيها أبداً أول
//   2) ثم الأكثر محاولات
//   3) ثم الأسبق في ترتيب الصلاة — وهذا اللي يخلي النتيجة ثابتة عند التساوي
// since: وقت بداية الجولة الحالية (ISO). نحسب المحاولات اللي بعده فقط، عشان المراجعة
// تتكلم عن صلاة اليوم مو عن أخطاء جولة قديمة. السجل المخزّن ما نمسحه ولا نغيّره:
// هذا ترشيح للعرض فقط، وصفحة النتائج تقدر تشوف التاريخ كامل.
export function reviewSteps(attempts, journeySteps, attemptKeys, limit = 3, since = null) {
  const inThisRun = (a) => !since || (typeof a?.at === "string" && a.at > since);
  const rows = [];
  attemptKeys.forEach((key, index) => {
    const all = Array.isArray(attempts?.[key]) ? attempts[key] : [];
    const tries = all.filter(inThisRun);
    if (!needsPractice(tries)) return;
    rows.push({
      key,
      index,
      step: journeySteps[index],
      tries: tries.length,
      succeeded: tries.some((a) => a.ok),
    });
  });

  rows.sort((a, b) => {
    if (a.succeeded !== b.succeeded) return a.succeeded ? 1 : -1; // الفاشلة أول
    if (a.tries !== b.tries) return b.tries - a.tries; // الأكثر محاولات أول
    return a.index - b.index; // وأخيراً ترتيب الصلاة: نتيجة ثابتة دايماً
  });

  return rows.slice(0, limit);
}

// الموضع كم من كم لنفس الخطوة (مثلاً الركوع الثاني من اثنين)، للعرض فقط.
export function occurrenceOf(key, attemptKeys) {
  const id = key.split("#")[0];
  const sameStep = attemptKeys.filter((k) => k.startsWith(`${id}#`));
  return { index: Number(key.split("#")[1]), total: sameStep.length };
}
