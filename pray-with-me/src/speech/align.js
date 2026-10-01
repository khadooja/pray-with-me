// CONTRACT (do not change the shape):
//   compareRecitation(transcript, reference) → { complete, missing: string[], orderOk, matched, total }
// Checks only that the reference words were said, completely and in order.
// It does NOT judge tajweed or pronunciation.
// Pure JS with no browser APIs, so it runs in Node tests too.

// Harakat, Quranic annotation marks, dagger alif.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
// Anything that is not a basic Arabic letter (U+0621–U+063A, U+0641–U+064A).
const NON_LETTERS = /[^ء-غف-ي]+/g;

export function normalizeArabic(text) {
  return String(text ?? "")
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(NON_LETTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text) {
  const n = normalizeArabic(text);
  return n ? n.split(" ") : [];
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// Equal, or long enough (>= 4 letters) and at most one letter different.
// Tolerates small ASR / spelling differences (e.g. ملك vs مالك).
export function similar(a, b) {
  if (a === b) return true;
  return Math.max(a.length, b.length) >= 4 && levenshtein(a, b) <= 1;
}

export function compareRecitation(transcript, reference) {
  const ref = words(reference);
  const hyp = words(transcript);
  const n = ref.length, m = hyp.length;

  // L[i][j] = LCS length of ref[i..] and hyp[j..] using "similar" as the match.
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = similar(ref[i], hyp[j])
        ? L[i + 1][j + 1] + 1
        : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }

  // Greedy traceback. Accept a match ONLY if it lies on an optimal LCS path
  // (L[i][j] === L[i+1][j+1] + 1). Otherwise a naive walk mis-reports order.
  const inOrder = new Set();
  const usedHyp = new Set();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (similar(ref[i], hyp[j]) && L[i][j] === L[i + 1][j + 1] + 1) {
      inOrder.add(i);
      usedHyp.add(j);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const missingIdx = ref.map((_, k) => k).filter((k) => !inOrder.has(k));
  const leftover = hyp.filter((_, k) => !usedHyp.has(k));

  // A missing ref word that was said elsewhere = present but out of order.
  // Each leftover word can explain only one missing word.
  const missing = [];
  let outOfOrder = 0;
  for (const k of missingIdx) {
    const idx = leftover.findIndex((w) => similar(ref[k], w));
    if (idx >= 0) {
      leftover.splice(idx, 1);
      outOfOrder++;
    } else {
      missing.push(ref[k]);
    }
  }

  return {
    complete: missing.length === 0 && outOfOrder === 0,
    missing,
    orderOk: outOfOrder === 0,
    matched: inOrder.size,
    total: n,
  };
}
