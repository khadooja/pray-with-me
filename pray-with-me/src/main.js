// App shell: a tiny step "router" over src/content/fajr.json.
// Each step type (guided / pose / speech) renders its own practice area and
// returns a cleanup function that go() calls before showing another step.
import fajr from "./content/fajr.json";
import { USE_MOCK, POSE_HOLD_SECONDS, HINT_AFTER_SECONDS } from "./config.js";
import { t, has } from "./i18n/index.js";
import { recordAttempt, journeyAttemptKeys } from "./progress/store.js";
import { evaluatePose, resetPoseMock } from "./pose/index.js";
import { startCamera, stopCamera, runPoseLoop, shouldMirror } from "./pose/detector.js";
import { preloadASR, startRecording, transcribe, compareRecitation } from "./speech/index.js";
import { unlockAudio, playSuccess, playHint, vibrateSuccess } from "./ui/sound.js";
import { renderSetup } from "./ui/setup.js";
import { videoCard, setupVideo } from "./ui/video.js";
import { figureCard, diagramCard, setupFigure } from "./figure/figure.js";
import { showSuccessSheet, showConfirmSheet, dismissSheet } from "./ui/sheet.js";

// The journey is fajr.json's "order" resolved into step definitions.
// A step that happens twice (takbir_transition, sujood) is defined once and listed
// twice in "order", so the same object appears twice here — written and reviewed once.
// If "order" is missing (an older content branch), fall back to the definition order.
const byId = Object.fromEntries(fajr.steps.map((s) => [s.id, s]));
const steps = (fajr.order ?? fajr.steps.map((s) => s.id))
  .map((id) => {
    const step = byId[id];
    if (!step) console.warn(`[content] fajr.json "order" names a step that does not exist: "${id}"`);
    return step;
  })
  .filter(Boolean);

// مفتاح تسجيل المحاولات لكل موضع في الرحلة: sujood#1 و sujood#2 ...
const ATTEMPT_KEYS = journeyAttemptKeys(steps);
const app = document.getElementById("app");
let current = 0;
let cleanup = null;
let currentVideo = null; // demo video controller of the step on screen (see ui/video.js)

// The camera setup screen is shown once per visit, before the first pose step.
const FIRST_POSE = steps.findIndex((s) => s.type === "pose");
let setupSeen = false;
const MAX_HINTS = 3;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function go(i) {
  dismissSheet(); // a sheet must never linger onto the next step
  cleanup?.();
  cleanup = null;
  current = Math.max(0, Math.min(i, steps.length));
  window.scrollTo(0, 0);
  if (current === FIRST_POSE && !setupSeen) showSetup(current, current > 0 ? () => go(current - 1) : null);
  else if (current === steps.length) renderFinished();
  else renderStep(steps[current]);
}

// Setup screen for step i. "I'm ready" opens step i; onBack is where Back goes.
function showSetup(i, onBack) {
  cleanup?.();
  cleanup = null;
  current = i;
  window.scrollTo(0, 0);
  app.innerHTML = `${header()}<section id="setup"></section>${footer()}`;
  wireClose();
  renderSetup(app.querySelector("#setup"), {
    onReady: () => {
      setupSeen = true;
      go(i);
    },
    onBack,
  });
}

// ---------- layout ----------

// Top bar: close button + progress bar. The "Step X of N" wording is no longer
// shown, but it stays as the progress bar's aria-label for screen readers.
function header({ progress = true, close = true } = {}) {
  const n = steps.length;
  const x = Math.min(current + 1, n);
  return `
    <header class="top">
      ${close ? `<button type="button" class="icon-btn" id="close" aria-label="${esc(t("close"))}">✕</button>` : ""}
      ${
        progress
          ? `<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${x}"
               aria-label="${esc(t("step_of", { x, n }))}"><div class="progress-fill" style="width:${(x / n) * 100}%"></div></div>`
          : ""
      }
      ${USE_MOCK ? `<span class="badge">${esc(t("mock_mode"))}</span>` : ""}
    </header>`;
}

// Wires the close button, if the rendered header has one.
function wireClose() {
  const btn = app.querySelector("#close");
  if (!btn) return;
  btn.onclick = () =>
    showConfirmSheet({
      title: t("close_confirm_title"),
      text: t("close_confirm_text"),
      cancelLabel: t("stay"),
      confirmLabel: t("leave"),
      onConfirm: () => go(0),
    });
}

