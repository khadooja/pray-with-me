// ثلاث طرق لمطابقة التلاوة بالمرجع، لمقارنتها ببعض في التقييم.
// كلها بنفس التوقيع ونفس شكل الإرجاع مثل compareRecitation:
//   match(transcript, reference) -> { complete, missing, orderOk, matched, total }
//
// ⚠️ هذا ملف **جديد** ولا يعدّل align.js إطلاقاً: المطابق الأول يستورد compareRecitation
// ويناديها كما هي. التطبيق لسه يستخدم compareRecitation، وتبديله قرار رهف (سطر واحد).
//
// ليش نحتاج طرق ثانية؟ لأن النموذج يقسّم ويدمج الكلمات:
//   اهدنا الصراط -> اهد نصراط    |    انعمت -> ان امت    |    ولا الضالين -> ولبالين
// فالمطابقة كلمة بكلمة تقول "ناقصة" وهي مقروءة فعلاً.
import { compareRecitation, normalizeArabic, levenshtein } from "./align.js";

// ---------------------------------------------------------------------------
// أدوات مشتركة
// ---------------------------------------------------------------------------

// الكلمات بعد التنظيف، مع الاحتفاظ بالإملاء الأصلي للمرجع (نرجّعه في missing)
function words(text) {
  const norm = normalizeArabic(text);
  return norm ? norm.split(" ") : [];
}

// سماحية الخطأ حسب طول الكلمة. الكلمة الطويلة تتحمّل أخطاء أكثر من القصيرة.
// الأرقام مضبوطة على حالات eval/speech-fixtures.json، وهي عيّنة صغيرة:
// راجعيها كل ما أضفتي تسجيلات حقيقية جديدة.
const SHORT_WORD = 3; // ثلاثة أحرف أو أقل: لازم تطابق تام
export function tolerance(len) {
  if (len <= SHORT_WORD) return 0;
  if (len <= 5) return 1;
  return Math.round(len * 0.4);
}

const near = (a, b) => a === b || levenshtein(a, b) <= tolerance(Math.max(a.length, b.length));

// ---------------------------------------------------------------------------
// (أ) المطابق الحالي: كلمة بكلمة — من align.js بدون أي تعديل
// ---------------------------------------------------------------------------
export function matchWord(transcript, reference) {
  return compareRecitation(transcript, reference);
}

// ---------------------------------------------------------------------------
// (ب) كلمة مع دمج/تقسيم:
//     كلمة مرجع واحدة = كلمتين متتاليتين من النص ملصوقتين، أو العكس.
// ---------------------------------------------------------------------------
export function matchWordMerge(transcript, reference) {
  const ref = words(reference);
  const refOriginal = String(reference).trim().split(/\s+/);
  const hyp = words(transcript);
  const n = ref.length, m = hyp.length;

  // أطول مسار مطابقة: نسمح 1:1 و 1:2 و 2:1
  const best = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      let v = Math.max(best[i + 1][j], best[i][j + 1]);
      if (near(ref[i], hyp[j])) v = Math.max(v, best[i + 1][j + 1] + 1);
      // كلمة مرجع واحدة = كلمتان من النص
      if (j + 1 < m && near(ref[i], hyp[j] + hyp[j + 1])) v = Math.max(v, best[i + 1][j + 2] + 1);
      // كلمتا مرجع = كلمة واحدة من النص (الاثنتان تُحسبان موجودتين)
      if (i + 1 < n && near(ref[i] + ref[i + 1], hyp[j])) v = Math.max(v, best[i + 2][j + 1] + 2);
      best[i][j] = v;
    }
  }

  const found = new Set();
  const usedHyp = new Set();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (near(ref[i], hyp[j]) && best[i][j] === best[i + 1][j + 1] + 1) {
      found.add(i); usedHyp.add(j); i++; j++;
    } else if (j + 1 < m && near(ref[i], hyp[j] + hyp[j + 1]) && best[i][j] === best[i + 1][j + 2] + 1) {
      found.add(i); usedHyp.add(j); usedHyp.add(j + 1); i++; j += 2;
    } else if (i + 1 < n && near(ref[i] + ref[i + 1], hyp[j]) && best[i][j] === best[i + 2][j + 1] + 2) {
      found.add(i); found.add(i + 1); usedHyp.add(j); i += 2; j++;
    } else if (best[i + 1][j] >= best[i][j + 1]) i++;
    else j++;
  }
  return summarise(ref, refOriginal, hyp, found, usedHyp);
}

