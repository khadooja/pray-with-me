// Run: node tests/review.test.mjs   (or npm test)
//
// The finish-screen review and the help sheet. Both are built only from data the app
// already has — attempt history and fajr.json — so these tests use hand-written
// attempt records and assert the ranking is correct, stable and never invents a step.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewSteps, occurrenceOf } from "../src/progress/review.js";
import { helpContactVisible, helpActions, helpBody } from "../src/ui/help.js";
import { resolveJourney, journeyAttemptKeys } from "../src/content/journey.js";

const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const JOURNEY = resolveJourney(fajr);
const KEYS = journeyAttemptKeys(JOURNEY);

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

const ok = (n) => Array.from({ length: n }, () => ({ ok: false, at: "" })).concat([{ ok: true, at: "" }]);
const failed = (n) => Array.from({ length: n }, () => ({ ok: false, at: "" }));
const firstTry = [{ ok: true, at: "" }];

// ---------- ranking ----------
test("a step never completed outranks one that just took several tries", () => {
  const attempts = { "ruku#1": ok(4), "sujood#1": failed(2) };
  const rows = reviewSteps(attempts, JOURNEY, KEYS);
  assert.equal(rows[0].key, "sujood#1", "the uncompleted step must come first");
  assert.equal(rows[0].succeeded, false);
  assert.equal(rows[1].key, "ruku#1");
});

test("among completed steps, the one with the most attempts comes first", () => {
  const attempts = { "standing#1": ok(1), "ruku#1": ok(5), "fatiha#1": ok(2) };
  const rows = reviewSteps(attempts, JOURNEY, KEYS);
  assert.deepEqual(rows.map((r) => r.key), ["ruku#1", "fatiha#1", "standing#1"]);
  assert.deepEqual(rows.map((r) => r.tries), [6, 3, 2]);
});

test("a step completed on the first try is not listed", () => {
  const rows = reviewSteps({ "ruku#1": firstTry, "sujood#1": firstTry }, JOURNEY, KEYS);
  assert.deepEqual(rows, [], "a clean run should suggest nothing");
});

test("a perfect run returns nothing at all", () => {
  const attempts = Object.fromEntries(KEYS.map((k) => [k, firstTry]));
  assert.deepEqual(reviewSteps(attempts, JOURNEY, KEYS), []);
});

test("at most three steps are suggested", () => {
  const attempts = Object.fromEntries(KEYS.map((k) => [k, failed(3)]));
  assert.equal(reviewSteps(attempts, JOURNEY, KEYS).length, 3);
  assert.equal(reviewSteps(attempts, JOURNEY, KEYS, 5).length, 5, "the limit is adjustable");
});

// ---------- stability ----------
test("ties are broken by journey order, so the result is stable", () => {
  // four identical records: same outcome, same number of tries
  const attempts = { "sujood#3": ok(2), "ruku#1": ok(2), "sujood#1": ok(2), "ruku#2": ok(2) };
  const rows = reviewSteps(attempts, JOURNEY, KEYS);
  const indexes = rows.map((r) => r.index);
  assert.deepEqual([...indexes].sort((a, b) => a - b), indexes, "tied rows must follow journey order");
  // and the same input always gives the same answer
  const again = reviewSteps(attempts, JOURNEY, KEYS);
  assert.deepEqual(again.map((r) => r.key), rows.map((r) => r.key));
});

test("the order of keys in storage does not change the result", () => {
  const a = { "ruku#1": ok(2), "sujood#1": ok(2) };
  const b = { "sujood#1": ok(2), "ruku#1": ok(2) };
  assert.deepEqual(reviewSteps(a, JOURNEY, KEYS).map((r) => r.key),
    reviewSteps(b, JOURNEY, KEYS).map((r) => r.key));
});

// ---------- robustness ----------
test("unknown or malformed records are ignored", () => {
  const attempts = { "ghost#9": failed(5), "ruku#1": ok(2), "broken#1": "not-an-array", "sujood#1": null };
  const rows = reviewSteps(attempts, JOURNEY, KEYS);
  assert.deepEqual(rows.map((r) => r.key), ["ruku#1"]);
  assert.ok(rows.every((r) => r.step), "every suggested row must point at a real step");
});

test("no attempts at all suggests nothing", () => {
  assert.deepEqual(reviewSteps({}, JOURNEY, KEYS), []);
  assert.deepEqual(reviewSteps(undefined, JOURNEY, KEYS), []);
});

test("each suggested row carries the step it belongs to", () => {
  const rows = reviewSteps({ "sujood#4": failed(2) }, JOURNEY, KEYS);
  assert.equal(rows[0].step.id, "sujood");
  assert.equal(rows[0].index, KEYS.indexOf("sujood#4"));
  assert.equal(JOURNEY[rows[0].index].id, "sujood", "the index must jump to the right step");
});

test("occurrenceOf says which performance a key refers to", () => {
  assert.deepEqual(occurrenceOf("sujood#3", KEYS), { index: 3, total: 4 });
  assert.deepEqual(occurrenceOf("takbir#1", KEYS), { index: 1, total: 1 });
});