// The sheet that slides up after a step is passed. Guided steps never call this.
// The explaining sentence is optional: a step without an explain_* key just omits it.
function celebrate(key) {
  showSuccessSheet({
    title: t("success_title"),
    text: has(`explain_${key}`) ? t(`explain_${key}`) : "",
    onContinue: () => go(current + 1),
  });
}

function footer() {
  return `<footer class="footer">${esc(t("footer"))}</footer>`;
}

// hasVideo: the demo clip already has the voice, so the audio player stays hidden
// (ui/video.js reveals it again if the clip fails to load).
function dhikrCard(d, hasVideo = false) {
  if (!d) return "";
  return `
    <section class="card dhikr">
      <p class="arabic" dir="rtl" lang="ar">${esc(d.arabic)}</p>
      <p class="translit">${esc(d.transliteration)}</p>
      <p class="meaning">${esc(d.meaning?.en)}</p>
      ${d.audio ? `<audio class="dhikr-audio" controls preload="none" src="${esc(d.audio)}"${hasVideo ? " hidden" : ""}></audio>` : ""}
    </section>`;
}

// A step shows its demo video when it has one, otherwise the drawn figure.
// Sujood is the exception: the seven-points diagram is reference material, so it
// stays below the video rather than being replaced by it.
function mediaFor(step) {
  const video = videoCard(step);
  return video ? video + diagramCard(step) : figureCard(step);
}

function renderStep(step) {
  const isLast = current === steps.length - 1;
  app.innerHTML = `
    ${header()}
    ${current > 0 ? `<button type="button" class="link back-link" id="back">‹ ${esc(t("back"))}</button>` : ""}
    <h1>${esc(step.title.en)} <span class="ar" dir="rtl" lang="ar">${esc(step.title.ar)}</span></h1>
    <p class="instruction">${esc(step.instruction.en)}</p>
    ${step.type === "pose" ? `<p class="checks">${esc(t(`checks_${step.check}`))}</p>` : ""}
    ${mediaFor(step)}
    ${dhikrCard(step.dhikr, Boolean(step.video))}
    <section class="practice" id="practice"></section>
    ${footer()}
    <div class="bottom-spacer"></div>
    <div class="bottom-bar">
      <button class="btn block" id="next">${esc(t(isLast ? "finish" : "next"))}</button>
    </div>`;

  wireClose();
  if (current > 0) app.querySelector("#back").onclick = () => go(current - 1);
  app.querySelector("#next").onclick = () => go(current + 1);

  // If the video file turns out to be broken, swap the full animated figure in.
  let figure = setupFigure(app);
  const video = setupVideo(app, {
    onError: () => {
      figure.dispose();
      // drop the static diagram first, so we don't end up with two figure cards
      app.querySelector("[data-diagram]")?.remove();
      // the figure belongs above the dhikr card, in the slot the video just vacated
      const slot = app.querySelector(".dhikr") || app.querySelector("#practice");
      slot?.insertAdjacentHTML("beforebegin", figureCard(step));
      figure = setupFigure(app);
    },
  });
  currentVideo = video;

  const practice = app.querySelector("#practice");
  let stepCleanup = null;
  // المحاولات تُسجَّل بموضع الخطوة في الرحلة (sujood#1 و sujood#2)، مو باسمها فقط
  const attemptKey = ATTEMPT_KEYS[current] ?? step.id;
  if (step.type === "pose") stepCleanup = renderPose(step, practice, attemptKey);
  else if (step.type === "speech") stepCleanup = renderSpeech(step, practice, attemptKey);
  cleanup = () => {
    video.dispose();
    figure.dispose();
    if (currentVideo === video) currentVideo = null;
    stepCleanup?.();
  };
}

function renderFinished() {
  app.innerHTML = `
    ${header({ progress: false, close: false })}
    <h1>${esc(t("finished_title"))}</h1>
    <p class="instruction">${esc(t("finished_text"))}</p>
    <nav class="nav"><button class="btn" id="again">${esc(t("start_again"))}</button></nav>
    ${footer()}`;
  app.querySelector("#again").onclick = () => go(0);
}

// ---------- pose step ----------

