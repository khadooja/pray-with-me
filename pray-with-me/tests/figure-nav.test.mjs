// Run: node tests/figure-nav.test.mjs   (or npm test)
//
// Navigation tests for the prayer figure, with a fake DOM and fake timers.
// These cover the crash reported from the browser:
//   "Cannot read properties of undefined (reading 'angles')" inside the animation loop.
// Root cause: requestAnimationFrame hands the callback the timestamp of the START of the
// frame, which can be earlier than the performance.now() captured when the animation was
// scheduled. That made `elapsed` negative, so the segment index became -1, path[-1] was
// undefined, and ALL_POSES[undefined].angles threw. The loop then died, leaving a blank
// or frozen figure. These tests drive the real module with a hostile clock.
import assert from "node:assert/strict";

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

// ---------------------------------------------------------------- fake DOM
let rafQueue = [];
let timerQueue = [];
let nextId = 1;
let clock = 0;
let rafTimeOffset = 0; // how far the rAF timestamp lags behind performance.now()
const errors = [];
const warnings = [];

function makeEl(tag = "div") {
  const el = {
    tagName: tag, className: "", _html: "", children: [], parent: null,
    style: {}, dataset: {}, onclick: null, textContent: "", removed: false,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
    },
    setAttribute(k, v) { el[k] = v; }, getAttribute(k) { return el[k]; },
    removeAttribute(k) { delete el[k]; },
    appendChild(c) { c.parent = el; el.children.push(c); return c; },
    remove() { el.removed = true; if (el.parent) el.parent.children = el.parent.children.filter((x) => x !== el); },
    focus() {},
    querySelector(sel) { return query(el, sel); },
    querySelectorAll(sel) { return queryAll(el, sel); },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; },
    set(v) { el._html = v; el.children = parseCards(v, el); },
  });
  return el;
}

// Parses just enough of the generated markup for these tests: the figure cards and
// the groups/elements the module looks up by selector.
function parseCards(html, parent) {
  const out = [];
  const sectionRe = /<section class="([^"]*)"([^>]*)>/g;
  let m;
  while ((m = sectionRe.exec(html))) {
    const sec = makeEl("section");
    sec.className = m[1];
    sec.parent = parent;
    for (const a of m[2].matchAll(/data-([\w-]+)="([^"]*)"/g)) {
      sec.dataset[a[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = a[2];
    }
    const svg = makeEl("svg");
    svg.className = "fig-svg";
    svg.parent = sec;
    for (const cls of ["fig-side", "fig-front", "fig-back"]) {
      const g = makeEl("g");
      g.className = `fig-layer ${cls}`;
      g.parent = svg;
      svg.children.push(g);
    }
    sec.children.push(svg);
    for (const act of html.includes('data-act="replay"') ? ["replay", "speed"] : []) {
      const b = makeEl("button");
      b.className = "vbtn";
      b.dataset.act = act;
      b.parent = sec;
      sec.children.push(b);
    }
    out.push(sec);
  }
  return out;
}

function walk(el, fn) {
  for (const c of el.children ?? []) { if (fn(c)) return c; const r = walk(c, fn); if (r) return r; }
  return null;
}
function matches(el, sel) {
  if (sel.startsWith(".")) return String(el.className).split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith("[")) {
    const m = /\[data-([\w-]+)(?:="([^"]*)")?\]/.exec(sel);
    if (!m) return false;
    const key = m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
    return m[2] === undefined ? el.dataset[key] !== undefined : el.dataset[key] === m[2];
  }
  return el.tagName === sel;
}
function query(root, sel) {
  const parts = sel.split(/\s*,\s*/);
  for (const p of parts) { const r = walk(root, (el) => matches(el, p)); if (r) return r; }
  return null;
}
function queryAll(root, sel) {
  const out = [];
  walk(root, (el) => { if (matches(el, sel)) out.push(el); return false; });
  return out;
}

globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = (fn) => {
  const id = nextId++;
  rafQueue.push({ id, fn });
  return id;
};
globalThis.cancelAnimationFrame = (id) => { rafQueue = rafQueue.filter((r) => r.id !== id); };
globalThis.setTimeout = (fn, ms) => { const id = nextId++; timerQueue.push({ id, fn, at: clock + (ms || 0) }); return id; };
globalThis.clearTimeout = (id) => { timerQueue = timerQueue.filter((t) => t.id !== id); };
globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.console.warn = (...a) => warnings.push(a.join(" "));

// advance the clock, firing timers and one animation frame per tick
function tick(ms = 16) {
  clock += ms;
  for (const t of timerQueue.filter((t) => t.at <= clock)) {
    timerQueue = timerQueue.filter((x) => x !== t);
    try { t.fn(); } catch (e) { errors.push(e); }
  }
  const due = rafQueue;
  rafQueue = [];
  for (const r of due) {
    // the hostile bit: the frame timestamp lags behind performance.now()
    try { r.fn(clock - rafTimeOffset); } catch (e) { errors.push(e); }
  }
}
function reset() { rafQueue = []; timerQueue = []; errors.length = 0; warnings.length = 0; clock = 1000; }

const { figureCard, setupFigure, diagramCard } = await import("../src/figure/figure.js");
const { POSE_FOR_STEP } = await import("../src/figure/poses.js");

const STEPS = [
  { id: "takbir", type: "guided", dhikr: { arabic: "a", transliteration: "b", meaning: { en: "c" }, audio: "" } },
  { id: "standing", type: "pose", check: "standing" },
  { id: "fatiha", type: "speech", reference: "x" },
  { id: "ruku", type: "pose", check: "ruku", dhikr: { arabic: "a", transliteration: "b", meaning: { en: "c" }, audio: "" } },
  { id: "sujood", type: "pose", check: "sujood", dhikr: { arabic: "a", transliteration: "b", meaning: { en: "c" }, audio: "" } },
];

// Mimics main.js: dispose the old step, replace the DOM, set the new one up.
function makeApp() {
  const app = makeEl("div");
  let current = null;
  return {
    app,
    go(step, { video = false } = {}) {
      current?.dispose();
      app.innerHTML = video ? `<section class="video-card"></section>` + diagramCard(step) : figureCard(step);
      current = setupFigure(app);
      return current;
    },
    dispose() { current?.dispose(); current = null; },
  };
}
const cards = (app) => queryAll(app, ".figure-card");
const pending = () => rafQueue.length + timerQueue.length;

// ---------------------------------------------------------------- tests

test("forward through every step leaves exactly one figure and throws nothing", () => {
  reset();
  rafTimeOffset = 0;
  const nav = makeApp();
  for (const step of STEPS) {
    nav.go(step);
    for (let i = 0; i < 12; i++) tick(60);
    const expected = POSE_FOR_STEP[step.id] ? 1 : 0;
    assert.equal(cards(nav.app).length, expected, `${step.id}: expected ${expected} figure card`);
  }
  nav.dispose();
  assert.deepEqual(errors, [], "no errors should be thrown");
});

test("a lagging animation-frame timestamp does not crash the loop (the reported bug)", () => {
  reset();
  // the frame timestamp arrives BEHIND performance.now(), which is what browsers do
  rafTimeOffset = 8;
  const nav = makeApp();
  nav.go(STEPS[1]); // standing
  nav.go(STEPS[4]); // sujood: the long staged descent
  for (let i = 0; i < 80; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "the animation loop must never throw");
  assert.equal(cards(nav.app).length, 1, "the figure must still be on screen");
  nav.dispose();
});

test("Back from sujood to ruku and to standing is clean", () => {
  for (const target of [STEPS[3], STEPS[1]]) {
    reset();
    rafTimeOffset = 8;
    const nav = makeApp();
    nav.go(STEPS[4]);
    for (let i = 0; i < 40; i++) tick(16);
    nav.go(target); // Back
    for (let i = 0; i < 60; i++) tick(16);
    assert.deepEqual(errors.map(String), [], `Back to ${target.id} threw`);
    assert.equal(cards(nav.app).length, 1, `Back to ${target.id}: expected one figure`);
    nav.dispose();
    assert.equal(pending(), 0, `Back to ${target.id}: callbacks still pending after dispose`);
  }
});

