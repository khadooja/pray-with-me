// منطق صفحة النتائج (labs/results.html): ملخّص المحاولات ومقارنة الركعتين وتصدير CSV/JSON.
// بدون DOM وبدون localStorage — تدخل البيانات وتخرج بيانات، عشان نقدر نختبرها ببيانات مُلفَّقة.

// صف لكل موضع في الرحلة، بنفس ترتيبها. successRate تكون null (مو 0) إذا ما فيه محاولات،
// عشان الصفحة تعرض "—" مو "0%" الموهمة.
export function summarizeAttempts(attempts, journeySteps, attemptKeys) {
  return attemptKeys.map((key, i) => {
    const list = Array.isArray(attempts?.[key]) ? attempts[key] : [];
    const n = list.length;
    return {
      key,
      stepId: journeySteps[i]?.id,
      attempts: n,
      firstOk: n ? Boolean(list[0].ok) : null,
      lastOk: n ? Boolean(list[n - 1].ok) : null,
      successRate: n ? list.filter((a) => a.ok).length / n : null,
    };
  });
}

// الخطوات اللي نفحص وضعيتها فعلاً (الخطوات الإرشادية ما تسجّل محاولات أصلاً)
export const CHECKED_STEPS = ["standing", "ruku", "sujood"];

// مقارنة الركعة الأولى بالثانية لكل خطوة محسوبة، بتجميع كل تكرارات الخطوة
// (مثلاً السجود مرتين في كل ركعة) داخل نفس الركعة.
export function compareRakahs(attempts, journeySteps, attemptKeys, rakahs) {
  const result = {};
  for (const stepId of CHECKED_STEPS) {
    const byRakah = {};
    journeySteps.forEach((step, i) => {
      if (step?.id !== stepId) return;
      const rk = rakahs[i];
      const list = Array.isArray(attempts?.[attemptKeys[i]]) ? attempts[attemptKeys[i]] : [];
      const bucket = (byRakah[rk] ??= { attempts: 0, ok: 0 });
      bucket.attempts += list.length;
      bucket.ok += list.filter((a) => a.ok).length;
    });
    result[stepId] = Object.fromEntries(
      Object.entries(byRakah).map(([rk, b]) => [rk, {
        attempts: b.attempts,
        successRate: b.attempts ? b.ok / b.attempts : null,
      }])
    );
  }
  return result;
}

// خلية CSV: نحيطها بعلامتي تنصيص إذا فيها فاصلة أو تنصيص أو سطر جديد (القاعدة المعتادة في CSV)
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// صف لكل محاولة فردية: tester_id, attempt_key, attempt_number, ok, timestamp
export function attemptsToCSV(testerId, attempts, attemptKeys) {
  const rows = ["tester_id,attempt_key,attempt_number,ok,timestamp"];
  for (const key of attemptKeys) {
    const list = Array.isArray(attempts?.[key]) ? attempts[key] : [];
    list.forEach((a, i) => {
      rows.push([csvCell(testerId), csvCell(key), i + 1, a.ok ? 1 : 0, csvCell(a.at)].join(","));
    });
  }
  return rows.join("\r\n");
}

// نسخة JSON كاملة: هوية المختبر وكل المحاولات الخام، كما هي
export function attemptsToJSON(testerId, attempts) {
  return JSON.stringify({ testerId, exportedAt: new Date().toISOString(), attempts }, null, 2);
}
