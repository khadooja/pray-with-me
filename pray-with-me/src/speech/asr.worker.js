// Whisper speech recognition inside a Web Worker (keeps the UI responsive).
// Audio stays in the browser; only the model weights are downloaded (from Hugging Face).
//
// In:  { type: "load", modelId } | { type: "transcribe", audio: Float32Array (16 kHz mono), modelId }
// Out: { type: "progress", data } | { type: "ready" } | { type: "result", text } | { type: "error", message }
import { pipeline } from "@huggingface/transformers";
import { asrDtype } from "../config.js";

// Hugging Face answers 404 (no CORS headers → "Failed to fetch") to any request whose Referer is a
// *.workers.dev address — which is where the app is deployed — so the model never loaded on the
// live site. Every fetch from this worker (model files only) goes out without a Referer.
const baseFetch = self.fetch.bind(self);
self.fetch = (input, init = {}) => baseFetch(input, { ...init, referrerPolicy: "no-referrer" });

let current = { modelId: null, device: null, promise: null };

const progress_callback = (data) => self.postMessage({ type: "progress", data });

// dtype explicit on purpose: the library's own default on wasm is q8, whose encoder fails to
// load (ConvInteger unsupported). See ASR_DTYPE_* in config.js.
function create(modelId, device) {
  return pipeline("automatic-speech-recognition", modelId, { device, dtype: asrDtype(), progress_callback });
}

// "gpu" in navigator only says the browser knows WebGPU, not that this device can use it. Asking
// for an adapter first avoids starting on WebGPU when there is none: once onnxruntime has tried
// WebGPU and failed, the wasm retry below can fail too ("no available backend found").
async function preferredDevice() {
  if (!("gpu" in navigator)) return "wasm";
  try {
    return (await navigator.gpu.requestAdapter()) ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

async function getPipeline(modelId) {
  if (current.modelId === modelId && current.promise) return current.promise;

  current = { modelId, device: null, promise: null };
  current.promise = (async () => {
    const preferred = await preferredDevice();
    current.device = preferred;
    try {
      return await create(modelId, preferred);
    } catch (err) {
      if (preferred !== "webgpu") throw err;
      // WebGPU exists but failed (no adapter, unsupported op...) → fall back to wasm.
      console.warn("WebGPU load failed, retrying with wasm:", err);
      current.device = "wasm";
      return create(modelId, "wasm");
    }
  })();
  current.promise.catch(() => (current = { modelId: null, device: null, promise: null }));
  return current.promise;
}
async function run(asr, audio) {
  const out = await asr(audio, {
    language: "arabic",
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  return Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text;
}

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === "load") {
      await getPipeline(msg.modelId);
      self.postMessage({ type: "ready" });
    } else if (msg.type === "transcribe") {
      const asr = await getPipeline(msg.modelId);
      self.postMessage({ type: "ready" });
      let text;
      try {
        text = await run(asr, msg.audio);
      } catch (err) {
        if (current.device !== "webgpu") throw err;
        // Some devices load on WebGPU but fail at inference → retry once on wasm.
        console.warn("WebGPU inference failed, retrying with wasm:", err);
        current = { modelId: msg.modelId, device: "wasm", promise: create(msg.modelId, "wasm") };
        text = await run(await current.promise, msg.audio);
      }
      self.postMessage({ type: "result", text: text.trim() });
    }
  } catch (err) {
    // name + modelId are included so the main thread can log/show exactly what failed
    // (debug-only UI; see src/main.js's ?debug=1 handling). No behavior change otherwise.
    self.postMessage({
      type: "error",
      message: err?.message ?? String(err),
      name: err?.name ?? null,
      modelId: msg.modelId ?? null,
    });
  }
};
