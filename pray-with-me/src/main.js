// App shell: a tiny step "router" over src/content/fajr.json.
// Each step type (guided / pose / speech) renders its own practice area and
// returns a cleanup function that go() calls before showing another step.
import fajr from "./content/fajr.json";
import { USE_MOCK, POSE_HOLD_SECONDS } from "./config.js";
import { t } from "./i18n/index.js";
import { recordAttempt } from "./progress/store.js";
import { evaluatePose } from "./pose/index.js";
import { startCamera, stopCamera, runPoseLoop } from "./pose/detector.js";
import { preloadASR, startRecording, transcribe, compareRecitation } from "./speech/index.js";

const steps = fajr.steps;
const app = document.getElementById("app");
let current = 0;
let cleanup = null;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function go(i) {
  cleanup?.();
  cleanup = null;
  current = Math.max(0, Math.min(i, steps.length));
  window.scrollTo(0, 0);
  if (current === steps.length) renderFinished();
  else renderStep(steps[current]);
}

// ---------- layout ----------

function footer() {
  return `<footer class="footer">${esc(t("footer"))}</footer>`;
}

function dhikrCard(d) {
  if (!d) return "";
  return `
    <section class="card dhikr">
      <p class="arabic" dir="rtl" lang="ar">${esc(d.arabic)}</p>
      <p class="translit">${esc(d.transliteration)}</p>
      <p class="meaning">${esc(d.meaning?.en)}</p>
      ${d.audio ? `<audio controls preload="none" src="${esc(d.audio)}"></audio>` : ""}
    </section>`;
}

function renderStep(step) {
  const isLast = current === steps.length - 1;
  app.innerHTML = `
    <header class="top">
      <span class="step-count">${esc(t("step_of", { x: current + 1, n: steps.length }))}</span>
      ${USE_MOCK ? `<span class="badge">${esc(t("mock_mode"))}</span>` : ""}
    </header>
    <h1>${esc(step.title.en)} <span class="ar" dir="rtl" lang="ar">${esc(step.title.ar)}</span></h1>
    <p class="instruction">${esc(step.instruction.en)}</p>
    ${dhikrCard(step.dhikr)}
    <section class="practice" id="practice"></section>
    <nav class="nav">
      <button class="btn secondary" id="back" ${current === 0 ? "disabled" : ""}>${esc(t("back"))}</button>
      <button class="btn" id="next">${esc(t(isLast ? "finish" : "next"))}</button>
    </nav>
    ${footer()}`;

  app.querySelector("#back").onclick = () => go(current - 1);
  app.querySelector("#next").onclick = () => go(current + 1);

  const practice = app.querySelector("#practice");
  if (step.type === "pose") cleanup = renderPose(step, practice);
  else if (step.type === "speech") cleanup = renderSpeech(step, practice);
}

function renderFinished() {
  app.innerHTML = `
    <header class="top">${USE_MOCK ? `<span class="badge">${esc(t("mock_mode"))}</span>` : ""}</header>
    <h1>${esc(t("finished_title"))}</h1>
    <p class="instruction">${esc(t("finished_text"))}</p>
    <nav class="nav"><button class="btn" id="again">${esc(t("start_again"))}</button></nav>
    ${footer()}`;
  app.querySelector("#again").onclick = () => go(0);
}

// ---------- pose step ----------

function renderPose(step, root) {
  root.innerHTML = `
    <p class="hint">${esc(t("camera_hint"))}</p>
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

  const setFeedback = (text, kind = "") => {
    fb.textContent = text;
    fb.className = `feedback ${kind}`;
  };

  function onLandmarks(points, aspect) {
    if (done) return;
    const result = evaluatePose(points, step.check, aspect);
    if (!result.ok) {
      okSince = null;
      setFeedback(t(result.issues[0]), "warn");
      return;
    }
    okSince ??= performance.now();
    if (performance.now() - okSince >= POSE_HOLD_SECONDS * 1000) {
      done = true;
      setFeedback(t("pose_done"), "ok");
      recordAttempt(step.id, true);
      stopLoop?.();
      stopLoop = null;
    } else {
      setFeedback(t("pose_ok"), "ok");
    }
  }

  btn.onclick = async () => {
    btn.disabled = true;
    started = true;
    setFeedback(t("camera_starting"));
    try {
      stream = await startCamera(video);
      if (disposed) return stopCamera(stream);
      stage.hidden = false;
      btn.hidden = true;
      if (USE_MOCK) {
        // Mock: evaluatePose ignores landmarks, so no model is needed.
        const id = setInterval(() => onLandmarks(null, 4 / 3), 100);
        stopLoop = () => clearInterval(id);
      } else {
        const stop = await runPoseLoop(video, canvas, onLandmarks);
        if (disposed) stop();
        else stopLoop = stop;
      }
    } catch (err) {
      console.error(err);
      if (USE_MOCK && !disposed) {
        // No camera on this machine: still simulate the flow for UI work.
        setFeedback(t("mock_no_camera"));
        const id = setInterval(() => onLandmarks(null, 4 / 3), 100);
        stopLoop = () => clearInterval(id);
        return;
      }
      stopCamera(stream);
      stream = null;
      stage.hidden = true;
      btn.hidden = false;
      btn.disabled = false;
      const name = err?.name;
      setFeedback(
        t(name === "NotAllowedError" || name === "SecurityError" ? "camera_denied"
          : name === "NotFoundError" || name === "OverconstrainedError" ? "camera_missing"
          : "camera_error"),
        "warn"
      );
    }
  };

  return () => {
    disposed = true;
    stopLoop?.();
    stopCamera(stream);
    // An attempt that was started but not finished counts as not completed.
    if (started && !done) recordAttempt(step.id, false);
  };
}

// ---------- speech step ----------

function renderSpeech(step, root) {
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

  if (!USE_MOCK) {
    const files = {};
    modelLine.textContent = t("model_loading");
    preloadASR((p) => {
      if (disposed || p.status !== "progress" || !p.file) return;
      files[p.file] = { loaded: p.loaded ?? 0, total: p.total ?? 0 };
      const all = Object.values(files);
      const loaded = all.reduce((s, f) => s + f.loaded, 0);
      const total = all.reduce((s, f) => s + f.total, 0);
      const pct = total ? Math.round((loaded / total) * 100) : 0;
      modelLine.textContent = `${t("model_loading")} ${pct}%`;
    })
      .then(() => !disposed && (modelLine.textContent = t("model_ready")))
      .catch((err) => {
        console.error(err);
        if (!disposed) modelLine.textContent = t("model_error");
      });
  }

  // Mock: pretend the user forgot the last two words.
  const mockText = step.reference.split(" ").slice(0, -2).join(" ");

  btn.onclick = async () => {
    if (!recording) {
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
      if (disposed) return;
      const result = compareRecitation(text, step.reference);
      recordAttempt(step.id, result.complete);
      if (result.complete) {
        setFeedback(esc(t("speech_complete")), "ok");
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
    // Leaving mid-recording: stop the mic and drop the audio.
    recording?.stop().catch(() => {});
    recording = null;
  };
}

go(0);
