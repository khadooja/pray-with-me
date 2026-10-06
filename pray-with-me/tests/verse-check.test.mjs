// Run: node tests/verse-check.test.mjs   (or npm test)
//
// Per-verse Al-Fatihah checking (src/speech/verse-check.js). Pure logic: it delegates to
// compareRecitation from align.js and never touches it.
//
// The invariant that makes per-verse checking safe: the six verses, normalized and joined,
// are byte-identical to the whole-surah `reference` the AI module checks against. If a
// content edit ever breaks that, this file fails instead of the app silently mis-checking.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeArabic } from "../src/speech/align.js";
import { checkableVerses, checkVerse, aggregate, COMPLETE, INCOMPLETE, SKIPPED, TOO_LONG, EXTRA_WORDS_ALLOWED }
  from "../src/speech/verse-check.js";

const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const STEP = fajr.steps.find((s) => s.id === "fatiha");
const VERSES = checkableVerses(STEP);
const SUNNAH = STEP.sunnahVerses.map((v) => v.arabic); // basmala, amin

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ---------- the invariant ----------

test("the verses joined are exactly the checked reference, word for word", () => {
  assert.equal(VERSES.length, 6, "Al-Fatihah is six verses once the basmala is set aside");
  const joined = VERSES.map((v) => normalizeArabic(v.arabic)).join(" ");
  assert.equal(joined, normalizeArabic(STEP.reference),
    "per-verse checking is only valid while the verses add up to the reference exactly");
  const words = VERSES.reduce((n, v) => n + normalizeArabic(v.arabic).split(" ").length, 0);
  assert.equal(words, 25, "25 words in total, same as the reference");
});

test("the Sunnah lines are not among the checked verses", () => {
  assert.equal(STEP.sunnahVerses.length, 2, "basmala and amin");
  const checked = VERSES.map((v) => normalizeArabic(v.arabic));
  for (const s of STEP.sunnahVerses) {
    const first = normalizeArabic(s.arabic).split(" ")[0];
    assert.ok(!checked.some((v) => v.includes(first)),
      `"${first}" is Sunnah and must never be part of a checked verse`);
  }
});

test("checkableVerses is defensive about missing content", () => {
  assert.deepEqual(checkableVerses({}), []);
  assert.deepEqual(checkableVerses(null), []);
});

// ---------- one verse at a time ----------

test("a correctly recited verse comes back complete", () => {
  VERSES.forEach((verse, i) => {
    const r = checkVerse(verse.arabic, verse, i);
    assert.equal(r.status, COMPLETE, `verse ${i + 1} should pass when recited exactly`);
    assert.deepEqual(r.missing, []);
    assert.equal(r.index, i);
  });
});

test("a missing word is flagged in its own verse, and not in the others", () => {
  // drop "العالمين" from verse 1
  const verse1 = VERSES[0];
  const without = normalizeArabic(verse1.arabic).split(" ").slice(0, -1).join(" ");
  const r1 = checkVerse(without, verse1, 0);
  assert.equal(r1.status, INCOMPLETE);
  assert.ok(r1.missing.includes("العالمين"), `expected العالمين in ${JSON.stringify(r1.missing)}`);

  // the same transcript must not disturb any other verse's own check
  VERSES.forEach((verse, i) => {
    if (i === 0) return;
    const ok = checkVerse(verse.arabic, verse, i);
    assert.equal(ok.status, COMPLETE, `verse ${i + 1} is independent of verse 1's mistake`);
  });
});

test("reciting the whole surah into one verse's check does not make it complete by accident", () => {
  // verse 2 is "الرحمن الرحيم": the full surah contains it, but with 23 extra words. A tester
  // recited the whole surah on one verse's screen, left a verse out, and was told "Correct!".
  const r = checkVerse(STEP.reference, VERSES[1], 1, SUNNAH);
  assert.equal(r.status, TOO_LONG, "more than the verse on screen was recited");
  assert.equal(r.complete, true, "compareRecitation's own result is unchanged");
  assert.equal(r.total, 2, "the comparison is scoped to this verse's 2 words, not all 25");
});