test("rapid Next/Back during the sujood descent leaves no stale callbacks", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  nav.go(STEPS[1]);
  tick(16);
  nav.go(STEPS[4]); // start the 3s descent
  tick(16);
  tick(16);
  nav.go(STEPS[3]); // interrupt immediately
  tick(16);
  nav.go(STEPS[4]); // and back again
  tick(16);
  nav.go(STEPS[0]);
  for (let i = 0; i < 40; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "rapid navigation threw");
  assert.equal(cards(nav.app).length, 1, "exactly one figure should remain");
  nav.dispose();
  assert.equal(pending(), 0, "no callbacks should outlive the step");
});

test("navigating during the cross-fade cancels the pending timers", () => {
  reset();
  rafTimeOffset = 4;
  const nav = makeApp();
  nav.go(STEPS[4]);
  for (let i = 0; i < 70; i++) tick(16); // run the descent to the cross-fade
  nav.go(STEPS[1]); // leaving sujood starts the reverse cross-fade, then navigate again
  tick(16);
  nav.go(STEPS[3]);
  for (let i = 0; i < 40; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "cross-fade navigation threw");
  assert.equal(cards(nav.app).length, 1);
  nav.dispose();
  assert.equal(pending(), 0, "cross-fade timers must be cancelled on navigation");
});

test("Replay during a running animation restarts cleanly", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  nav.go(STEPS[1]);
  tick(16);
  nav.go(STEPS[4]);
  for (let i = 0; i < 10; i++) tick(16);
  const replay = query(nav.app, '[data-act="replay"]');
  assert.ok(replay, "the replay button should exist");
  replay.onclick();
  for (let i = 0; i < 5; i++) tick(16);
  replay.onclick(); // and again mid-animation
  for (let i = 0; i < 60; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "replay threw");
  // one animation loop at most, not two stacked
  assert.ok(rafQueue.length <= 1, `expected at most one pending frame, saw ${rafQueue.length}`);
  nav.dispose();
  assert.equal(pending(), 0);
});

test("a step with no figure makes the next one start in its target pose, with no transition", () => {
  reset();
  rafTimeOffset = 0;
  const nav = makeApp();
  nav.go(STEPS[4]); // sujood
  for (let i = 0; i < 70; i++) tick(16);
  nav.go({ id: "unknown-step", type: "guided" }); // no pose for this step
  tick(16);
  assert.equal(cards(nav.app).length, 0, "a step without a pose shows no figure");
  nav.go(STEPS[3]); // ruku
  tick(16);
  const card = query(nav.app, ".figure-card");
  assert.equal(card.dataset.from, "", "the previous step had no figure, so there is nothing to move from");
  // with no from-pose it settles immediately instead of animating
  assert.equal(rafQueue.length, 0, "there should be no transition to run");
  assert.deepEqual(errors.map(String), []);
  nav.dispose();
});

test("an unknown pose name falls back instead of throwing, and warns once", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  nav.go(STEPS[1]);
  tick(16);
  // forge a card that claims to come from a keyframe that does not exist
  nav.dispose();
  nav.app.innerHTML = figureCard(STEPS[4]).replace('data-from="standing"', 'data-from="ghost-pose"');
  const ctl = setupFigure(nav.app);
  for (let i = 0; i < 70; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "an unknown pose must not throw");
  assert.equal(cards(nav.app).length, 1);
  ctl.dispose();
});

// ---------------------------------------------------------------- the real journey
const fajr = JSON.parse(
  (await import("node:fs")).readFileSync(new URL("../src/content/fajr.json", import.meta.url), "utf8")
);
const byId = Object.fromEntries(fajr.steps.map((s) => [s.id, s]));
const JOURNEY = fajr.order.map((id) => byId[id]);