function renderPose(step, root, attemptKey) {
  root.innerHTML = `
    <p class="hint">${esc(t("camera_hint"))}
      <button class="link" id="setup-help">${esc(t("setup_help"))}</button></p>
    <button class="btn" id="cam">${esc(t("start_camera"))}</button>
    <div class="stage" hidden>
      <video playsinline muted></video>
      <canvas></canvas>
    </div>
    <p class="feedback" id="fb"></p>`;

  const btn = root.querySelector("#cam");
  const stage = root.querySelector(".stage");
  const video = stage.querySelector("video");
  const canvas = stage.querySelector("canvas");
  const fb = root.querySelector("#fb");

  let stream = null;
  let stopLoop = null;
  let started = false;
  let done = false;
  let okSince = null;
  let disposed = false;
  // Audio cues (the user can't see the screen in sujood): silent while wrong,
  // a hint tone every HINT_AFTER_SECONDS without success (max MAX_HINTS), a chime on success.
  let lastHintAt = null;
  let hints = 0;
  let leavingForSetup = false; // opening "Setup help" is not a failed attempt

  const setFeedback = (text, kind = "") => {
    fb.textContent = text;
    fb.className = `feedback ${kind}`;
  };

  root.querySelector("#setup-help").onclick = () => {
    leavingForSetup = true;
    showSetup(current, () => go(current));
  };

  function onLandmarks(points, aspect) {
    if (done) return;
    const now = performance.now();
    lastHintAt ??= now; // hint timer starts when evaluation starts
    const result = evaluatePose(points, step.check, aspect);
    if (!result.ok) {
      okSince = null;
      setFeedback(t(result.issues[0]), "warn");
      if (hints < MAX_HINTS && now - lastHintAt >= HINT_AFTER_SECONDS * 1000) {
        playHint();
        hints++;
        lastHintAt = now;
      }
      return;
    }
    okSince ??= now;
    if (now - okSince >= POSE_HOLD_SECONDS * 1000) {
      done = true;
      setFeedback(t("pose_done"), "ok");
      playSuccess();
      vibrateSuccess();
      recordAttempt(attemptKey, true);
      stopLoop?.();
      stopLoop = null;
      celebrate(step.check);
    } else {
      setFeedback(t("pose_ok"), "ok");
    }
  }

  btn.onclick = async () => {
    unlockAudio(); // must run inside the click, before any await (iOS)
    currentVideo?.pause(); // stop the demo clip when the camera starts
    btn.disabled = true;
    started = true;

    if (USE_MOCK) {
      // Mock: no camera at all. evaluatePose ignores landmarks, so simulate frames.
      resetPoseMock(step.check);
      btn.hidden = true;
      setFeedback(t("mock_no_camera"));
      const id = setInterval(() => onLandmarks(null, 4 / 3), 100);
      stopLoop = () => clearInterval(id);
      return;
    }

    // Stage 1: camera. Failures here get camera-specific messages.
    setFeedback(t("camera_starting"));
    try {
      stream = await startCamera(video);
    } catch (err) {
      console.error(err);
      stream = null;
      btn.disabled = false;
      const name = err?.name;
      setFeedback(
        t(name === "NotAllowedError" || name === "SecurityError" ? "camera_denied"
          : name === "NotFoundError" || name === "OverconstrainedError" ? "camera_missing"
          : "camera_error"),
        "warn"
      );
      return;
    }
    if (disposed) return stopCamera(stream);
    stage.classList.toggle("mirrored", shouldMirror(stream));
    stage.hidden = false;
    btn.hidden = true;

    // Stage 2: pose model (GPU, then CPU). The camera works, so say the model failed.
    try {
      const stop = await runPoseLoop(video, canvas, onLandmarks);
      if (disposed) stop();
      else stopLoop = stop;
    } catch (err) {
      console.error(err);
      if (disposed) return;
      stopCamera(stream);
      stream = null;
      stage.hidden = true;
      btn.hidden = false;
      btn.disabled = false;
      setFeedback(t("pose_model_error"), "warn");
    }
  };

  return () => {
    disposed = true;
    stopLoop?.();
    stopCamera(stream);
    // An attempt that was started but not finished counts as not completed,
    // unless the user just opened "Setup help" (they come back to this step).
    if (started && !done && !leavingForSetup) recordAttempt(attemptKey, false);
  };
}

// ---------- speech step ----------

