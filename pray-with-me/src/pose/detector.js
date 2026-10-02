// Camera + MediaPipe PoseLandmarker. Everything runs on-device; frames never leave the browser.
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_WASM_URL, POSE_MODEL_URL } from "../config.js";

let landmarkerPromise = null;

// Created lazily once and reused across steps. Tries the GPU delegate first,
// then falls back to CPU (devices without usable WebGL).
function getLandmarker() {
  landmarkerPromise ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
    const create = (delegate) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    try {
      return await create("GPU");
    } catch (err) {
      console.warn("Pose GPU delegate failed, retrying with CPU:", err);
      return create("CPU");
    }
  })().catch((err) => {
    landmarkerPromise = null; // allow a retry
    throw err;
  });
  return landmarkerPromise;
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
  } catch (err) {
    // The caller never receives the stream in this case, so turn the camera off here.
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw err;
  }
  return stream;
}

// Mirror the preview only for a user-facing (selfie) camera. Laptops usually
// don't report facingMode, so anything except "environment" counts as user-facing.
export function shouldMirror(stream) {
  try {
    return stream?.getVideoTracks()[0]?.getSettings().facingMode !== "environment";
  } catch {
    return true;
  }
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

// Calls onLandmarks(points | null, aspect) for every new video frame.
// Returns stop(). Throws (async) if the model can't be loaded.
export async function runPoseLoop(video, canvas, onLandmarks) {
  const landmarker = await getLandmarker();
  const ctx = canvas.getContext("2d");
  const drawer = new DrawingUtils(ctx);
  let lastTime = -1;
  let rafId = 0;
  let stopped = false;

  const frame = () => {
    if (stopped) return;
    rafId = requestAnimationFrame(frame);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;

    const w = video.videoWidth, h = video.videoHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const result = landmarker.detectForVideo(video, performance.now());
    const points = result.landmarks?.[0] ?? null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points) {
      drawer.drawConnectors(points, PoseLandmarker.POSE_CONNECTIONS, { color: "#2ee6c0", lineWidth: 3 });
      drawer.drawLandmarks(points, { color: "#ffffff", radius: 3 });
    }
    onLandmarks(points, w / h);
  };
  rafId = requestAnimationFrame(frame);

  return function stop() {
    stopped = true;
    cancelAnimationFrame(rafId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