test("the whole surah with one verse left out, on verse 1's screen, is not 'Correct'", () => {
  const skipped3 = VERSES.filter((_, i) => i !== 2).map((v) => v.arabic).join(" ");
  assert.equal(checkVerse(skipped3, VERSES[0], 0, SUNNAH).status, TOO_LONG);
});

test("the basmala before a verse and 'amin' after it are never counted as extra words", () => {
  const basmala = STEP.sunnahVerses[0].arabic, amin = STEP.sunnahVerses[1].arabic;
  assert.equal(checkVerse(`${basmala} ${VERSES[0].arabic}`, VERSES[0], 0, SUNNAH).status, COMPLETE);
  assert.equal(checkVerse(`${VERSES[5].arabic} ${amin}`, VERSES[5], 5, SUNNAH).status, COMPLETE);
});

test(`up to ${EXTRA_WORDS_ALLOWED} extra words are tolerated (split words, a repeated word)`, () => {
  const verse = VERSES[3];
  const w = normalizeArabic(verse.arabic).split(" ");
  const plusTwo = [...w, w[0], w[1]].join(" ");
  const plusThree = [...w, w[0], w[1], w[2]].join(" ");
  assert.equal(checkVerse(plusTwo, verse, 3, SUNNAH).status, COMPLETE);
  assert.equal(checkVerse(plusThree, verse, 3, SUNNAH).status, TOO_LONG);
});

test("a too-long verse does not count as passed for the step", () => {
  const all = VERSES.map((v, i) => checkVerse(v.arabic, v, i, SUNNAH));
  all[1] = checkVerse(STEP.reference, VERSES[1], 1, SUNNAH);
  assert.equal(aggregate(all, VERSES.length).allComplete, false);
});

test("words recited out of order inside a verse are reported as such", () => {
  const verse = VERSES[2]; // مالك يوم الدين
  const w = normalizeArabic(verse.arabic).split(" ");
  const swapped = [w[2], w[1], w[0]].join(" ");
  const r = checkVerse(swapped, verse, 2);
  assert.equal(r.status, INCOMPLETE);
  assert.equal(r.orderOk, false, "the order problem must be visible to the UI");
});

test("an empty recitation reports every word of that verse as missing", () => {
  const r = checkVerse("", VERSES[1], 1);
  assert.equal(r.status, INCOMPLETE);
  assert.equal(r.missing.length, r.total);
});

// ---------- the step's aggregate result ----------

const done = (status, index) => ({ status, index, missing: [], orderOk: true, matched: 0, total: 0 });

test("the step is complete only when every verse ended complete", () => {
  const all = VERSES.map((_, i) => done(COMPLETE, i));
  const sum = aggregate(all, VERSES.length);
  assert.equal(sum.finished, true);
  assert.equal(sum.allComplete, true);
  assert.equal(sum.byVerse.length, 6);
});

test("one incomplete verse makes the whole step incomplete", () => {
  const mixed = VERSES.map((_, i) => done(i === 3 ? INCOMPLETE : COMPLETE, i));
  const sum = aggregate(mixed, VERSES.length);
  assert.equal(sum.finished, true);
  assert.equal(sum.allComplete, false, "the success sheet must not appear");
});

test("a skipped verse never counts as complete", () => {
  const skipped = VERSES.map((_, i) => done(i === 0 ? SKIPPED : COMPLETE, i));
  const sum = aggregate(skipped, VERSES.length);
  assert.equal(sum.finished, true);
  assert.equal(sum.allComplete, false, "skipping is not passing");
});

test("an unfinished run is reported as not finished", () => {
  const partial = [done(COMPLETE, 0), done(COMPLETE, 1)];
  const sum = aggregate(partial, VERSES.length);
  assert.equal(sum.finished, false, "four verses still have no result");
  assert.equal(sum.allComplete, false);
  assert.equal(sum.byVerse.filter(Boolean).length, 2);
});

test("aggregate of nothing is not a pass", () => {
  assert.equal(aggregate([], 0).allComplete, false);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
