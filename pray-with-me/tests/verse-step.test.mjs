// Run: node tests/verse-step.test.mjs   (or npm test)
//
// The verse-by-verse Al-Fatihah step (src/ui/verse-step.js), driven in Node with a fake DOM,
// fake timers and fake speech. Every dependency is injected, so these tests cover the real
// controller: recording, checking, skipping, the single recorded attempt, the fallback paths
// and cleanup. No microphone, no model, no real timers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderVerseStep, verseStepHtml, FALLBACK_MODEL, FALLBACK_MIC, FALLBACK_SLOW }
  from "../src/ui/verse-step.js";
import { normalizeArabic } from "../src/speech/align.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const fajr = JSON.parse(read("../src/content/fajr.json"));
const en = JSON.parse(read("../src/i18n/en.json"));
const STEP = fajr.steps.find((s) => s.id === "fatiha");
const N = STEP.verses.length;

// The step is asynchronous, so tests are queued and awaited in order: a rejected
// assertion must fail its own test, not escape as an unhandled rejection.
let passed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

async function runAll() {
  for (const [name, fn] of queue) {
    // the controller logs expected failures (denied mic, transcription error) via
    // console.error; keep the test output readable without hiding real problems
    const realError = console.error;
    const noise = [];
    console.error = (...args) => noise.push(args);
    try {
      await fn();
      passed++;
      console.log(`ok   - ${name}`);
    } catch (err) {
      console.error = realError;
      console.error(`FAIL - ${name}`);
      console.error(err);
      process.exitCode = 1;
    } finally {
      console.error = realError;
    }
  }
  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
}

// ---------------------------------------------------------------- fake DOM
// Just enough: innerHTML, the four elements the step looks up by id, and insertAdjacentHTML.
function fakeRoot() {
  const root = {
    _html: "",
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.nodes = parse(v); },
    nodes: {},
    querySelector(sel) { return this.nodes[sel] ?? null; },
    insertAdjacentHTML(_where, html) { this._html = html + this._html; },
  };
  function el() {
    return {
      _text: "", disabled: false, onclick: null, innerHTML: "", className: "", hidden: true,
      removeAttribute() { this.hidden = false; },
      get textContent() { return this._text; },
      set textContent(v) { this._text = v; },
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    };
  }
  function parse(html) {
    const nodes = {};
    for (const id of ["rec", "model", "fb", "skip", "next", "verse-audio"]) {
      if (html.includes(`id="${id}"`)) nodes[`#${id}`] = el();
    }
    return nodes;
  }
  return root;
}

// a clock plus setInterval/clearInterval we can inspect
function fakeClock() {
  let t = 0;
  const timers = new Map();
  let next = 1;
  return {
    now: () => t,
    advance(ms) { t += ms; },
    setTimer(fn, ms) { const id = next++; timers.set(id, { fn, ms }); return id; },
    clearTimer(id) { timers.delete(id); },
    get pending() { return timers.size; },
    tick() { [...timers.values()].forEach((x) => x.fn()); },
  };
}

// speech stub: every recording resolves to the transcript the test chooses for that verse
function fakeSpeech({ transcripts = [], micError = null, takeMs = 0, clock = null } = {}) {
  const calls = { started: 0, stopped: 0, transcribed: 0 };
  return {
    calls,
    startRecording: async () => {
      if (micError) throw micError;
      calls.started++;
      return { stop: async () => { calls.stopped++; return new Float32Array(0); } };
    },
    transcribe: async () => {
      const text = transcripts[calls.transcribed] ?? "";
      calls.transcribed++;
      if (takeMs && clock) clock.advance(takeMs);
      return text;
    },
  };
}

// walks the whole step: presses Record then Done for each verse, following the button
async function runVerses(root, { verses = N, advance = true } = {}) {
  for (let i = 0; i < verses; i++) {
    await root.querySelector("#rec").onclick();  // Record
    await root.querySelector("#rec").onclick();  // Done -> check
    if (advance) await root.querySelector("#next").onclick(); // Next verse / Finish
  }
}

const verseText = (i) => normalizeArabic(STEP.verses[i].arabic);
const allCorrect = STEP.verses.map((_, i) => verseText(i));

