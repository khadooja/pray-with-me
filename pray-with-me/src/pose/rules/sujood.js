import { THRESHOLDS } from "./thresholds.js";
import { pickSide, isVisible } from "../geometry.js";

export function checkSujood(landmarks /*, aspect */) {
  const T = THRESHOLDS.sujood;

  // نستخدم جهة واحدة فقط: الجهة التي اختارها pickSide
  const {
    nose,
    hip,
    knee,
    ankle,
    wrist,
  } = pickSide(landmarks);

  if (!isVisible(nose, hip, knee, ankle)) {
    return ["not_visible"];
  }

  const issues = [];

  // الرأس يجب أن يكون أسفل الورك
  if (!(nose.y > hip.y + T.headBelowHipMargin)) {
    issues.push("head_not_low");
  }

  return issues;
}