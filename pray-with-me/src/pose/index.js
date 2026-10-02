// CONTRACT (do not change the shape):
//   evaluatePose(landmarks, stepId, aspect) → { ok: boolean, issues: string[] }
//   landmarks: 33 MediaPipe points or null. aspect = video width / height.
//   issues are error codes; their messages live ONLY in src/i18n/en.json.
import { USE_MOCK } from "../config.js";
import { checkStanding } from "./rules/standing.js";
import { checkRuku } from "./rules/ruku.js";
import { checkSujood } from "./rules/sujood.js";

export { P, angleAt, inclineFromHorizontal, pickSide, isVisible } from "./geometry.js";
export { THRESHOLDS } from "./rules/thresholds.js";

const RULES = {
  standing: checkStanding,
  ruku: checkRuku,
  sujood: checkSujood,
};

// Mock: first 3 s after the first call for a step → "back_not_flat", then ok.
const mockStart = {};
function evaluatePoseMock(stepId) {
  if (!RULES[stepId]) throw new Error(`Unknown pose step: ${stepId}`);
  mockStart[stepId] ??= performance.now();
  if (performance.now() - mockStart[stepId] < 3000) {
    return { ok: false, issues: ["back_not_flat"] };
  }
  return { ok: true, issues: [] };
}

// Mock only: restart the fake 3 s timer, so every visit to a step replays the flow.
// Not part of the evaluatePose contract.
export function resetPoseMock(stepId) {
  delete mockStart[stepId];
}

export function evaluatePose(landmarks, stepId, aspect = 1) {
  if (USE_MOCK) return evaluatePoseMock(stepId);

  const rule = RULES[stepId];
  if (!rule) throw new Error(`Unknown pose step: ${stepId}`);
  if (!landmarks) return { ok: false, issues: ["not_visible"] };

  const issues = rule(landmarks, aspect);
  return { ok: issues.length === 0, issues };
}