function renderSpeech(step, root, attemptKey) {
  root.innerHTML = `
    <section class="card">
      <p class="label">${esc(t("recite_this"))}</p>
      <p class="arabic reference" dir="rtl" lang="ar">${esc(step.reference)}</p>
    </section>
    <p class="status" id="model"></p>
    <button class="btn" id="rec">${esc(t("start_reciting"))}</button>
    <p class="feedback" id="fb"></p>`;

  const btn = root.querySelector("#rec");
  const modelLine = root.querySelector("#model");
  const fb = root.querySelector("#fb");
  let recording = null;
  let disposed = false;

  const setFeedback = (html, kind = "") => {
    fb.innerHTML = html;
    fb.className = `feedback ${kind}`;
  };

  // The model is already loading in the background (startAsrPreload); just show its state.
  const showModel = () => {
    modelLine.textContent =
      asr.status === "ready" ? t("model_ready")
      : asr.status === "error" ? t("model_error")
      : `${t("model_loading")} ${asr.pct}%`;
  };
  if (!USE_MOCK) {
    showModel();
    asr.listeners.add(showModel);
  }

  // Mock: pretend the user forgot the last two words.
  const mockText = step.reference.split(" ").slice(0, -2).join(" ");

  btn.onclick = async () => {
    if (!recording) {
      currentVideo?.pause(); // the demonstrator's voice must not reach the microphone
      btn.disabled = true;
      try {
        recording = await startRecording();
        btn.disabled = false;
        if (disposed) return recording.stop().catch(() => {});
        btn.textContent = t("done_reciting");
        btn.classList.add("recording");
        setFeedback(esc(t("listening")));
      } catch (err) {
        console.error(err);
        recording = null;
        btn.disabled = false;
        setFeedback(esc(t(err?.name === "NotAllowedError" ? "mic_denied" : "mic_error")), "warn");
      }
      return;
    }

    const rec = recording;
    recording = null;
    btn.disabled = true;
    btn.classList.remove("recording");
    setFeedback(esc(t("checking")));
    try {
      const audio = await rec.stop();
      const text = await transcribe(audio, mockText);
      // A successful transcription means the model loaded (e.g. after an earlier error).
      if (!USE_MOCK && asr.status !== "ready") setAsr({ status: "ready" });
      if (disposed) return;
      const result = compareRecitation(text, step.reference);
      recordAttempt(attemptKey, result.complete);
      if (result.complete) {
        setFeedback(esc(t("speech_complete")), "ok");
        celebrate(step.id);
      } else if (!result.orderOk) {
        setFeedback(esc(t("speech_order")), "warn");
      } else {
        setFeedback(
          `${esc(t("speech_missing"))} <span class="arabic missing" dir="rtl" lang="ar">${esc(result.missing.join(" "))}</span>`,
          "warn"
        );
      }
    } catch (err) {
      console.error(err);
      if (!disposed) setFeedback(esc(t("mic_error")), "warn");
    } finally {
      if (!disposed) {
        btn.disabled = false;
        btn.textContent = t("try_again");
      }
    }
  };

  return () => {
    disposed = true;
    asr.listeners.delete(showModel);
    // Leaving mid-recording: stop the mic and drop the audio.
    recording?.stop().catch(() => {});
    recording = null;
  };
}

// ---------- speech model preload ----------
// Starts downloading Whisper as soon as the app opens (not at the speech step),
// so it is usually ready by the time the user reaches Al-Fatihah.
// The speech step only reads `asr` and subscribes to changes via asr.listeners.

const asr = { status: "loading", pct: 0, listeners: new Set() }; // status: loading | ready | error

function setAsr(patch) {
  Object.assign(asr, patch);
  asr.listeners.forEach((fn) => fn());
}

function startAsrPreload() {
  const files = {};
  preloadASR((p) => {
    if (p.status !== "progress" || !p.file) return;
    files[p.file] = { loaded: p.loaded ?? 0, total: p.total ?? 0 };
    const all = Object.values(files);
    const loaded = all.reduce((s, f) => s + f.loaded, 0);
    const total = all.reduce((s, f) => s + f.total, 0);
    if (asr.status === "loading") setAsr({ pct: total ? Math.round((loaded / total) * 100) : 0 });
  })
    .then(() => setAsr({ status: "ready", pct: 100 }))
    .catch((err) => {
      console.error(err);
      setAsr({ status: "error" });
    });
}

if (!USE_MOCK) startAsrPreload();
go(0);
