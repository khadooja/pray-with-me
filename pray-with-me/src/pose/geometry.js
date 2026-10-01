// Geometry helpers over MediaPipe landmarks ({x, y, z, visibility}, x/y normalized 0..1).
// Image y grows DOWNWARD. x is scaled by the video aspect so angles are true angles.

// MediaPipe Pose landmark indices we use.
export const P = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const DEG = 180 / Math.PI;

// Angle at point b (between b→a and b→c), in degrees 0..180.
export function angleAt(a, b, c, aspect = 1) {
  const v1x = (a.x - b.x) * aspect, v1y = a.y - b.y;
  const v2x = (c.x - b.x) * aspect, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const len = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (len === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / len))) * DEG;
}

// Incline of segment a→b from horizontal: 0 = horizontal, 90 = vertical.
export function inclineFromHorizontal(a, b, aspect = 1) {
  const dx = Math.abs((b.x - a.x) * aspect);
  const dy = Math.abs(b.y - a.y);
  return Math.atan2(dy, dx) * DEG;
}

// The camera is placed to the user's SIDE, so one body side faces it.
// Pick the side whose shoulder+hip+knee+ankle are most visible.
export function pickSide(landmarks) {
  const vis = (i) => landmarks[i]?.visibility ?? 0;
  const leftScore = vis(P.LEFT_SHOULDER) + vis(P.LEFT_HIP) + vis(P.LEFT_KNEE) + vis(P.LEFT_ANKLE);
  const rightScore = vis(P.RIGHT_SHOULDER) + vis(P.RIGHT_HIP) + vis(P.RIGHT_KNEE) + vis(P.RIGHT_ANKLE);
  const left = leftScore >= rightScore;
  return {
    shoulder: landmarks[left ? P.LEFT_SHOULDER : P.RIGHT_SHOULDER],
    hip: landmarks[left ? P.LEFT_HIP : P.RIGHT_HIP],
    knee: landmarks[left ? P.LEFT_KNEE : P.RIGHT_KNEE],
    ankle: landmarks[left ? P.LEFT_ANKLE : P.RIGHT_ANKLE],
    wrist: landmarks[left ? P.LEFT_WRIST : P.RIGHT_WRIST],
    nose: landmarks[P.NOSE],
  };
}

// True if every given point exists and has visibility > 0.5.
export function isVisible(...pts) {
  return pts.every((p) => p && (p.visibility ?? 0) > 0.5);
}