test("the whole 14-step journey runs forward with no errors", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  for (const step of JOURNEY) {
    nav.go(step);
    for (let i = 0; i < 20; i++) tick(30);
    const expected = POSE_FOR_STEP[step.id] ? 1 : 0;
    assert.equal(cards(nav.app).length, expected, `${step.id}: expected ${expected} figure card`);
  }
  nav.dispose();
  assert.deepEqual(errors.map(String), [], "forward through the journey threw");
  assert.equal(pending(), 0, "callbacks left pending at the end of the journey");
});

test("the whole 14-step journey runs backward with no errors", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  for (const step of [...JOURNEY].reverse()) {
    nav.go(step);
    for (let i = 0; i < 20; i++) tick(30);
    const expected = POSE_FOR_STEP[step.id] ? 1 : 0;
    assert.equal(cards(nav.app).length, expected, `${step.id}: expected ${expected} figure card`);
  }
  nav.dispose();
  assert.deepEqual(errors.map(String), [], "walking back through the journey threw");
  assert.equal(pending(), 0);
});

test("stepping back and forth across every boundary of the journey is clean", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  for (let i = 0; i < JOURNEY.length - 1; i++) {
    nav.go(JOURNEY[i]);
    tick(30);
    nav.go(JOURNEY[i + 1]); // Next
    tick(30);
    nav.go(JOURNEY[i]);     // Back, mid-animation
    for (let k = 0; k < 6; k++) tick(30);
    assert.deepEqual(errors.map(String), [], `boundary ${JOURNEY[i].id} -> ${JOURNEY[i + 1].id} threw`);
  }
  nav.dispose();
  assert.equal(pending(), 0, "no callbacks should outlive the last step");
});

test("all four sujood occurrences are the same definition and each behaves", () => {
  reset();
  rafTimeOffset = 8;
  const positions = fajr.order.map((id, i) => (id === "sujood" ? i : -1)).filter((i) => i >= 0);
  assert.equal(positions.length, 4, "sujood happens four times across the two rakahs");
  for (const i of positions) {
    assert.equal(JOURNEY[i], JOURNEY[positions[0]], "every occurrence must be the one object");
  }
  const nav = makeApp();
  for (const i of positions) {
    nav.go(JOURNEY[i]);
    for (let k = 0; k < 70; k++) tick(16);
    assert.equal(cards(nav.app).length, 1, `sujood at position ${i} should show a figure`);
  }
  nav.dispose();
  assert.deepEqual(errors.map(String), []);
  assert.equal(pending(), 0);
});

test("both rakahs run end to end, forward then backward, with nothing left pending", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  for (const step of [...JOURNEY, ...[...JOURNEY].reverse()]) {
    nav.go(step);
    for (let i = 0; i < 12; i++) tick(40);
  }
  nav.dispose();
  assert.deepEqual(errors.map(String), [], "walking both rakahs threw");
  assert.equal(pending(), 0, "callbacks left pending after 48 navigations");
});

test("sujood -> sitting -> sujood and back throws no errors", () => {
  reset();
  rafTimeOffset = 8;
  const sujood = byId.sujood, jalsa = byId.jalsa, tashahhud = byId.tashahhud;
  const nav = makeApp();
  for (const step of [sujood, jalsa, sujood, jalsa, sujood]) {
    nav.go(step);
    for (let i = 0; i < 70; i++) tick(16);
    assert.equal(cards(nav.app).length, 1, `${step.id} should show a figure`);
  }
  // and the sitting steps at the end of the prayer
  for (const step of [tashahhud, byId.taslim, tashahhud]) {
    nav.go(step);
    for (let i = 0; i < 70; i++) tick(16);
    assert.equal(cards(nav.app).length, POSE_FOR_STEP[step.id] ? 1 : 0, `${step.id}`);
  }
  nav.dispose();
  assert.deepEqual(errors.map(String), [], "sitting navigation threw");
  assert.equal(pending(), 0, "callbacks left pending after the sitting steps");
});

test("interrupting the sujood -> sitting transition is clean", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  nav.go(byId.sujood);
  for (let i = 0; i < 70; i++) tick(16);
  nav.go(byId.jalsa);  // start rising to sitting
  tick(16);
  tick(16);
  nav.go(byId.sujood); // interrupt, go straight back down
  tick(16);
  nav.go(byId.jalsa);
  for (let i = 0; i < 60; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "interrupted sitting transition threw");
  assert.equal(cards(nav.app).length, 1);
  nav.dispose();
  assert.equal(pending(), 0);
});

