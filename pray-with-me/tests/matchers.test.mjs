// Run: node tests/matchers.test.mjs   (or npm test)
//
// The three speech matchers against eval/speech-fixtures.json.
// These lock in what each matcher measurably does today, so a change to the tuning
// shows up as a failing test rather than a silent shift in behaviour.
// Nothing here touches src/speech/align.js — it is the AI teammate's file.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MATCHERS, matchWord, matchWordMerge, matchChar, CHAR_MATCH_RATIO } from "../src/speech/matchers.js";
import { compareRecitation } from "../src/speech/align.js";

const fixtures = JSON.parse(readFileSync(new URL("../eval/speech-fixtures.json", import.meta.url), "utf8"));
const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const REFERENCE = fajr.steps.find((s) => s.id === "fatiha").reference;
const byId = Object.fromEntries(fixtures.cases.map((c) => [c.id, c]));

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

const run = (m, id) => MATCHERS[m](byId[id].transcript, REFERENCE);

// ---------- the shared contract ----------
test("every matcher returns the compareRecitation shape", () => {
  for (const [name, match] of Object.entries(MATCHERS)) {
    for (const c of fixtures.cases) {
      const r = match(c.transcript, REFERENCE);
      assert.equal(typeof r.complete, "boolean", `${name}/${c.id}: complete`);
      assert.ok(Array.isArray(r.missing), `${name}/${c.id}: missing must be an array`);
      assert.equal(typeof r.orderOk, "boolean", `${name}/${c.id}: orderOk`);
      assert.equal(r.total, 25, `${name}/${c.id}: the Fatihah is 25 words`);
      assert.ok(r.matched >= 0 && r.matched <= r.total, `${name}/${c.id}: matched in range`);
      assert.equal(r.complete, r.missing.length === 0 && r.orderOk, `${name}/${c.id}: complete must agree`);
    }
  }
});

test("the word matcher is exactly align.js, untouched", () => {
  for (const c of fixtures.cases) {
    assert.deepEqual(matchWord(c.transcript, REFERENCE), compareRecitation(c.transcript, REFERENCE),
      `${c.id}: the baseline matcher must delegate unchanged`);
  }
});

test("missing words come back in the reference spelling", () => {
  const refWords = REFERENCE.split(" ");
  for (const [name, match] of Object.entries(MATCHERS)) {
    for (const c of fixtures.cases) {
      for (const w of match(c.transcript, REFERENCE).missing) {
        assert.ok(refWords.includes(w), `${name}/${c.id}: "${w}" is not a reference word`);
      }
    }
  }
});

// ---------- the headline finding: false alarms on a correct recitation ----------
test("the current matcher raises many false alarms on a correct recitation", () => {
  const r = run("word", "R1");
  assert.equal(byId.R1.recited, "full", "R1 is a complete recitation");
  assert.deepEqual(byId.R1.expectedMissing, [], "nothing was actually skipped");
  // similar() now requires exact equality (no more one-letter tolerance), so one more
  // ASR split/merge artifact in R1 now counts as a false alarm: 8 -> 9.
  assert.equal(r.missing.length, 9, "the shipped matcher reports 9 words that were in fact recited");
});

test("the word matcher's false-missing total across the fixture set is 31", () => {
  // mirrors scripts/eval-speech.mjs's own SUMMARY calculation for the "word" matcher
  let falseMissing = 0;
  for (const c of fixtures.cases) {
    const got = MATCHERS.word(c.transcript, REFERENCE).missing;
    falseMissing += c.recited === "full" ? got.length : got.filter((w) => !c.expectedMissing.includes(w)).length;
  }
  assert.equal(falseMissing, 31,
    "exact-match similar() turns more ASR split/merge artifacts into false alarms across all four fixtures");
});

test("both new matchers cut the false alarms to one", () => {
  for (const name of ["word-merge", "char"]) {
    const r = run(name, "R1");
    assert.equal(r.missing.length, 1, `${name}: expected a single false alarm on R1`);
    assert.deepEqual(r.missing, ["نعبد"], `${name}: the one left should be نعبد`);
  }
});

test("the one remaining false alarm is an ASR gap, not a matching gap", () => {
  // نعبد never appears in the transcript in any form, so no matcher can recover it.
  // It is a finding about the speech model, not about the matching strategy.
  const letters = byId.R1.transcript.replace(/\s+/g, "");
  assert.ok(!letters.includes("نعبد"), "نعبد is genuinely absent from the transcript");
});

// ---------- do they still catch real omissions? ----------
test("every matcher catches a clearly dropped word", () => {
  for (const name of Object.keys(MATCHERS)) {
    assert.ok(run(name, "S1").missing.includes("نستعين"), `${name} missed the dropped نستعين`);
  }
});

test("the loose matchers trade some sensitivity for fewer false alarms", () => {
  // Measured, not aspirational: these are the gaps to close before shipping a change.
  // word-merge lets الصراط pass because صراط also appears later in the Fatihah.
  const merge = run("word-merge", "S3");
  assert.ok(!merge.missing.includes("الصراط"),
    "known gap: word-merge matches الصراط against the later صراط");
  assert.ok(merge.missing.includes("اهدنا") && merge.missing.includes("المستقيم"),
    "it should still catch the other two dropped words");

  const chr = run("char", "S3");
  assert.ok(chr.missing.includes("المستقيم"), "char should catch المستقيم");
});

test("the shipped matcher is still the most sensitive to omissions", () => {
  // Every omission the fixtures describe is caught by the word matcher; that is the
  // property a looser matcher must not lose silently.
  for (const c of fixtures.cases.filter((x) => x.recited === "omitted")) {
    const got = MATCHERS.word(c.transcript, REFERENCE).missing;
    for (const w of c.expectedMissing) {
      assert.ok(got.includes(w), `word matcher should flag ${w} in ${c.id}`);
    }
  }
});

// ---------- fixtures stay well formed ----------
test("the fixtures describe real omissions in reference spelling", () => {
  const refWords = REFERENCE.split(" ");
  for (const c of fixtures.cases) {
    assert.ok(["real", "synthetic"].includes(c.kind), `${c.id}: bad kind`);
    assert.ok(["full", "omitted"].includes(c.recited), `${c.id}: bad recited`);
    assert.ok(c.transcript.trim().length, `${c.id}: empty transcript`);
    for (const w of c.expectedMissing) assert.ok(refWords.includes(w), `${c.id}: "${w}" is not a reference word`);
    if (c.recited === "full") assert.deepEqual(c.expectedMissing, [], `${c.id}: a full recitation omits nothing`);
    else assert.ok(c.expectedMissing.length, `${c.id}: an omission case needs expected words`);
  }
  assert.ok(fixtures.cases.some((c) => c.kind === "real"), "keep at least one real transcript");
});

test("the character threshold stays a named, sane constant", () => {
  assert.ok(CHAR_MATCH_RATIO > 0.4 && CHAR_MATCH_RATIO <= 1, `CHAR_MATCH_RATIO is ${CHAR_MATCH_RATIO}`);
  assert.equal(typeof matchChar, "function");
  assert.equal(typeof matchWordMerge, "function");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