function setup(opts = {}) {
  const root = fakeRoot();
  const clock = fakeClock();
  const speech = fakeSpeech({ ...opts.speech, clock });
  const attempts = [];
  const finished = [];
  const fallbacks = [];
  const dispose = renderVerseStep(STEP, root, "fatiha#1", {
    speech,
    recordAttempt: (key, ok) => attempts.push([key, ok]),
    onFinished: (allComplete, summary) => finished.push([allComplete, summary]),
    onFallback: (reason) => fallbacks.push(reason),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    hasWebGPU: opts.hasWebGPU ?? true,
    slowMs: opts.slowMs ?? 20000,
    asr: opts.asr ?? null,
  });
  return { root, clock, speech, attempts, finished, fallbacks, dispose };
}

// ---------------------------------------------------------------- the markup

test("the verse counter comes from the data, not a hardcoded number", () => {
  const html = verseStepHtml(STEP, 0);
  assert.ok(html.includes(`Verse 1 of ${N}`), `expected "Verse 1 of ${N}"`);
  assert.ok(verseStepHtml(STEP, N - 1).includes(`Verse ${N} of ${N}`));
  // the Sunnah card is still rendered, and is never one of the checked verses
  assert.ok(html.includes("sunnah-card"), "basmala and amin keep their own card");
});

test("one verse is shown at a time, with its own Arabic, transliteration and meaning", () => {
  const html = verseStepHtml(STEP, 2);
  assert.ok(html.includes(STEP.verses[2].arabic));
  assert.ok(html.includes(STEP.verses[2].transliteration));
  assert.ok(!html.includes(STEP.verses[4].arabic), "the other verses must not be on screen");
});

test("Listen only appears when that verse has its own audio file", () => {
  // no per-verse audio in the content today, so no per-verse player
  assert.ok(!verseStepHtml(STEP, 0).includes('id="verse-audio"'));
  const withAudio = { ...STEP, verses: STEP.verses.map((v, i) => (i === 0 ? { ...v, audio: "/audio/fatiha-1.mp3" } : v)) };
  const html = verseStepHtml(withAudio, 0);
  assert.ok(html.includes('id="verse-audio"') && html.includes("/audio/fatiha-1.mp3"));
  assert.ok(!verseStepHtml(withAudio, 1).includes('id="verse-audio"'), "only the verse that has one");
  // the whole-surah recitation stays available once, at the top
  assert.ok(html.includes(STEP.audio), "the full-surah player is still offered");
});

test("skip and the verse buttons use en.json wording", () => {
  const html = verseStepHtml(STEP, 0);
  assert.ok(html.includes(en.skip_verse));
  assert.ok(html.includes(en.start_reciting));
});

// ---------------------------------------------------------------- mock mode (?mock=1)

test("mock mode shows the missing-word path on verse 1, then completes", async () => {
  // the real transcribe() resolves its mockText argument in mock mode, so echoing it
  // reproduces exactly what ?mock=1 does in the browser
  const root = fakeRoot();
  const clock = fakeClock();
  const attempts = [];
  const finished = [];
  const dispose = renderVerseStep(STEP, root, "fatiha#1", {
    mock: true,
    speech: {
      startRecording: async () => ({ stop: async () => new Float32Array(0) }),
      transcribe: async (_audio, mockText) => mockText,
    },
    recordAttempt: (key, ok) => attempts.push([key, ok]),
    onFinished: (ok) => finished.push(ok),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });

  await root.querySelector("#rec").onclick();
  await root.querySelector("#rec").onclick(); // verse 1, first attempt
  assert.ok(root.querySelector("#fb").innerHTML.includes("العالمين"),
    "mock drops the last word of verse 1 so the missing-word UI is demonstrable");

  await root.querySelector("#rec").onclick();
  await root.querySelector("#rec").onclick(); // retry verse 1
  assert.ok(root.querySelector("#fb").innerHTML.includes(en.verse_complete.slice(0, 20)));
  await root.querySelector("#next").onclick();

  for (let i = 1; i < N; i++) {
    await root.querySelector("#rec").onclick();
    await root.querySelector("#rec").onclick();
    await root.querySelector("#next").onclick();
  }
  assert.deepEqual(attempts, [["fatiha#1", true]], "a mock run reaches the success sheet");
  assert.deepEqual(finished, [true]);
  dispose();
});

