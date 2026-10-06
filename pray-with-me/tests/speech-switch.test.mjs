// Run: node tests/speech-switch.test.mjs   (or npm test)
//
// The Al-Fatihah recitation check sits behind SPEECH_CHECK_ENABLED, currently ON (verse by
// verse). These tests also pin the OFF-state fallback (listen-and-repeat): it still runs
// automatically whenever the switch is off, or the model/mic/device can't support the check,
// and must stay purely guided — no microphone, no model download, no verdict, nothing recorded.
// They prove that by rendering the step with the microphone and Worker replaced by stubs that
// throw if anything touches them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SPEECH_CHECK_ENABLED, shouldPreloadASR, isMobileDevice, asrDtype, asrSizeMB,
  ASR_DTYPE_DESKTOP, ASR_DTYPE_MOBILE, ASR_SIZE_MB,
  SLOW_TRANSCRIBE_MS, SLOW_TRANSCRIBE_MS_MOBILE, slowTranscribeMs,
} from "../src/config.js";
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
test("the recitation check is on: verse-by-verse checking runs for real users", () => {
  assert.equal(SPEECH_CHECK_ENABLED, true,
    "if this is deliberately turned off again, update the README section and this test too");
});

test("the speech model preloads once the check is on (outside mock mode)", () => {
  assert.equal(shouldPreloadASR(), true, "the app must fetch the speech model when the check is live");
});

