# Pray With Me | صَلِّ معي

A web app that helps a **new Muslim learn the Fajr prayer step by step**, with real-time feedback:

- **Posture feedback** through the device camera (on-device pose estimation with MediaPipe).
- **Recitation feedback** through the microphone (on-device Whisper speech recognition and word alignment against Al-Fatihah).

Built for the *AI Challenge Serving Islamic Content* (Bathel Foundation).

## Privacy

**All processing runs in your browser.** No video or audio ever leaves your device.
There is no backend, no API keys and no database. The only network traffic is
downloading the app itself and the AI models and runtimes: the MediaPipe pose model from
Google storage (`storage.googleapis.com`), the Whisper model from Hugging Face
(`huggingface.co`), and the MediaPipe and onnxruntime WebAssembly files from `cdn.jsdelivr.net`. Progress (which steps you completed)
is stored only in your browser's `localStorage`.

## What it does, and what it does NOT do

It **does**:
- Guide you through one rakah of Fajr: Takbir → Standing → Al-Fatihah → Ruku → Sujood.
- Check parts of your **posture** with a camera placed to your side. Exactly what is checked:
  - **Standing:** your back is upright and your knees are straight.
  - **Ruku:** your back is level with the floor and your knees are straight.
  - **Sujood:** your head is lower than your hips.

  **Not checked:** hand position (right over left in standing, hands on knees in ruku), and in
  sujood whether your palms, knees, toes, forehead and nose touch the ground.
- Check that **Al-Fatihah was recited completely and in order**.

It does **NOT**:
- Assess **tajweed** or pronunciation quality.
- Issue any **ruling on the validity of your prayer**.

It is a practice aid. For religious questions, please ask a qualified scholar.

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
npm test           # alignment unit tests (plain Node)
```

The camera and microphone only work over **HTTPS or `localhost`**.

Useful URLs while developing:

| URL | Purpose |
| --- | --- |
| `/` | The app |
| `/?mock=1` | Mock mode: fake pose and speech results, with no camera, mic or model download. Good for UI work. |
| `/labs/pose.html` | Pose lab: live angles and rule results, used to tune `src/pose/rules/thresholds.js` |
| `/labs/speech.html` | Speech lab: model load time, transcription speed and alignment result |

## Deployment

Static files on **Cloudflare Pages**: build command `npm run build`, output directory `dist`.
Cloudflare Pages limits each file to 25 MiB. The onnxruntime `.wasm` file is about 21–22 MB, so
check `dist/` sizes after upgrading `@huggingface/transformers`. The Whisper model weights are
downloaded from Hugging Face at runtime and must **never** be committed.

## Tech

- [Vite 5](https://vitejs.dev/), vanilla JavaScript (ES modules), multi-page build
- [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) **0.10.14**: PoseLandmarker (lite model)
- [@huggingface/transformers](https://huggingface.co/docs/transformers.js) v3: Whisper (`Xenova/whisper-base`) in a Web Worker, using WebGPU when available and wasm otherwise
- Alignment: a custom LCS word alignment with fuzzy matching (`src/speech/align.js`)

## Project layout

```
src/content/fajr.json      steps and religious content (content teammate)
src/pose/                  camera, pose model, posture rules (AI teammate)
src/speech/                recording, Whisper worker, alignment (AI teammate)
src/i18n/en.json, ui/      all user-facing text and styling (UX teammate)
src/main.js, config.js     app shell, settings, progress, deployment (system teammate)
labs/                      tuning and measurement pages
docs/CONTRACTS.md          team guide (Arabic)
```

## Team

- **Layan Alzahrani**: Lead and content
- **Rahaf Altair**: AI
- **Khadija Alamoudi**: System
- **Layan Alosaimi**: UX

## License

Code: [MIT](LICENSE). Third-party content, models and libraries are listed in [SOURCES.md](SOURCES.md).
