// Speech module: microphone recording + Whisper (in a worker) + alignment.
// Nothing recorded ever leaves the device.
import { USE_MOCK, ASR_MODEL_ID } from "../config.js";

export { compareRecitation, normalizeArabic } from "./align.js";

let worker = null;
let ready = false;
const progressListeners = new Set();
const readyWaiters = [];
let pendingTranscribe = null; // { resolve, reject }

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./asr.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data: msg }) => {
    if (msg.type === "progress") {
      progressListeners.forEach((fn) => fn(msg.data));
    } else if (msg.type === "ready") {
      ready = true;
      readyWaiters.splice(0).forEach((w) => w.resolve());
    } else if (msg.type === "result") {
      pendingTranscribe?.resolve(msg.text);
      pendingTranscribe = null;
    } else if (msg.type === "error") {
      const err = new Error(msg.message);
      readyWaiters.splice(0).forEach((w) => w.reject(err));
      pendingTranscribe?.reject(err);
      pendingTranscribe = null;
    }
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || "ASR worker failed");
    readyWaiters.splice(0).forEach((w) => w.reject(err));
    pendingTranscribe?.reject(err);
    pendingTranscribe = null;
  };
  return worker;
}

// Starts downloading/loading the model. onProgress receives transformers.js
// progress events ({ status, file, progress, loaded, total }). Resolves when ready.
export function preloadASR(onProgress) {
  if (USE_MOCK) return Promise.resolve();
  if (onProgress) progressListeners.add(onProgress);
  if (ready) return Promise.resolve();
  return new Promise((resolve, reject) => {
    readyWaiters.push({ resolve, reject });
    getWorker().postMessage({ type: "load", modelId: ASR_MODEL_ID });
  });
}

// Starts recording from the microphone. Returns { stop } where
// stop() resolves to a Float32Array of mono audio at 16000 Hz.
// In mock mode the microphone is never touched: stop() resolves an empty array.
export async function startRecording() {
  if (USE_MOCK) return { stop: () => Promise.resolve(new Float32Array(0)) };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const chunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start();
  } catch (err) {
    // MediaRecorder unsupported or failed: turn the microphone off before reporting.
    stream.getTracks().forEach((t) => t.stop());
    throw err;
  }

  function stop() {
    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const ctx = new AudioContext({ sampleRate: 16000 });
          const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
          ctx.close();
          resolve(toMono(decoded));
        } catch (err) {
          reject(err);
        }
      };
      if (recorder.state !== "inactive") recorder.stop();
    });
  }
  return { stop };
}

function toMono(buffer) {
  if (buffer.numberOfChannels === 1) return new Float32Array(buffer.getChannelData(0));
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

// Transcribes 16 kHz mono audio. In mock mode resolves mockText after 800 ms.
// Note: audio.buffer is transferred to the worker, so `audio` is unusable afterwards.
export function transcribe(audio, mockText = "") {
  if (USE_MOCK) return new Promise((r) => setTimeout(() => r(mockText), 800));
  if (pendingTranscribe) return Promise.reject(new Error("A transcription is already running"));
  return new Promise((resolve, reject) => {
    pendingTranscribe = { resolve, reject };
    getWorker().postMessage({ type: "transcribe", audio, modelId: ASR_MODEL_ID }, [audio.buffer]);
  });
}
