// كل ما يُشتقّ من ترتيب رحلة الصلاة ("order" في fajr.json).
// ملف مستقل بدون DOM، عشان نقدر نختبره في Node.
//
// الفكرة: كل خطوة مُعرَّفة **مرة واحدة** في "steps"، و"order" يذكرها بقدر ما تتكرر
// في الصلاة. فالركعة الثانية تعيد استخدام نفس النص المُراجَع شرعياً، بدون نسخ.

// يحوّل "order" إلى قائمة خطوات فعلية. الخطوة المكررة ترجع **نفس الكائن** في كل مرة.
// إذا كان "order" ناقصاً (فرع محتوى قديم) نرجع لترتيب التعريفات نفسه.
export function resolveJourney(fajr, warn = console.warn) {
  const byId = Object.fromEntries(fajr.steps.map((s) => [s.id, s]));
  const ids = fajr.order ?? fajr.steps.map((s) => s.id);
  return ids
    .map((id) => {
      const step = byId[id];
      if (!step) warn(`[content] fajr.json "order" names a step that does not exist: "${id}"`);
      return step;
    })
    .filter(Boolean);
}

// نفس الخطوة تتكرر في الرحلة (السجود ٤ مرات، والركوع مرتين...)، وتعريفها واحد.
// عشان نقدر نفرّق في التقييم بين سجدة وسجدة، نسجّل المحاولات بالموضع:
// sujood#1 و sujood#2 و sujood#3 و sujood#4. المفتاح يبدأ باسم الخطوة دايماً،
// فنقدر نجمّع حسب الخطوة أو نقارن الركعة الأولى بالثانية.
export function journeyAttemptKeys(journeySteps) {
  const seen = {};
  return journeySteps.map((s) => {
    seen[s.id] = (seen[s.id] ?? 0) + 1;
    return `${s.id}#${seen[s.id]}`;
  });
}

// الخطوة اللي بعدها تبدأ الركعة الثانية (خطوة "القيام للركعة الثانية" نفسها
// تُحسب على الركعة الأولى، لأنها نهايتها وليست بدايتها).
const RAKAH_BREAK = "second_rakah";

// رقم الركعة لكل خطوة في الرحلة: [1,1,...,1,2,2,...]
export function journeyRakahs(journeySteps) {
  let rakah = 1;
  return journeySteps.map((s) => {
    const current = rakah;
    if (s.id === RAKAH_BREAK) rakah += 1; // التبديل يصير **بعد** هذي الخطوة
    return current;
  });
}

// كم ركعة في الرحلة كاملة
export function rakahCount(journeySteps) {
  const all = journeyRakahs(journeySteps);
  return all.length ? Math.max(...all) : 1;
}
