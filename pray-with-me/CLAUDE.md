# CLAUDE.md: Pray With Me | صَلِّ معي

A hackathon web app (Bathel Foundation AI Challenge) that teaches a new Muslim the Fajr prayer — **both
rakahs, 24 journey positions**. It gives camera posture feedback on three steps; the recitation check is
behind a switch and **currently off**, so the Al-Fatihah step is listen-and-repeat and **no speech model is
loaded**. **Everything runs in the browser.** There is no backend, no API keys and no database. It deploys
as static files on Cloudflare Pages (build: `npm run build`, output: `dist`).

## Commands
- `npm install`, `npm run dev` (http://localhost:5173), `npm run build`, `npm run preview`
- `npm test` runs every file in `tests/` (10 suites, plain Node with `node:assert`, no framework)
- `node scripts/build-content.mjs` regenerates `src/content/fajr.json` and `SOURCES.md` from the content
  documents. `npm run eval:speech` prints the speech-matcher comparison.
- `/?mock=1` gives mock pose and speech with no camera, mic or models. Labs: `/labs/pose.html`,
  `/labs/speech.html`, `/labs/figure.html`, `/labs/results.html`.
- The camera and mic need HTTPS or localhost, so test them manually in a real browser.

## Stack (do not deviate)
- Vite 5, vanilla JS ES modules. **No** frameworks and **no** TypeScript.
- `@mediapipe/tasks-vision` pinned to **exactly 0.10.14**. The wasm comes from jsdelivr at the same version (`src/config.js`), and the lite pose model from Google storage.
- `@huggingface/transformers` ^3: Whisper runs in a module Web Worker (`src/speech/asr.worker.js`), on WebGPU when `"gpu" in navigator` and falling back to wasm.
- Multi-page build: every HTML page must be listed in `vite.config.js` `rollupOptions.input`.
- **Do not add dependencies.**

## Contracts (shapes must not change)
- `evaluatePose(landmarks, stepId, aspect) → { ok, issues: string[] }` (`src/pose/index.js`). `landmarks` is 33 MediaPipe points or null, and `aspect` = width/height. Issues are codes, and their messages live **only** in `src/i18n/en.json`. A null input gives `not_visible`, and an unknown step throws. The mock returns `back_not_flat` for 3 s, then ok.
- `compareRecitation(transcript, reference) → { complete, missing, orderOk, matched, total }` (`src/speech/align.js`). This is a pure function. The LCS traceback accepts a match only if `similar && L[i][j] === L[i+1][j+1] + 1`. Keep that condition.
- Content: **`src/content/fajr.json` is GENERATED — never hand-edit it.** It is written by
  `node scripts/build-content.mjs` from `docs/content-source.md` (prayer steps) and
  `docs/preparation-source.md` (the "Before you pray" items); a hand edit is lost on the next build, and
  `tests/content.test.mjs` re-parses both documents and fails if the JSON drifts from them character-for-character.
  Steps have `id`, `type` (guided|pose|speech), `title{ar,en}`, `level` (rukn|wajib|sunnah), `instruction{en}`,
  `source`, `sourceRefs`, an optional `instructionLevel`, an optional `dhikr{arabic,transliteration,meaning{en},level,once?,audio}`
  and an optional `video`. A pose step needs `check` (standing|ruku|sujood). The speech step keeps `reference`
  (Arabic without diacritics — **not** regenerated, the AI module depends on it) plus `verses` and `sunnahVerses`
  (basmala and amin: Sunnah, never checked). Top level also has `order` (entries are a step id or
  `{id, transition}`), `transitions`, `sources` and `preparation`. `src/content/journey.js` expands `order`
  into the 24-position journey and the per-position attempt keys (`sujood#1` … `sujood#4`).
- `SOURCES.md` is generated too, **except** everything from `## Demonstration videos` onward, which the build
  preserves verbatim — that tail is the hand-maintained part.
- Speech worker messages: in `{type:"load",modelId}` / `{type:"transcribe",audio,modelId}`, out `progress` / `ready` / `result{text}` / `error{message}`.

## Ownership (see docs/CONTRACTS.md)
- Content: `docs/content-source.md`, `docs/preparation-source.md`, `public/audio/` — **not** `fajr.json`
  or `SOURCES.md`, which are generated from those documents
- AI: `src/pose/`, `src/speech/`, `thresholds.js`
- UX: `src/ui/` (`style.css`, `setup.js` and its SVG, `sound.js` generated tones, `video.js`,
  `step-content.js`, `listen-step.js`, `preparation.js`, `help.js`, `sheet.js`, `scope.js`), `src/i18n/en.json`
- System: `main.js`, `config.js`, `content/journey.js`, `progress/`, `figure/`, `scripts/`,
  `labs/results.html`, `vite.config.js`, deployment

## Design decisions (keep these)
- **Audio cues for pose steps.** The user can't see the screen in sujood. `src/ui/sound.js` generates the tones with Web Audio, with no audio files.
  - Silent while the pose is wrong.
  - `playHint()` after `HINT_AFTER_SECONDS` without success (config.js: 10, or 2 in mock), repeating at most every `HINT_AFTER_SECONDS`, max 3 per step.
  - `playSuccess()` and `vibrateSuccess()` once, at the `POSE_HOLD_SECONDS` "done" moment.
  - `unlockAudio()` must be called synchronously in a click (Start camera, I'm ready, Test sound) before any `await`.
  - The text feedback must keep working without audio.
- **Side camera placement.** The phone goes on the floor about 2 m to the user's SIDE, and the user faces forward. A one-time setup screen (in memory, per visit) appears before the first pose step, and a "Setup help" link reopens it. The preview is mirrored only for a user-facing camera (`shouldMirror(stream)` in detector.js plus the `.stage.mirrored` CSS).
- No microphone use or recording during pose steps.
- **Demo video per step (optional `video` field).** `src/ui/video.js` renders it above the dhikr card with custom controls (play/pause, replay, speed from `VIDEO_SPEEDS` in config.js). No autoplay, never muted. A missing or failing clip hides the card and the step works as before. A working clip hides the separate dhikr audio player (the clip has the voice). It is paused when the camera starts and when recitation recording starts. Clips must stay under 5 MB. Videos are added in `docs/content-source.md`, never in `fajr.json` (and the content owner owns that document).
- **Drawn figure instead of photos (`src/figure/`).** Every step's illustration is SVG written in code — no image files, no external fonts. `kinematics.js` is pure math (no DOM, tested in Node): limb lengths never change between poses, and `poses.js` holds the angles, the staged sujood descent, the front-view seven-points diagram and the back-view taslim head turn. Colors come from CSS variables (`--figure`, `--figure-far`, `--mat`, `--highlight`); the geometry is locked by `tests/figure.test.mjs` and `tests/figure-nav.test.mjs`. Browse every pose at `/labs/figure.html`.
- **Recitation check behind a switch (`SPEECH_CHECK_ENABLED`, currently `false`).** While off, the Al-Fatihah step is listen-and-repeat (`src/ui/listen-step.js`): verses on screen, the user recites at their own pace and presses a button. **No microphone, no model download, no verdict** — `shouldPreloadASR()` is the single decision point, and `src/ui/scope.js` swaps the "what is / isn't checked" wording automatically so the UI never promises a check that isn't running. `/labs/speech.html` stays fully live. `ASR_MODEL_ID` is the Quran-tuned `YunusZJ/whisper-base-ar-quran-ONNX` (**license `TODO`**, to confirm before the switch is flipped), with `ASR_MODEL_FALLBACK = "Xenova/whisper-base"`. Turning the check on is the AI teammate's call.
- **When the check is on, it runs verse by verse** (`src/ui/verse-step.js`, logic in `src/speech/verse-check.js`): one verse on screen at a time, recorded and transcribed on its own, then `compareRecitation` against **that verse's** text. A word the ASR splits or merges can no longer spoil the rest of the surah, and the user is told which verse to repeat. "Try this verse again" / "Next verse" / "Skip this verse" — never stuck. The step passes only if every verse passed, and it records **exactly one** attempt under the usual position key (a fail if the user leaves mid-way, like pose steps). The checked text is `verses[i].arabic`, whose normalized join is byte-identical to `reference` — pinned by `tests/verse-check.test.mjs`. It falls back to listen-and-repeat by itself if the model fails, the mic is denied, or a check exceeds `SLOW_TRANSCRIBE_MS` without WebGPU. The model starts loading when the user reaches journey step 1, not at app load.
- **"Before you pray" screen (`PREPARATION_SCREEN_ENABLED`, `true`).** Six reminders from `docs/preparation-source.md` (time, wudu, purity, covering, qibla, intention), approved by the content owner with **specialist review still pending**. The app checks none of them and records nothing; ticks are reminders, not attempts. The wudu item links to a YouTube video — the app loads nothing from YouTube and the link only opens, in a new tab, if the user taps it (it sits outside the card's button so tapping it can't toggle the card).
- **Results page for user testing (`/labs/results.html`).** Unlinked from the app. Shows this browser's attempts per journey position plus a rakah 1 vs rakah 2 summary, takes a Tester ID (e.g. `T1`, no names or personal data), exports CSV/JSON through a local `Blob` download, and has a confirmed "Reset for next tester". The maths is in `src/progress/results.js` (pure, tested).

## Rules
- Scope: the app checks posture on standing, ruku and sujood **only** — and the completeness and order of Al-Fatihah *if* `SPEECH_CHECK_ENABLED` is turned on (it is off today). It does not assess tajweed or pronunciation and never rules on the validity of prayer. Keep this in the README and in the UI footer; `src/ui/scope.js` already derives the footer and per-step wording from the switch.
- Privacy: video and audio never leave the device. Progress lives only in localStorage (`pwm-progress-v1`, plus `pwm-tester-id` for the results page, with every access in try/catch). The app loads nothing from YouTube; the preparation screen's wudu link only opens if the user taps it. User-testing data leaves the browser only through an explicit export click on `/labs/results.html`.
- **Never invent religious content**, hadith references, sources or recitation audio. Use `"TODO"` — and `"TODO"` must never render: `ready()` in `src/ui/step-content.js` hides the line instead, and a test sweeps the whole journey for it.
- All user-facing strings go in `src/i18n/en.json`, accessed with `t(key)`. New issue codes must be reported to the UX teammate.
- All pose numbers live in `src/pose/rules/thresholds.js`.
- Comment the logic that teammates edit (thresholds, rules, i18n) **in Arabic**. One teammate is new to JS, so keep the code simple.
- Cloudflare Pages allows at most **25 MiB per file**. The onnxruntime `.wasm` in `dist/assets` is about 21–22 MB, so check sizes after upgrades. Never commit Whisper weights (they download from Hugging Face at runtime), keys, user recordings (`eval/recordings/` is git-ignored) or test photos.
- `main` is deployed. Teammates use the branches content/ai/ux. `npm run build` and `npm test` must pass before merging.
