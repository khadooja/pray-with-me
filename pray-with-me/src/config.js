// Global settings. Owned by the system teammate.

// ?mock=1 in the URL → fake pose/speech results, no camera/model needed.
export const USE_MOCK =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("mock") === "1";

export const MEDIAPIPE_VERSION = "0.10.14";
// The wasm version MUST match the npm package version above.
export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// The AI teammate may swap in a Quran-tuned ONNX Whisper model here
// (it must be a transformers.js-compatible ONNX export on Hugging Face).
export const ASR_MODEL_ID = "Xenova/whisper-base";

// How many seconds the user must hold a correct pose before the step counts as done.
export const POSE_HOLD_SECONDS = 2;
