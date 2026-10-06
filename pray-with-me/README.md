# Pray With Me | صَلِّ معي

A web app that helps a **new Muslim learn the Fajr prayer step by step**, with real-time feedback:

- **Posture feedback** through the device camera (on-device pose estimation with MediaPipe).
- **Guided recitation**: Al-Fatihah is listen-and-repeat today. The microphone check (on-device Whisper
  speech recognition and word alignment) is built but sits behind a switch that is currently **off** —
  see [Recitation checking is currently OFF](#recitation-checking-is-currently-off).

Built for the *AI Challenge Serving Islamic Content* (Bathel Foundation).

## Privacy

**All processing runs in your browser.** No video or audio ever leaves your device.
There is no backend, no API keys and no database. The only network traffic is downloading the app
itself and, for the posture check, the MediaPipe pose model from Google storage
(`storage.googleapis.com`) with the MediaPipe WebAssembly files from `cdn.jsdelivr.net`.
**The app does not download a speech model at all** while the recitation check is off — only the
`/labs/speech.html` development page fetches Whisper from Hugging Face. Progress (which steps you
completed) is stored only in your browser's `localStorage`. The "Before you pray" screen's wudu item
links to a YouTube video; the app loads nothing from YouTube — that link only opens, in a
new tab, if you tap it.

## What it does, and what it does NOT do

It **does**:
- Guide you through the **whole Fajr prayer**, step by step: opening Takbir → Standing →
  Al-Fatihah → Ruku → rising → I'tidal → Sujood → sitting → Sujood → the second rakah →
  Tashahhud → Taslim.
- Check parts of your **posture** with a camera placed to your side. **Only three of those
  steps are checked** — standing, ruku and sujood. Every other step is guidance only, with no
  camera or microphone check. Exactly what is checked:
  - **Standing:** your back is upright and your knees are straight.
  - **Ruku:** your back is level with the floor and your knees are straight.
  - **Sujood:** your head is lower than your hips.

  **Not checked:** hand position (right over left in standing, hands on knees in ruku), and in
  sujood whether your palms, knees, toes, forehead and nose touch the ground.
- Show **Al-Fatihah verse by verse** with transliteration and meaning, to recite at your own pace.
  Checking the recitation is built but currently switched off (see the next section); when it is on,
  it checks each verse on its own — that the verse's words were said, in order, and nothing more.
- Remind you of the **six things to get ready** before you start — time, wudu, purity, covering,
  facing the qibla and intention. These are reminders only: the app checks none of them and stores
  no answer.

It does **NOT**:
- Assess **tajweed** or pronunciation quality.
- Issue any **ruling on the validity of your prayer**.

It is a practice aid. For religious questions, please ask a qualified scholar.

### Recitation checking is currently OFF

The Al-Fatihah check is behind a switch, `SPEECH_CHECK_ENABLED` in `src/config.js`, and it is
currently **`false`**.

- **Off (today):** the Al-Fatihah step is "listen and repeat" — the verses are shown, you recite
  at your own pace and press a button to continue. **No microphone is requested, no speech model
  is downloaded, and nothing you say is judged.** The app checks posture only.
- **On:** the step goes **one verse at a time**. For each verse you see the Arabic, its
  transliteration and its meaning, record just that verse, and are told whether every word of
  **that verse** was said in the right order — with "Try this verse again", "Next verse" and
  "Skip this verse", so you are never stuck. The whole step counts as correct only if every
  verse did. Checking one verse at a time keeps a word the model splits or merges from spoiling
  the rest of the surah, and it tells you exactly which verse to repeat.

Either way, **pronunciation and tajweed are never assessed** — only whether the words of the
verse were said, and in order.

The model loads when you reach the first step of the prayer (not when the app opens), and if it
fails to load, the microphone is refused, or checking turns out too slow on the device, the step
falls back to listen-and-repeat on its own with a short note. The journey is never blocked.

It is off because `npm run eval:speech` showed the current matcher reporting **words as "missing" on a
recitation that was in fact complete** — the speech model splits and merges words, and word-by-word
matching reads that as an omission. A false accusation is worse for a beginner than no check, so the
check stays off until the evaluation justifies turning it on. Run that command for the current
figures; we deliberately don't copy them here, where they would go stale. That decision belongs to
the AI teammate.

A test parses `src/config.js` and fails if this section stops matching the actual flag.


## Design decisions

1. **Audio cues, not just text.** In sujood your face is on the floor, so you can't read the
   screen. Pose steps therefore play short tones that are generated in code (`src/ui/sound.js`):
   - a rising chime once your position has been correct for `POSE_HOLD_SECONDS`
   - a soft, lower hint tone if you haven't succeeded after `HINT_AFTER_SECONDS`. It repeats at most 3 times and stays silent the rest of the time.

   Android phones also vibrate on success. The on-screen text feedback still works exactly as
   before, so the sound adds to it and never replaces it. A **Test sound** button on the setup
   screen lets you check your volume first.
2. **Side camera placement.** The phone goes on the floor, about 2 m to your **side**, not in front.
   You keep facing forward (towards the qibla) as usual. From the side, the camera can see the angles
   that matter: back level in ruku, head below hips in sujood. A one-time setup screen with an
   illustration explains this before the first pose step, and a "Setup help" link opens it again.

## Run it locally

Requirements: **Node.js 18+**.

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
npm test           # the whole suite: 10 files in tests/ (plain Node, no framework)

node scripts/build-content.mjs   # regenerate src/content/fajr.json and SOURCES.md
npm run eval:speech              # compare the speech matchers on eval/speech-fixtures.json
```

The camera and microphone only work over **HTTPS or `localhost`**.

Useful URLs while developing:

| URL | Purpose |
| --- | --- |
| `/` | The app |
| `/?mock=1` | Mock mode: fake pose and speech results, with no camera, mic or model download. Good for UI work. |
| `/labs/pose.html` | Pose lab: live angles and rule results, used to tune `src/pose/rules/thresholds.js` |
| `/labs/speech.html` | Speech lab: model load time, transcription speed and alignment result. The only page that downloads a speech model |
| `/labs/figure.html` | Figure lab: every drawn pose and transition on one page |
| `/labs/results.html` | User-testing results: this browser's attempts per step, rakah 1 vs rakah 2, and CSV/JSON export |

## Deployment

Static files on **Cloudflare Pages**: build command `npm run build`, output directory `dist`.
Cloudflare Pages limits each file to 25 MiB. The onnxruntime `.wasm` file is about 21–22 MB, so
check `dist/` sizes after upgrading `@huggingface/transformers`. The Whisper model weights are
downloaded from Hugging Face at runtime and must **never** be committed.

## Tech

- [Vite 5](https://vitejs.dev/), vanilla JavaScript (ES modules), multi-page build
- [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) **0.10.14**: PoseLandmarker (lite model)
- [@huggingface/transformers](https://huggingface.co/docs/transformers.js) v3: Whisper in a Web Worker, using WebGPU when available and wasm otherwise. `ASR_MODEL_ID` is the Quran-tuned `YunusZJ/whisper-base-ar-quran-ONNX` (**license TODO**, to be confirmed by the AI teammate), with `Xenova/whisper-base` kept as a named fallback. While the recitation check is off, only `/labs/speech.html` loads a model
- Alignment: a custom LCS word alignment (`src/speech/align.js`), with alternative matchers compared in `src/speech/matchers.js`
- The step illustrations are SVG generated in code (`src/figure/`), with no image files

## Project layout

```
src/content/fajr.json       steps and religious content — GENERATED, do not hand-edit
docs/content-source.md      the content owner's final table: the one place to edit prayer content
docs/preparation-source.md  the six "Before you pray" items
scripts/build-content.mjs   rewrites fajr.json and SOURCES.md from those two documents
src/content/journey.js      expands "order" into the 24-position journey and its attempt keys
src/pose/                   camera, pose model, posture rules (AI teammate)
src/speech/                 recording, Whisper worker, alignment, matcher comparison (AI teammate)
src/figure/                 the drawn SVG figure: kinematics, poses, animation
src/i18n/en.json, ui/       all user-facing text and styling (UX teammate)
src/main.js, config.js      app shell, settings, switches (system teammate)
src/progress/               attempts in localStorage, finish-screen review, results maths
labs/                       tuning, measurement and user-testing pages
docs/CONTRACTS.md           team guide (Arabic)
```

## Team

- **Layan Alosaimi**: Lead and content
- **Rahaf Altair**: AI
- **Khadija Alamoudi**: System
- **Layan Alzahrani**: UX

## License

Code: [MIT](LICENSE). Third-party content, models and libraries are listed in [SOURCES.md](SOURCES.md).
