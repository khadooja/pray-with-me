// قاعدة القيام: ترجع قائمة أكواد أخطاء (قائمة فاضية = الوضعية صحيحة).
// أي كود جديد تضيفونه لازم تبلغون فيه فريق الـ UX عشان يضيفون نصه في en.json.
import { THRESHOLDS } from "./thresholds.js";
import { pickSide, isVisible, inclineFromHorizontal, angleAt } from "../geometry.js";

export function checkStanding(landmarks, aspect) {
  const T = THRESHOLDS.standing;
  const { shoulder, hip, knee, ankle } = pickSide(landmarks);

  // لازم نشوف الكتف والورك والركبة والكاحل
  if (!isVisible(shoulder, hip, knee, ankle)) return ["not_visible"];

  const issues = [];
  // الجذع لازم يكون شبه عمودي
  if (inclineFromHorizontal(shoulder, hip, aspect) < T.minTorsoIncline) issues.push("not_upright");
  // الركبة لازم تكون مستقيمة
  if (angleAt(hip, knee, ankle, aspect) < T.minKneeAngle) issues.push("knees_bent");
  return issues;
}