// ---------- only the current run counts ----------
// The review should talk about the prayer just finished, not mistakes from last week.
// Stored history is never touched: we only filter what we show.
const at = (iso) => ({ ok: false, at: iso });
const RUN_START = "2026-10-04T10:00:00.000Z";
const BEFORE = "2026-10-03T09:00:00.000Z"; // yesterday's run
const DURING = "2026-10-04T10:05:00.000Z"; // this run

test("a failed attempt from a previous run does not appear in the review", () => {
  const attempts = { "ruku#1": [at(BEFORE), at(BEFORE)] };
  assert.deepEqual(reviewSteps(attempts, JOURNEY, KEYS, 3, RUN_START), [],
    "old failures must not be blamed on today's prayer");
  // ...but the history itself is still there for the results page
  assert.equal(attempts["ruku#1"].length, 2, "the stored record must not be modified");
});

test("a failed attempt in the current run does appear", () => {
  const rows = reviewSteps({ "ruku#1": [at(DURING), at(DURING)] }, JOURNEY, KEYS, 3, RUN_START);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, "ruku#1");
  assert.equal(rows[0].tries, 2, "only this run's attempts are counted");
  assert.equal(rows[0].succeeded, false);
});

test("attempt counts ignore earlier runs", () => {
  // five old failures plus one clean pass today should not be suggested at all
  const attempts = {
    "sujood#1": [at(BEFORE), at(BEFORE), at(BEFORE), at(BEFORE), at(BEFORE), { ok: true, at: DURING }],
  };
  assert.deepEqual(reviewSteps(attempts, JOURNEY, KEYS, 3, RUN_START), [],
    "a step passed first time today is not a step to practise");
});

test("a step passed last time but failed today is suggested", () => {
  const attempts = { "standing#1": [{ ok: true, at: BEFORE }, at(DURING)] };
  const rows = reviewSteps(attempts, JOURNEY, KEYS, 3, RUN_START);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].succeeded, false, "today's failure is what matters");
});

test("without a run start, the whole history is considered (results page behaviour)", () => {
  const attempts = { "ruku#1": [at(BEFORE), at(BEFORE)] };
  assert.equal(reviewSteps(attempts, JOURNEY, KEYS).length, 1, "no cutoff means everything counts");
  assert.equal(reviewSteps(attempts, JOURNEY, KEYS, 3, null).length, 1);
});

test("records with no timestamp are left out of the current run", () => {
  const attempts = { "ruku#1": [{ ok: false }, { ok: false, at: null }] };
  assert.deepEqual(reviewSteps(attempts, JOURNEY, KEYS, 3, RUN_START), [],
    "an attempt we cannot date must not be attributed to this run");
});

// ---------- the help sheet ----------
test("the help sheet never offers a TODO contact link", () => {
  for (const url of ["TODO", "", "   ", undefined, null]) {
    assert.equal(helpContactVisible(url), false, `"${url}" must not be shown as a link`);
  }
  assert.equal(helpContactVisible("https://example.org/contact"), true);
});

test("the contact row is absent while the URL is still TODO", () => {
  const step = JOURNEY.find((s) => s.id === "ruku");
  const withTodo = helpActions(step, { url: "TODO", onReplay() {}, onTryAgain() {} });
  assert.ok(!withTodo.some((a) => a.href), "no link row while the URL is a placeholder");
  assert.ok(!JSON.stringify(withTodo).includes("TODO"), "the word TODO must never reach the UI");

  const withUrl = helpActions(step, { url: "https://example.org/ask", onReplay() {}, onTryAgain() {} });
  const link = withUrl.find((a) => a.href);
  assert.ok(link, "a real URL should add the contact row");
  assert.equal(link.href, "https://example.org/ask");
});

test("the help sheet always offers replay and try again", () => {
  const step = JOURNEY.find((s) => s.id === "standing");
  const actions = helpActions(step, { onReplay() {}, onTryAgain() {} });
  assert.equal(actions.length, 2, "replay and try again, with no contact row by default");
  assert.ok(actions.some((a) => a.primary), "try again is the primary action");
  // a step with no figure still offers try again
  const noFigure = helpActions(step, { onTryAgain() {} });
  assert.equal(noFigure.length, 1);
});

test("the help body repeats the step's own words, nothing invented", () => {
  const ruku = JOURNEY.find((s) => s.id === "ruku");
  const body = helpBody(ruku);
  assert.ok(body.includes(ruku.instruction.en), "the instruction must come from fajr.json");
  assert.ok(body.includes(ruku.dhikr.arabic), "the dhikr must come from fajr.json");
  assert.ok(body.includes(ruku.dhikr.transliteration));
  // no audio player when the step has no audio file yet
  assert.ok(!body.includes("<audio"), "an empty audio path must not render a player");

  // a guided step with no dhikr still renders cleanly
  const taslim = JOURNEY.find((s) => s.id === "taslim");
  assert.ok(!helpBody(taslim).includes("dhikr"), "no dhikr card when the step has none");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
