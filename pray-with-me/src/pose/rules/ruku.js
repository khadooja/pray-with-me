// قاعدة الركوع: ترجع قائمة أكواد أخطاء (قائمة فاضية = الوضعية صحيحة).
import { THRESHOLDS } from "./thresholds.js";
import { pickSide, isVisible, inclineFromHorizontal, angleAt } from "../geometry.js";

export function checkRuku(landmarks, aspect) {
  const T = THRESHOLDS.ruku;
  const { shoulder, hip, knee, ankle } = pickSide(landmarks);

  if (!isVisible(shoulder, hip, knee, ankle)) return ["not_visible"];

  const issues = [];
  // الظهر لازم يكون مستوي مع الأرض تقريباً (ميلان صغير)
  if (inclineFromHorizontal(shoulder, hip, aspect) > T.maxTorsoIncline) issues.push("back_not_flat");
  // الركبتين مستقيمتين تقريباً
  if (angleAt(hip, knee, ankle, aspect) < T.minKneeAngle) issues.push("knees_bent");
  return issues;
}