test("the model is only ever loaded from one decision point, reached at step 1", () => {
  const main = read("../src/main.js");
  // preloadASR is called from exactly one place, behind shouldPreloadASR()
  assert.equal((main.match(/\bpreloadASR\(/g) || []).length, 1, "exactly one call site");
  assert.ok(/function ensureAsrPreload\(\)[\s\S]*?shouldPreloadASR\(\)/.test(main),
    "the switch must gate the preload");
  assert.ok(/if \(current === 0\) ensureAsrPreload\(\);/.test(main),
    "loading starts when the user reaches the first journey step, not at app load");
  assert.ok(!/^if \(shouldPreloadASR\(\)\) startAsrPreload\(\);/m.test(main),
    "it must not run at module scope any more");
});

test("the verse check is only reachable while the switch is on", () => {
  const main = read("../src/main.js");
  assert.ok(/SPEECH_CHECK_ENABLED\s*\n?\s*\?\s*startVerseCheck/.test(main),
    "the verse-by-verse step sits on the true branch");
  assert.ok(/:\s*renderListenStep/.test(main), "and listen-and-repeat on the false branch");
});

test("the listen-and-repeat step still has no way to reach the microphone or the model", () => {
  // the fallback view is what runs while the switch is off, and after any fallback
  const src = read("../src/ui/listen-step.js");
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.ok(!imports.some((i) => i.includes("speech")), `unexpected speech import: ${imports.join(", ")}`);
  assert.ok(!imports.some((i) => i.includes("progress")), "it must not record attempts either");
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
    // the verses are rendered one by one now, so check the first and last of them
    const html = root.innerHTML;
    assert.ok(FATIHA.verses.length, "the fatiha step must carry its verses");
    for (const v of FATIHA.verses) assert.ok(html.includes(v.arabic), `missing verse: ${v.arabic}`);
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
  // step-content.js is pure HTML building: no microphone, no model, no progress store
  assert.deepEqual(imports, ["../i18n/index.js", "./step-content.js"],
    `unexpected imports: ${imports.join(", ")}`);
  const helper = read("../src/ui/step-content.js");
  const helperImports = [...helper.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(helperImports, ["../i18n/index.js"], "the HTML builders must import nothing else");
  const code = src.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assert.ok(!/recordAttempt|compareRecitation|transcribe|startRecording|getUserMedia/.test(code),
    "it must not record attempts or judge a recitation");
});

test("placeholder content never reaches the screen", () => {
  // the content has arrived: the recording exists and the player points at it
  assert.equal(FATIHA.audio, "/audio/fatiha.mp3");
  const html = listenStepHtml(FATIHA);
  assert.ok(!html.includes("TODO"), "the word TODO must never be shown to a user");
  assert.ok(html.includes("<audio") && html.includes("/audio/fatiha.mp3"));

  // ...and a step whose content is still missing shows nothing instead of "TODO"
  const empty = {
    ...FATIHA,
    audio: "TODO",
    verses: FATIHA.verses.map((v) => ({ ...v, transliteration: "TODO", meaning: "TODO" })),
    sunnahVerses: [],
  };
  const bare = listenStepHtml(empty);
  assert.ok(!bare.includes("TODO"), "a TODO field must hide its own line");
  assert.ok(!bare.includes("<audio"), "no audio player while the file is still a placeholder");
  // the Arabic itself still shows, because that part is reviewed and present
  for (const v of FATIHA.verses) assert.ok(bare.includes(v.arabic));
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
  // the check is per verse, and it is word completeness + order only — never pronunciation
  for (const text of [en.checks_speech_on, en.footer]) {
    assert.ok(/verse/i.test(text), `the on wording must say the check is per verse: "${text}"`);
    assert.ok(/order/i.test(text), "and that it is about word order");
    assert.ok(/not checked:|does not assess/i.test(text), "and must state what it does NOT check");
    assert.ok(/pronunciation|tajweed/i.test(text), "pronunciation and tajweed are explicitly excluded");
  }
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

// ---------- which model files are downloaded (dtype) ----------
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", maxTouchPoints: 5 };
const IPAD_AS_MAC = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", maxTouchPoints: 5 };
const ANDROID = { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36", maxTouchPoints: 5 };
const MAC = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36", maxTouchPoints: 0 };
const WINDOWS = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36", maxTouchPoints: 0 };

test("phones and tablets (including an iPad that reports itself as a Mac) get the small q4 files", () => {
  for (const nav of [IPHONE, IPAD_AS_MAC, ANDROID]) {
    assert.equal(isMobileDevice(nav), true, nav.userAgent);
    assert.deepEqual(asrDtype(nav), ASR_DTYPE_MOBILE);
    assert.equal(asrSizeMB(nav), ASR_SIZE_MB.mobile);
  }
});

test("computers keep the full fp32 files", () => {
  for (const nav of [MAC, WINDOWS]) {
    assert.equal(isMobileDevice(nav), false, nav.userAgent);
    assert.deepEqual(asrDtype(nav), ASR_DTYPE_DESKTOP);
    assert.equal(asrSizeMB(nav), ASR_SIZE_MB.desktop);
  }
});

test("no device ever gets the q8/int8/uint8 encoder, which fails to load (ConvInteger)", () => {
  for (const d of [ASR_DTYPE_DESKTOP, ASR_DTYPE_MOBILE]) {
    assert.ok(["fp32", "q4"].includes(d.encoder_model), `encoder dtype ${d.encoder_model} was not measured to work`);
    assert.ok(["fp32", "q4"].includes(d.decoder_model_merged), `decoder dtype ${d.decoder_model_merged} was not measured to work`);
  }
});

test("the worker passes the dtype explicitly (the library's wasm default is the broken q8)", () => {
  assert.match(read("../src/speech/asr.worker.js"), /dtype:\s*asrDtype\(\)/);
});

test("the worker downloads the model without a Referer (Hugging Face 404s *.workers.dev referers)", () => {
  assert.match(read("../src/speech/asr.worker.js"), /referrerPolicy:\s*"no-referrer"/);
});

test("the worker only picks WebGPU when the device actually gives it an adapter", () => {
  assert.match(read("../src/speech/asr.worker.js"), /navigator\.gpu\.requestAdapter\(\)/);
});

test("phones get more time per verse before the 'too slow' fallback (a real iPhone took 22 s)", () => {
  assert.equal(slowTranscribeMs(IPHONE), SLOW_TRANSCRIBE_MS_MOBILE);
  assert.ok(SLOW_TRANSCRIBE_MS_MOBILE > 22000, "must not throw away a 22 s result on a phone");
  assert.equal(slowTranscribeMs(WINDOWS), SLOW_TRANSCRIBE_MS);
  assert.match(read("../src/ui/verse-step.js"), /slowMs = slowTranscribeMs\(\)/);
});

test("the loading line shows the size for this device, not a fixed number", () => {
  assert.ok(en.model_loading.includes("{size}"), "model_loading must keep the {size} placeholder");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
