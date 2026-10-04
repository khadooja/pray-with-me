// Run: npm run eval:speech
//
// Runs every matcher in src/speech/matchers.js over eval/speech-fixtures.json and
// prints what each one gets right and wrong. Nothing here changes app behaviour.
//
// The two numbers that matter:
//   - false "missing" on a FULL recitation  -> the app nags someone who recited correctly
//   - missed omissions                      -> the app stays silent when a word was skipped
// For every false missing word it also says whether the letters are in the transcript at
// all, because that decides who can fix it: the matcher, or only a better ASR model.
import { readFileSync } from "node:fs";
import { MATCHERS } from "../src/speech/matchers.js";
import { normalizeArabic, levenshtein } from "../src/speech/align.js";

const fixtures = JSON.parse(readFileSync(new URL("../eval/speech-fixtures.json", import.meta.url), "utf8"));
const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const REFERENCE = fajr.steps.find((s) => s.id === "fatiha").reference;

// Best edit distance between `word` and ANY window of the space-free transcript.
// Low distance => the letters are in there, just across a different word boundary.
function bestWindowDistance(word, stream) {
  const n = word.length, m = stream.length;
  let prev = new Array(m + 1).fill(0); // free start: a match may begin anywhere
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (word[i - 1] === stream[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return Math.min(...prev); // free end
}

// Why is this word reported missing?
function explain(word, transcript) {
  const stream = normalizeArabic(transcript).split(" ").join("");
  const d = bestWindowDistance(word, stream);
  const tolerated = Math.max(1, Math.round(word.length * 0.34));
  return d <= tolerated
    ? { kind: "split/merged", detail: `in the transcript, distance ${d}` }
    : { kind: "absent", detail: `nearest window off by ${d}` };
}

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));

console.log("\nSpeech matching evaluation");
console.log(`reference: ${REFERENCE.split(" ").length} words · fixtures: ${fixtures.cases.length}`);
console.log("=".repeat(78));

const summary = [];
for (const [name, match] of Object.entries(MATCHERS)) {
  let falseMissing = 0, detected = 0, missedOmissions = 0, exact = 0;
  const notes = [];

  console.log(`\n### matcher: ${name}`);
  console.log(pad("case", 6) + pad("kind", 11) + pad("recited", 9) + pad("matched", 9) + "result");
  console.log("-".repeat(78));

  for (const c of fixtures.cases) {
    const r = match(c.transcript, REFERENCE);
    const expected = c.expectedMissing;
    const got = r.missing;

    if (c.recited === "full") {
      falseMissing += got.length;
      for (const w of got) {
        const why = explain(normalizeArabic(w), c.transcript);
        notes.push(`  ${c.id}  false missing "${w}" -> ${why.kind} (${why.detail})`);
      }
    } else {
      // did it flag every word that really was skipped?
      const found = expected.filter((w) => got.includes(w));
      detected += found.length;
      missedOmissions += expected.length - found.length;
      const extra = got.filter((w) => !expected.includes(w));
      falseMissing += extra.length;
      for (const w of extra) {
        const why = explain(normalizeArabic(w), c.transcript);
        notes.push(`  ${c.id}  extra missing "${w}" -> ${why.kind} (${why.detail})`);
      }
    }
    if (same(got, expected)) exact++;

    const verdict = same(got, expected) ? "exact" : `missing: ${got.join(" ") || "(none)"}`;
    console.log(pad(c.id, 6) + pad(c.kind, 11) + pad(c.recited, 9) + pad(`${r.matched}/${r.total}`, 9) + verdict);
  }

  if (notes.length) {
    console.log("\n  why each wrong word was reported:");
    notes.forEach((n) => console.log(n));
  }
  summary.push({ name, falseMissing, detected, missedOmissions, exact });
}

const totalOmissions = fixtures.cases.reduce((s, c) => s + c.expectedMissing.length, 0);
console.log("\n" + "=".repeat(78));
console.log("SUMMARY   (lower false-missing is better; detected should equal total omissions)");
console.log("-".repeat(78));
console.log(pad("matcher", 14) + pad("false missing", 16) + pad("omissions found", 18) + pad("omissions missed", 18) + "exact cases");
for (const s of summary) {
  console.log(
    pad(s.name, 14) + pad(s.falseMissing, 16) +
    pad(`${s.detected}/${totalOmissions}`, 18) + pad(s.missedOmissions, 18) +
    `${s.exact}/${fixtures.cases.length}`
  );
}
console.log("-".repeat(78));
console.log(`NOTE: only ${fixtures.cases.length} fixtures, and 3 of them are synthetic variations of one`);
console.log("recording. These numbers show direction, not accuracy. Add real recordings before");
console.log("choosing a matcher for the app.\n");