// ---------------------------------------------------------------- the happy path

test("reciting every verse correctly records exactly one successful attempt", async () => {
  const s = setup({ speech: { transcripts: allCorrect } });
  await runVerses(s.root);
  assert.deepEqual(s.attempts, [["fatiha#1", true]], "one attempt, for the step, true");
  assert.equal(s.finished.length, 1, "onFinished fires once");
  assert.equal(s.finished[0][0], true, "all verses complete");
  assert.equal(s.speech.calls.transcribed, N, "one transcription per verse, nothing extra");
  assert.equal(s.speech.calls.stopped, N, "every recording was stopped");
  s.dispose();
  assert.deepEqual(s.attempts, [["fatiha#1", true]], "dispose must not add a second attempt");
});

test("each verse is checked against its own words only", async () => {
  // verse 2's text submitted for verse 1 must fail verse 1
  const transcripts = [verseText(1), ...allCorrect.slice(1)];
  const s = setup({ speech: { transcripts } });
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick();
  const fb = s.root.querySelector("#fb");
  assert.ok(fb.innerHTML.includes(en.speech_missing.slice(0, 20)), "verse 1 should report missing words");
  assert.ok(fb.innerHTML.includes("الحمد"), "and name a word from verse 1");
});

test("one bad verse means one failed attempt and no success sheet", async () => {
  const bad = [...allCorrect];
  bad[3] = verseText(3).split(" ").slice(0, 1).join(" "); // verse 4, most words dropped
  const s = setup({ speech: { transcripts: bad } });
  await runVerses(s.root);
  assert.deepEqual(s.attempts, [["fatiha#1", false]]);
  assert.equal(s.finished[0][0], false, "the success sheet must not be shown");
  assert.equal(s.finished[0][1].byVerse[3].status, "incomplete", "and the bad verse is identified");
});

test("the way forward appears only once the verse has a result", async () => {
  const s = setup({ speech: { transcripts: allCorrect } });
  assert.ok(s.root.innerHTML.includes('id="next" hidden'), "nothing to carry forward yet");
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick();
  assert.equal(s.root.querySelector("#next").hidden, false, "revealed after the check");
  // and retrying the same verse is still offered
  assert.equal(s.root.querySelector("#rec").textContent, en.try_verse_again);
});

test("a verse failed then recited correctly still completes the step", async () => {
  const transcripts = [verseText(0).split(" ").slice(0, 2).join(" "), ...allCorrect];
  const s = setup({ speech: { transcripts } });
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick(); // verse 1, incomplete
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick(); // retry verse 1, complete
  await s.root.querySelector("#next").onclick();
  for (let i = 1; i < N; i++) {
    await s.root.querySelector("#rec").onclick();
    await s.root.querySelector("#rec").onclick();
    await s.root.querySelector("#next").onclick();
  }
  assert.deepEqual(s.attempts, [["fatiha#1", true]], "the retry counts: one successful attempt");
  assert.equal(s.finished[0][0], true);
});

// ---------------------------------------------------------------- skipping

test("skipping a verse advances without recording it as passed", async () => {
  const s = setup({ speech: { transcripts: allCorrect } });
  await s.root.querySelector("#skip").onclick();        // skip verse 1 straight away
  assert.ok(s.root.innerHTML.includes(`Verse 2 of ${N}`), "it moved on");
  for (let i = 1; i < N; i++) {
    await s.root.querySelector("#rec").onclick();
    await s.root.querySelector("#rec").onclick();
    await s.root.querySelector("#next").onclick();
  }
  assert.deepEqual(s.attempts, [["fatiha#1", false]], "a skipped verse cannot pass the step");
  assert.equal(s.finished[0][1].byVerse[0].status, "skipped");
  assert.equal(s.speech.calls.started, N - 1, "the skipped verse never opened the mic");
});

test("skipping every verse still finishes the step, once, without the mic", async () => {
  const s = setup({ speech: { transcripts: [] } });
  for (let i = 0; i < N; i++) await s.root.querySelector("#skip").onclick();
  assert.deepEqual(s.attempts, [["fatiha#1", false]]);
  assert.equal(s.finished.length, 1);
  assert.equal(s.speech.calls.started, 0, "no recording at all");
});

