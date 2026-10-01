// قاعدة السجود: ترجع قائمة أكواد أخطاء (قائمة فاضية = الوضعية صحيحة).
// ملاحظة: هذي نسخة أولى بسيطة عن قصد — نتحقق بس إن الرأس أوطى بوضوح من الورك.
// ما نتحقق من الكفين أو الركبتين أو أصابع القدمين. ممكن نطورها بعدين.
import { THRESHOLDS } from "./thresholds.js";
import { pickSide, isVisible } from "../geometry.js";

export function checkSujood(landmarks /*, aspect */) {
  const T = THRESHOLDS.sujood;
  const { nose, hip } = pickSide(landmarks);

  if (!isVisible(nose, hip)) return ["not_visible"];

  // في الصورة y يكبر كل ما نزلنا تحت، فالرأس الواطي = y أكبر
  if (!(nose.y > hip.y + T.headBelowHipMargin)) return ["head_not_low"];
  return [];
}
