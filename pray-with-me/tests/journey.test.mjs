// Run: node tests/journey.test.mjs   (or npm test)
//
// Guards the shape of the prayer journey in src/content/fajr.json:
// the order is valid, every referenced step exists, a step that happens twice is
// defined only once, and the content the Sharia reviewer already approved is untouched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POSE_FOR_STEP } from "../src/figure/poses.js";

const fajr = JSON.parse(readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(fajr.steps.map((s) => [s.id, s]));

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

const EXPECTED_ORDER = [
  "takbir", "standing", "fatiha", "takbir_transition", "ruku", "rising",
  "itidal", "takbir_transition", "sujood", "jalsa", "sujood",
  "second_rakah", "tashahhud", "taslim",
];

test("the journey follows the agreed order", () => {
  assert.deepEqual(fajr.order, EXPECTED_ORDER);
  assert.equal(fajr.order.length, 14, "the full prayer is 14 steps");
});

test("every step named in the order exists", () => {
  for (const id of fajr.order) {
    assert.ok(byId[id], `"order" names a step with no definition: "${id}"`);
  }
});

test("no step is defined twice", () => {
  const ids = fajr.steps.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate definitions: ${ids.join(", ")}`);
});

test("a step that happens twice is one definition, referenced twice", () => {
  const repeated = fajr.order.filter((id, i) => fajr.order.indexOf(id) !== i);
  assert.deepEqual([...new Set(repeated)].sort(), ["sujood", "takbir_transition"]);
  // resolving the order must hand back the very same object, so the content is
  // written and reviewed once and can never drift between the two occurrences
  const journey = fajr.order.map((id) => byId[id]);
  for (const id of new Set(repeated)) {
    const seen = journey.filter((s) => s.id === id);
    assert.ok(seen.length >= 2, `${id} should appear at least twice in the journey`);
    for (const s of seen) assert.equal(s, seen[0], `${id}: the occurrences are different objects`);
  }
});

test("every definition is actually used by the order", () => {
  for (const s of fajr.steps) {
    assert.ok(fajr.order.includes(s.id), `"${s.id}" is defined but never used`);
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

test("the previously written steps keep their exact texts", () => {
  assert.equal(byId.takbir.title.en, "Opening Takbir");
  assert.equal(byId.takbir.dhikr.arabic, "الله أكبر");
  assert.equal(byId.standing.instruction.en,
    "Stand upright, facing forward. Place your right hand over your left hand on your chest.");
  assert.equal(byId.ruku.dhikr.arabic, "سبحان ربي العظيم");
  assert.equal(byId.sujood.dhikr.arabic, "سبحان ربي الأعلى");
  assert.equal(byId.fatiha.title.ar, "قراءة الفاتحة");
});

test("the new steps carry TODO text, with no invented religious content", () => {
  const newOnes = ["takbir_transition", "rising", "itidal", "jalsa", "tashahhud", "taslim"];
  for (const id of newOnes) {
    assert.equal(byId[id].instruction.en, "TODO", `${id}: instruction should still be TODO`);
    assert.equal(byId[id].source, "TODO", `${id}: source should still be TODO`);
    assert.equal(byId[id].dhikr, undefined, `${id}: must not carry an unreviewed dhikr`);
  }
  // second_rakah carries only the procedural wording the team supplied
  assert.equal(byId.second_rakah.instruction.en, "Stand and repeat the same steps for the second rakah.");
  assert.equal(byId.second_rakah.source, "TODO");
});

test("the figure mapping covers the right steps and no others", () => {
  const withFigure = ["takbir", "standing", "fatiha", "takbir_transition", "ruku", "rising", "itidal", "sujood", "second_rakah"];
  const withoutFigure = ["jalsa", "tashahhud", "taslim"];
  assert.deepEqual(Object.keys(POSE_FOR_STEP).sort(), [...withFigure].sort());
  for (const id of withoutFigure) {
    assert.equal(POSE_FOR_STEP[id], undefined, `${id} should show no figure yet`);
  }
  // rising, itidal and the second rakah all settle on the standing pose
  for (const id of ["rising", "itidal", "second_rakah", "takbir_transition", "fatiha"]) {
    assert.equal(POSE_FOR_STEP[id], "standing", `${id} should use the standing pose`);
  }
  // every mapped step is a real step
  for (const id of Object.keys(POSE_FOR_STEP)) {
    assert.ok(byId[id], `POSE_FOR_STEP names an unknown step "${id}"`);
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