// ---------------------------------------------------------------- checking… seconds

test("the elapsed-seconds ticker runs while checking and is always cleared", async () => {
  const s = setup({ speech: { transcripts: allCorrect } });
  await s.root.querySelector("#rec").onclick(); // Record
  assert.equal(s.clock.pending, 0, "no timer while recording");
  await s.root.querySelector("#rec").onclick(); // Done -> check finished synchronously here
  assert.equal(s.clock.pending, 0, "the ticker is cleared once the check returns");
  s.dispose();
  assert.equal(s.clock.pending, 0, "nothing pending after dispose");
});

test("the checking line counts seconds from en.json", async () => {
  const clockText = en.checking_seconds.replace("{s}", "0");
  assert.ok(clockText.length, "the key must exist");
  const s = setup({ speech: { transcripts: allCorrect } });
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick();
  s.dispose();
});

// ---------------------------------------------------------------- fallbacks

test("a failed model load falls back without ever asking for the microphone", async () => {
  const s = setup({ asr: { status: "error", pct: 0, listeners: new Set() }, speech: { transcripts: allCorrect } });
  await s.root.querySelector("#rec").onclick();
  assert.deepEqual(s.fallbacks, [FALLBACK_MODEL]);
  assert.equal(s.speech.calls.started, 0, "the mic must not be requested when the model is broken");
  assert.deepEqual(s.attempts, [], "a fallback is not an attempt");
});

test("a denied microphone falls back once and leaves nothing recording", async () => {
  const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
  const s = setup({ speech: { micError: denied } });
  await s.root.querySelector("#rec").onclick();
  assert.deepEqual(s.fallbacks, [FALLBACK_MIC]);
  assert.equal(s.speech.calls.started, 0);
  assert.equal(s.clock.pending, 0);
  // a second press must not fire the fallback again
  await s.root.querySelector("#rec").onclick?.();
  assert.equal(s.fallbacks.length, 1, "the fallback happens once");
});

test("a very slow check on a device without WebGPU falls back", async () => {
  const s = setup({ hasWebGPU: false, slowMs: 1000, speech: { transcripts: allCorrect, takeMs: 5000 } });
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick();
  assert.deepEqual(s.fallbacks, [FALLBACK_SLOW]);
  assert.equal(s.clock.pending, 0, "the ticker is cleared on the way out");
});

test("a slow check on a WebGPU device keeps going, with a note", async () => {
  const s = setup({ hasWebGPU: true, slowMs: 1000, speech: { transcripts: allCorrect, takeMs: 5000 } });
  await s.root.querySelector("#rec").onclick();
  await s.root.querySelector("#rec").onclick();
  assert.deepEqual(s.fallbacks, [], "WebGPU devices are not pushed to listen-and-repeat");
  assert.ok(s.root.querySelector("#fb").innerHTML.includes(en.checking_slow.slice(0, 20)));
});

// ---------------------------------------------------------------- leaving the step

test("leaving after recording records exactly one failed attempt", async () => {
  const s = setup({ speech: { transcripts: allCorrect } });
  await s.root.querySelector("#rec").onclick(); // started recording verse 1
  s.dispose();
  assert.deepEqual(s.attempts, [["fatiha#1", false]], "a started-but-unfinished step counts as a try");
  assert.equal(s.speech.calls.stopped, 1, "the microphone was released");
  s.dispose();
  assert.equal(s.attempts.length, 1, "dispose is idempotent");
});

test("leaving without recording anything records nothing", () => {
  const s = setup({ speech: { transcripts: allCorrect } });
  s.dispose();
  assert.deepEqual(s.attempts, [], "just looking at the step is not an attempt");
  assert.equal(s.clock.pending, 0);
});

test("the model status line follows asr and unsubscribes on dispose", () => {
  const asr = { status: "loading", pct: 42, listeners: new Set() };
  const s = setup({ asr, speech: { transcripts: allCorrect } });
  assert.equal(asr.listeners.size, 1, "the step listens while it is on screen");
  assert.ok(s.root.querySelector("#model").textContent.includes("42"));
  s.dispose();
  assert.equal(asr.listeners.size, 0, "and stops listening when it leaves");
});

await runAll();
