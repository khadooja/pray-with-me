// Run: node tests/speech-switch.test.mjs   (or npm test)
//
// The Al-Fatihah recitation check sits behind SPEECH_CHECK_ENABLED. With it off the step
// must be purely guided: no microphone, no model download, no verdict, nothing recorded.
// These tests prove that by rendering the step with the microphone and Worker replaced by
// stubs that throw if anything touches them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPEECH_CHECK_ENABLED, shouldPreloadASR } from "../src/config.js";
import { footerKey, speechChecksKey, speechChecked } from "../src/ui/scope.js";
import { listenStepHtml, renderListenStep, ready } from "../src/ui/listen-step.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const fajr = JSON.parse(read("../src/content/fajr.json"));
const en = JSON.parse(read("../src/i18n/en.json"));
const FATIHA = fajr.steps.find((s) => s.id === "fatiha");

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

// ---------- the switch itself ----------
test("the recitation check is off, so user testing runs without it", () => {
  assert.equal(SPEECH_CHECK_ENABLED, false,
    "if this is deliberately turned on, update the README section too");
});

test("no Whisper model is downloaded while the check is off", () => {
  assert.equal(shouldPreloadASR(), false, "the app must not fetch the speech model");
});

// ---------- the listen-and-repeat step ----------
// A fake DOM just big enough to render into, with the microphone and Worker booby-trapped.
function sandbox(run) {
  const root = {
    _html: "",
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    querySelector() { return { onclick: null }; },
  };
  // navigator is getter-only in Node, so swap it with defineProperty and put it back after
  const savedNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const savedWorker = globalThis.Worker;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    get() {
      return { get mediaDevices() { throw new Error("the listen step must never request the microphone"); } };
    },
  });
  globalThis.Worker = function () { throw new Error("the listen step must never load the speech model"); };
  try { return run(root); } finally {
    if (savedNav) Object.defineProperty(globalThis, "navigator", savedNav);
    else delete globalThis.navigator;
    globalThis.Worker = savedWorker;
  }
}

test("the listen step renders without touching the microphone or the model", () => {
  sandbox((root) => {
    renderListenStep(FATIHA, root, () => {});
    assert.ok(root.innerHTML.includes(FATIHA.reference), "the verses must be shown");
  });
});

test("the listen step offers a continue button that fires once", () => {
  let done = 0;
  const btn = { onclick: null };
  const root = { innerHTML: "", querySelector: () => btn };
  renderListenStep(FATIHA, root, () => done++);
  assert.ok(typeof btn.onclick === "function", "there must be a button to continue");
  btn.onclick();
  assert.equal(done, 1, "continuing must call back exactly once");
  const escaped = en.i_have_recited.replace(/'/g, "&#39;");
  assert.ok(listenStepHtml(FATIHA).includes(escaped), "the button uses the en.json label");
});

test("the listen step cannot record, judge, or ask for audio: it imports none of that", () => {
  const src = read("../src/ui/listen-step.js");
  // only real import statements count; the file mentions these modules in comments
  // precisely to explain why it does NOT import them
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["../i18n/index.js"], `unexpected imports: ${imports.join(", ")}`);
  const code = src.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assert.ok(!/recordAttempt|compareRecitation|transcribe|startRecording|getUserMedia/.test(code),
    "it must not record attempts or judge a recitation");
});

test("placeholder content never reaches the screen", () => {
  // the content owner has not filled these in yet
  assert.equal(FATIHA.transliteration, "TODO");
  assert.equal(FATIHA.meaning, "TODO");
  assert.equal(FATIHA.audio, "TODO");
  const html = listenStepHtml(FATIHA);
  assert.ok(!html.includes("TODO"), "the word TODO must never be shown to a user");
  assert.ok(!html.includes("<audio"), "no audio player while the file is still a placeholder");

  // ...and once the content is real, it does show
  const filled = { ...FATIHA, transliteration: "Alhamdu lillah", meaning: "Praise be to Allah", audio: "/audio/fatiha.mp3" };
  const full = listenStepHtml(filled);
  assert.ok(full.includes("Alhamdu lillah") && full.includes("Praise be to Allah"));
  assert.ok(full.includes("<audio") && full.includes("/audio/fatiha.mp3"));
});

test("ready() treats TODO and blanks as not ready", () => {
  for (const v of ["TODO", "", "   ", null, undefined]) assert.equal(ready(v), false, `"${v}"`);
  assert.equal(ready("/audio/x.mp3"), true);
});

// ---------- the scope wording follows the switch ----------
test("the scope text says recitation is not checked while the switch is off", () => {
  assert.equal(footerKey(false), "footer_no_speech");
  assert.equal(speechChecksKey(false), "checks_speech_off");
  assert.equal(speechChecked(false), false);
  assert.ok(/not checked/i.test(en.checks_speech_off), "the step line must say it is not checked");
  assert.ok(/not checked/i.test(en.footer_no_speech), "the footer must say recitation is not checked");
  assert.ok(!/completeness of recitation/i.test(en.footer_no_speech),
    "the footer must not claim a recitation check while it is off");
});

test("the scope text claims the check only when the switch is on", () => {
  assert.equal(footerKey(true), "footer");
  assert.equal(speechChecksKey(true), "checks_speech_on");
  assert.ok(/Al-Fatihah/i.test(en.checks_speech_on), "the on wording should name what is checked");
});

test("the live wording matches the live switch", () => {
  assert.equal(footerKey(), footerKey(SPEECH_CHECK_ENABLED));
  assert.equal(speechChecksKey(), speechChecksKey(SPEECH_CHECK_ENABLED));
});

// ---------- the README cannot drift from the code ----------
test("the README states the same switch value as config.js", () => {
  const config = read("../src/config.js");
  const m = /export const SPEECH_CHECK_ENABLED = (true|false);/.exec(config);
  assert.ok(m, "SPEECH_CHECK_ENABLED must stay a plain boolean literal so the docs can be checked");
  const value = m[1];
  const readme = read("../README.md");
  assert.ok(readme.includes("SPEECH_CHECK_ENABLED"), "the README must mention the switch");
  assert.ok(readme.includes(`currently **\`${value}\`**`),
    `the README says a different value than config.js (${value}) — update the README`);
  if (value === "false") {
    assert.ok(/No microphone is requested/i.test(readme), "the README must say no microphone is used");
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
