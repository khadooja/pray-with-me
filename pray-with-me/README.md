# Pray With Me | صَلِّ معي

A web app that helps a **new Muslim learn the Fajr prayer step by step**, with real-time feedback:

- **Posture feedback** through the device camera (on-device pose estimation with MediaPipe).
- **Recitation feedback** through the microphone (on-device Whisper speech recognition and word alignment against Al-Fatihah).

Built for the *AI Challenge Serving Islamic Content* (Bathel Foundation).

## Privacy

**All processing runs in your browser.** No video or audio ever leaves your device.
There is no backend, no API keys and no database. The only network traffic is
downloading the app itself and the AI models: the MediaPipe pose model from Google
storage, and the Whisper model from Hugging Face. Progress (which steps you completed)
is stored only in your browser's `localStorage`.

## What it does, and what it does NOT do

It **does**:
- Guide you through one rakah of Fajr: Takbir → Standing → Al-Fatihah → Ruku → Sujood.
- Check your **posture** in standing, ruku and sujood, using a camera placed to your side.
- Check that **Al-Fatihah was recited completely and in order**.

It does **NOT**:
- Assess **tajweed** or pronunciation quality.
- Issue any **ruling on the validity of your prayer**.

It is a practice aid. For religious questions, please ask a qualified scholar.

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
