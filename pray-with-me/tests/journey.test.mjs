// Run: node tests/journey.test.mjs   (or npm test)
//
// Guards the shape of the prayer journey in src/content/fajr.json:
// the order is valid, every referenced step exists, a step that happens twice is
// defined only once, and the content the Sharia reviewer already approved is untouched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POSE_FOR_STEP } from "../src/figure/poses.js";
import { resolveJourney, journeyAttemptKeys, journeyRakahs, rakahCount, entryId, journeyTransitions }
  from "../src/content/journey.js";

const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(fajr.steps.map((s) => [s.id, s]));
// an "order" entry is either a step id or { id, transition }; the ids are what this file checks
const ORDER = fajr.order.map(entryId);

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

// the single takbir_transition definition became two: one into ruku (hands raised)
// and one into sujood (hands not raised)
const ONE_RAKAH = ["standing", "fatiha", "takbir_to_ruku", "ruku", "rising",
  "itidal", "takbir_to_sujood", "sujood", "jalsa", "sujood"];
const EXPECTED_ORDER = ["takbir", ...ONE_RAKAH, "second_rakah", ...ONE_RAKAH, "tashahhud", "taslim"];

test("the journey walks through both rakahs", () => {
  assert.deepEqual(ORDER, EXPECTED_ORDER);
  assert.equal(ORDER.length, 24, "two rakahs come to 24 steps");
});

test("the second rakah reuses the very same step definitions", () => {
  const steps = resolveJourney(fajr);
  const first = steps.slice(1, 11);   // the first rakah's ten steps
  const second = steps.slice(12, 22); // the second rakah's ten steps
  assert.equal(first.length, 10);
  first.forEach((step, i) => {
    assert.equal(step, second[i],
      `${step.id}: the second rakah must be the same object, not a copy`);
  });
});

test("walking both rakahs added no new definitions", () => {
  assert.equal(fajr.steps.length, 13, "thirteen definitions for twenty-four steps");
});

test("every step named in the order exists", () => {
  for (const id of ORDER) {
    assert.ok(byId[id], `"order" names a step with no definition: "${id}"`);
  }
});

