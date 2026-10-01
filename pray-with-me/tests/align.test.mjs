// Run: node tests/align.test.mjs   (or npm test)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareRecitation, normalizeArabic } from "../src/speech/align.js";

const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const REF = fajr.steps.find((s) => s.id === "fatiha").reference;

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

test("normalizeArabic strips diacritics and unifies letters", () => {
  assert.equal(normalizeArabic("ٱلْحَمْدُ لِلَّهِ"), "الحمد لله");
  assert.equal(normalizeArabic("إِيَّاكَ ـ نَعْبُدُ!"), "اياك نعبد");
  assert.equal(normalizeArabic("رحمة على"), "رحمه علي");
});

test("a. fully diacritized correct Fatiha", () => {
  const hyp =
    "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ مَٰلِكِ يَوْمِ ٱلدِّينِ " +
    "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ " +
    "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ";
  const r = compareRecitation(hyp, REF);
  assert.equal(r.complete, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.orderOk, true);
  assert.equal(r.matched, 25);
  assert.equal(r.total, 25);
});

test("b. missing 'واياك نستعين' and 'ولا الضالين'", () => {
  const hyp = REF.replace("واياك نستعين ", "").replace(" ولا الضالين", "");
  const r = compareRecitation(hyp, REF);
  assert.equal(r.complete, false);
  for (const w of ["واياك", "نستعين", "ولا", "الضالين"]) assert.ok(r.missing.includes(w), `missing ${w}`);
  assert.equal(r.orderOk, true);
  assert.equal(r.matched, 21);
});

test("c. 'مالك يوم الدين' before 'الرحمن الرحيم' → out of order", () => {
  const hyp = REF.replace("الرحمن الرحيم مالك يوم الدين", "مالك يوم الدين الرحمن الرحيم");
  assert.notEqual(hyp, REF);
  const r = compareRecitation(hyp, REF);
  assert.equal(r.complete, false);
  assert.equal(r.orderOk, false);
  assert.deepEqual(r.missing, []);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