test("tashahhud -> taslim -> back throws no errors", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  for (const step of [byId.tashahhud, byId.taslim, byId.tashahhud, byId.taslim]) {
    nav.go(step);
    for (let i = 0; i < 90; i++) tick(16); // long enough for the whole 5s head turn
    assert.equal(cards(nav.app).length, 1, `${step.id} should show a figure`);
  }
  nav.dispose();
  assert.deepEqual(errors.map(String), [], "taslim navigation threw");
  assert.equal(pending(), 0, "the head-turn loop must stop when the step is left");
});

test("leaving taslim mid-turn cancels the head-turn loop", () => {
  reset();
  rafTimeOffset = 8;
  const nav = makeApp();
  nav.go(byId.tashahhud);
  for (let i = 0; i < 20; i++) tick(16);
  nav.go(byId.taslim);
  for (let i = 0; i < 20; i++) tick(16); // partway through the turn
  nav.go(byId.sujood);                   // leave early
  for (let i = 0; i < 60; i++) tick(16);
  assert.deepEqual(errors.map(String), [], "interrupting the taslim turn threw");
  assert.equal(cards(nav.app).length, 1);
  nav.dispose();
  assert.equal(pending(), 0, "no head-turn frames should outlive the step");
});

// ---------------------------------------------------------------- practice again
// Mirrors main.js: "Practice again" remembers the step, and Next from there returns
// to the finish screen instead of continuing through the prayer.
function makeRouter() {
  const nav = makeApp();
  let current = null;
  let returnToFinishAfter = null;
  const api = {
    app: nav.app,
    at: () => current,
    go(i) {
      current = i;
      if (i === JOURNEY.length) { nav.go({ id: "__finish__", type: "guided" }); return; }
      nav.go(JOURNEY[i]);
    },
    practiceAgain(i) { returnToFinishAfter = i; api.go(i); },
    next() {
      if (returnToFinishAfter === current) { returnToFinishAfter = null; return api.go(JOURNEY.length); }
      api.go(current + 1);
    },
    back() { returnToFinishAfter = null; api.go(current - 1); },
    pendingReturn: () => returnToFinishAfter,
    dispose: nav.dispose,
  };
  return api;
}

test("Practice again jumps to the step and Next returns to the finish screen", () => {
  reset();
  rafTimeOffset = 8;
  const r = makeRouter();
  r.go(JOURNEY.length); // the finish screen
  for (let i = 0; i < 10; i++) tick(30);

  const target = fajr.order.indexOf("ruku");
  r.practiceAgain(target);
  for (let i = 0; i < 40; i++) tick(30);
  assert.equal(r.at(), target, "it should jump to the chosen step");

  r.next();
  for (let i = 0; i < 20; i++) tick(30);
  assert.equal(r.at(), JOURNEY.length, "Next must land back on the finish screen");
  assert.equal(r.pendingReturn(), null, "the pending return must be cleared");

  r.dispose();
  assert.deepEqual(errors.map(String), [], "the practice-again round trip threw");
  assert.equal(pending(), 0, "no callbacks should outlive the round trip");
});

test("Back during a practice-again cancels the return instead of trapping the user", () => {
  reset();
  rafTimeOffset = 8;
  const r = makeRouter();
  const target = fajr.order.indexOf("sujood");
  r.practiceAgain(target);
  for (let i = 0; i < 30; i++) tick(30);
  r.back();
  for (let i = 0; i < 20; i++) tick(30);
  assert.equal(r.pendingReturn(), null, "Back must clear the pending return");
  assert.equal(r.at(), target - 1, "Back should move one step back, not to the finish screen");
  r.next();
  for (let i = 0; i < 20; i++) tick(30);
  assert.equal(r.at(), target, "and Next then continues normally through the prayer");
  r.dispose();
  assert.deepEqual(errors.map(String), []);
  assert.equal(pending(), 0);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