// ---------------------------------------------------------------------------
// (ج) مطابقة بالحروف: نلغي المسافات تماماً ونحاذي الحروف، ثم نرجّع النتيجة للكلمات.
//     الكلمة تُعتبر مقروءة إذا تحاذت 60% من حروفها بالترتيب.
//     حدود الكلمات ما تهم هنا، فالتقسيم والدمج ما يأثران.
// ---------------------------------------------------------------------------
export const CHAR_MATCH_RATIO = 0.6; // نسبة حروف الكلمة اللي لازم تتحاذى عشان نعدّها مقروءة

export function matchChar(transcript, reference) {
  const ref = words(reference);
  const refOriginal = String(reference).trim().split(/\s+/);
  const hyp = words(transcript);

  // سلسلة حروف المرجع، مع تذكّر كل حرف لأي كلمة يرجع
  const refChars = [];
  const owner = [];
  ref.forEach((w, wi) => {
    for (const ch of w) { refChars.push(ch); owner.push(wi); }
  });
  const hypChars = [...hyp.join("")];

  // أطول سلسلة حروف مشتركة بالترتيب (LCS)
  const a = refChars.length, b = hypChars.length;
  const L = Array.from({ length: a + 1 }, () => new Int32Array(b + 1));
  for (let x = a - 1; x >= 0; x--) {
    for (let y = b - 1; y >= 0; y--) {
      L[x][y] = refChars[x] === hypChars[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
    }
  }
  // نمشي على المسار ونعدّ كم حرفاً تحاذى من كل كلمة
  const hits = new Array(ref.length).fill(0);
  let x = 0, y = 0;
  while (x < a && y < b) {
    if (refChars[x] === hypChars[y]) { hits[owner[x]]++; x++; y++; }
    else if (L[x + 1][y] >= L[x][y + 1]) x++;
    else y++;
  }

  const found = new Set();
  ref.forEach((w, wi) => {
    if (w.length && hits[wi] / w.length >= CHAR_MATCH_RATIO) found.add(wi);
  });
  // الحروف ما تنقسم لكلمات نص، فنفحص الترتيب بمقارنة الكلمات الناقصة بالنص كاملاً
  return summarise(ref, refOriginal, hyp, found, null);
}

// ---------------------------------------------------------------------------
// نفس شكل الإرجاع في align.js، لكن missing بإملاء المرجع الأصلي
// ---------------------------------------------------------------------------
function summarise(ref, refOriginal, hyp, found, usedHyp) {
  const leftover = usedHyp ? hyp.filter((_, k) => !usedHyp.has(k)) : [...hyp];
  const missing = [];
  let outOfOrder = 0;
  ref.forEach((w, i) => {
    if (found.has(i)) return;
    // الكلمة غير متطابقة في مكانها: هل هي موجودة في مكان ثانٍ؟ إذاً ترتيب، مو نقص.
    const k = leftover.findIndex((h) => near(w, h));
    if (k >= 0) { leftover.splice(k, 1); outOfOrder++; }
    else missing.push(refOriginal[i] ?? w); // الإملاء الأصلي كما في fajr.json
  });
  return {
    complete: missing.length === 0 && outOfOrder === 0,
    missing,
    orderOk: outOfOrder === 0,
    matched: found.size,
    total: ref.length,
  };
}

// كل المطابقات في مكان واحد، عشان سكربت التقييم يمر عليها
export const MATCHERS = {
  word: matchWord,
  "word-merge": matchWordMerge,
  char: matchChar,
};