test("no step is defined twice", () => {
  const ids = fajr.steps.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate definitions: ${ids.join(", ")}`);
});

test("a step that happens more than once is one definition, referenced again", () => {
  const repeated = ORDER.filter((id, i) => ORDER.indexOf(id) !== i);
  assert.deepEqual([...new Set(repeated)].sort(),
    ["fatiha", "itidal", "jalsa", "rising", "ruku", "standing", "sujood", "takbir_to_ruku",
      "takbir_to_sujood"]);
  // resolving the order must hand back the very same object, so the content is
  // written and reviewed once and can never drift between the two occurrences
  const journey = ORDER.map((id) => byId[id]);
  for (const id of new Set(repeated)) {
    const seen = journey.filter((s) => s.id === id);
    assert.ok(seen.length >= 2, `${id} should appear at least twice in the journey`);
    for (const s of seen) assert.equal(s, seen[0], `${id}: the occurrences are different objects`);
  }
});

test("every definition is actually used by the order", () => {
  for (const s of fajr.steps) {
    assert.ok(ORDER.includes(s.id), `"${s.id}" is defined but never used`);
  }
});

test("pose checks stay only on standing, ruku and sujood", () => {
  for (const s of fajr.steps) {
    if (s.type === "pose") {
      assert.ok(["standing", "ruku", "sujood"].includes(s.check), `${s.id}: unexpected check "${s.check}"`);
    } else {
      assert.equal(s.check, undefined, `${s.id} is not a pose step but has a check`);
    }
  }
  const poseSteps = fajr.steps.filter((s) => s.type === "pose").map((s) => s.id);
  assert.deepEqual(poseSteps.sort(), ["ruku", "standing", "sujood"]);
});

test("every step has a valid type and Arabic + English titles", () => {
  for (const s of fajr.steps) {
    assert.ok(["guided", "pose", "speech"].includes(s.type), `${s.id}: bad type "${s.type}"`);
    assert.ok(s.title?.ar?.trim(), `${s.id}: missing Arabic title`);
    assert.ok(s.title?.en?.trim(), `${s.id}: missing English title`);
    assert.ok(s.instruction?.en !== undefined, `${s.id}: missing instruction`);
    assert.ok(s.source !== undefined, `${s.id}: missing source field`);
  }
});

test("the Al-Fatihah reference text is unchanged", () => {
  assert.equal(
    byId.fatiha.reference,
    "الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين اياك نعبد واياك نستعين اهدنا الصراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين"
  );
});

// Every religious text now comes from docs/content-source.md; tests/content.test.mjs
// compares it character for character. Here we only check which steps carry a dhikr.
test("the dhikr of each step is present and reviewed", () => {
  assert.equal(byId.takbir.dhikr.arabic, "الله أكبر");
  assert.equal(byId.ruku.dhikr.arabic, "سبحان ربي العظيم");
  assert.equal(byId.sujood.dhikr.arabic, "سبحان ربي الأعلى");
  // standing is the posture only: the recitation lives in the fatiha step
  assert.equal(byId.standing.dhikr, undefined, "standing must not carry a dhikr of its own");
  assert.equal(byId.fatiha.dhikr, undefined, "the fatiha step uses verses, not a dhikr card");
});

test("second_rakah is ours, not the content owner's, and says so", () => {
  // it is a navigation step we added; it has no row in docs/content-source.md
  assert.equal(byId.second_rakah.instruction.en, "Rise to stand for the second rakah.");
  assert.equal(byId.second_rakah.title.ar, "الركعة الثانية", "its Arabic title is unchanged");
  assert.equal(byId.second_rakah.source, "TODO", "no source is claimed for it");
  assert.equal(byId.second_rakah.dhikr, undefined, "it carries no religious text");
});

test("transition notes sit on the positions that follow a transition, and nowhere else", () => {
  const notes = journeyTransitions(fajr);
  assert.equal(notes.length, 24);
  const at = notes.map((n, i) => (n ? `${ORDER[i]}@${i}` : null)).filter(Boolean);
  assert.deepEqual(at, ["jalsa@9", "sujood@10", "second_rakah@11", "jalsa@20", "sujood@21", "tashahhud@22"]);
});

test("the figure mapping covers the right steps and no others", () => {
  const withFigure = ["takbir", "standing", "fatiha", "takbir_to_ruku", "takbir_to_sujood", "ruku", "rising",
    "itidal", "sujood", "jalsa", "second_rakah", "tashahhud", "taslim"];
  const withoutFigure = [];
  assert.deepEqual(Object.keys(POSE_FOR_STEP).sort(), [...withFigure].sort());
  for (const id of withoutFigure) {
    assert.equal(POSE_FOR_STEP[id], undefined, `${id} should show no figure yet`);
  }
  // rising, itidal and the second rakah all settle on the standing pose
  for (const id of ["rising", "itidal", "second_rakah", "takbir_to_ruku", "takbir_to_sujood", "fatiha"]) {
    assert.equal(POSE_FOR_STEP[id], "standing", `${id} should use the standing pose`);
  }
  // every mapped step is a real step
  for (const id of Object.keys(POSE_FOR_STEP)) {
    assert.ok(byId[id], `POSE_FOR_STEP names an unknown step "${id}"`);
  }
});

test("the sitting steps use the sitting pose, and taslim has its own back view", () => {
  assert.equal(POSE_FOR_STEP.jalsa, "sitting");
  assert.equal(POSE_FOR_STEP.tashahhud, "sitting");
  assert.equal(POSE_FOR_STEP.taslim, "taslim", "taslim is drawn from behind");
});

test("every step in the journey now has a figure", () => {
  const blank = [...new Set(ORDER)].filter((id) => !POSE_FOR_STEP[id]);
  assert.deepEqual(blank, [], `these steps still show no figure: ${blank.join(", ")}`);
});

// ---------- attempts are recorded per position, not just per step id ----------
const JOURNEY = ORDER.map((id) => byId[id]);
const KEYS = journeyAttemptKeys(JOURNEY);

test("every position in the journey gets its own attempt key", () => {
  assert.equal(KEYS.length, ORDER.length);
  assert.equal(new Set(KEYS).size, KEYS.length, `attempt keys are not unique: ${KEYS.join(", ")}`);
});

test("the two prostrations are logged separately", () => {
  const sujoodKeys = KEYS.filter((k) => k.startsWith("sujood#"));
  assert.deepEqual(sujoodKeys, ["sujood#1", "sujood#2", "sujood#3", "sujood#4"],
    "all four prostrations must be distinguishable in the progress data");
  // ...while still being the same definition, so the content is written once
  const positions = ORDER.map((id, i) => (id === "sujood" ? i : -1)).filter((i) => i >= 0);
  assert.equal(JOURNEY[positions[0]], JOURNEY[positions[1]], "the definition must stay shared");
});

test("the repeated transition takbir is also logged separately", () => {
  assert.deepEqual(KEYS.filter((k) => k.startsWith("takbir_to_")),
    ["takbir_to_ruku#1", "takbir_to_sujood#1", "takbir_to_ruku#2", "takbir_to_sujood#2"]);
});

test("each repeated step gets one attempt key per performance", () => {
  const counts = { takbir: 1, standing: 2, fatiha: 2, takbir_to_ruku: 2, takbir_to_sujood: 2, ruku: 2,
    rising: 2, itidal: 2, sujood: 4, jalsa: 2, second_rakah: 1, tashahhud: 1, taslim: 1 };
  for (const [id, n] of Object.entries(counts)) {
    assert.equal(KEYS.filter((k) => k.startsWith(`${id}#`)).length, n, `${id} should be performed ${n} time(s)`);
  }
  assert.equal(KEYS.length, 24);
});

// ---------- the rakah indicator ----------
test("the rakah indicator switches right after second_rakah", () => {
  const steps = resolveJourney(fajr);
  const rakahs = journeyRakahs(steps);
  const breakAt = ORDER.indexOf("second_rakah");
  assert.equal(rakahCount(steps), 2, "Fajr is two rakahs");
  assert.equal(rakahs.length, steps.length, "every step must belong to a rakah");
  rakahs.forEach((r, i) => {
    const expected = i <= breakAt ? 1 : 2;
    assert.equal(r, expected, `step ${i + 1} (${steps[i].id}) should be in rakah ${expected}`);
  });
  // the transition step itself closes the first rakah
  assert.equal(rakahs[breakAt], 1);
  assert.equal(rakahs[breakAt + 1], 2);
  assert.ok(rakahs.every((r) => r === 1 || r === 2), "no step may fall outside the two rakahs");
});

test("an attempt key always names its step, so eval can group by step", () => {
  KEYS.forEach((key, i) => {
    const [id, n] = key.split("#");
    assert.equal(id, JOURNEY[i].id, `key ${key} does not match step ${JOURNEY[i].id}`);
    assert.ok(Number(n) >= 1, `key ${key} has no occurrence number`);
  });
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
