# CLAUDE.md: Pray With Me | صَلِّ معي

A hackathon web app (Bathel Foundation AI Challenge) that teaches a new Muslim one rakah of Fajr. It gives
camera posture feedback and microphone recitation-completeness feedback. **Everything runs in the browser.**
There is no backend, no API keys and no database. It deploys as static files on Cloudflare Pages
(build: `npm run build`, output: `dist`).

## Commands
- `npm install`, `npm run dev` (http://localhost:5173), `npm run build`, `npm run preview`
- `npm test` runs `node tests/align.test.mjs` (plain Node with `node:assert`, no framework)
- `/?mock=1` gives mock pose and speech with no camera, mic or models. Labs: `/labs/pose.html` and `/labs/speech.html`.
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
- Content: `src/content/fajr.json` steps have `id`, `type` (guided|pose|speech), `title{ar,en}`, `instruction{en}`, an optional `dhikr{arabic,transliteration,meaning{en},audio}` and `source`. A pose step needs `check` (standing|ruku|sujood). A speech step needs `reference` (Arabic without diacritics), `transliteration`, `meaning` and `audio`.
- Speech worker messages: in `{type:"load",modelId}` / `{type:"transcribe",audio,modelId}`, out `progress` / `ready` / `result{text}` / `error{message}`.

## Ownership (see docs/CONTRACTS.md)
- Content: `fajr.json`, `SOURCES.md`, `public/audio/`
- AI: `src/pose/`, `src/speech/`, `thresholds.js`
- UX: `src/ui/style.css`, `src/i18n/en.json`
- System: `main.js`, `config.js`, `progress/`, `vite.config.js`, deployment

## Rules
- Scope: the app checks posture and the completeness and order of Al-Fatihah **only**. It does not assess tajweed or pronunciation and never rules on the validity of prayer. Keep this in the README and in the UI footer.
- Privacy: video and audio never leave the device. Progress lives only in localStorage (`pwm-progress-v1`, with every access in try/catch).
- **Never invent religious content**, hadith references, sources or recitation audio. Use `"TODO"`.
- All user-facing strings go in `src/i18n/en.json`, accessed with `t(key)`. New issue codes must be reported to the UX teammate.
- All pose numbers live in `src/pose/rules/thresholds.js`.
- Comment the logic that teammates edit (thresholds, rules, i18n) **in Arabic**. One teammate is new to JS, so keep the code simple.
- Cloudflare Pages allows at most **25 MiB per file**. The onnxruntime `.wasm` in `dist/assets` is about 21–22 MB, so check sizes after upgrades. Never commit Whisper weights (they download from Hugging Face at runtime), keys, user recordings (`eval/recordings/` is git-ignored) or test photos.
- `main` is deployed. Teammates use the branches content/ai/ux. `npm run build` and `npm test` must pass before merging.
