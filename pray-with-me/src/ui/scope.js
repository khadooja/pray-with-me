// نصوص "وش نفحص ووش ما نفحص"، تتبع مفتاح SPEECH_CHECK_ENABLED تلقائياً.
// الهدف: يستحيل يصير الكلام المكتوب للمستخدم مخالفاً لما يسويه التطبيق فعلاً.
// دوال صافية بدون DOM، عشان نقدر نختبرها في Node.
import { SPEECH_CHECK_ENABLED } from "../config.js";

// سطر التنبيه أسفل كل شاشة
export function footerKey(enabled = SPEECH_CHECK_ENABLED) {
  return enabled ? "footer" : "footer_no_speech";
}

// سطر "المفحوص / غير المفحوص" في خطوة الفاتحة
export function speechChecksKey(enabled = SPEECH_CHECK_ENABLED) {
  return enabled ? "checks_speech_on" : "checks_speech_off";
}

// هل نفحص التلاوة؟ (للاستخدام في الواجهة بدل استيراد الإعداد في كل مكان)
export function speechChecked(enabled = SPEECH_CHECK_ENABLED) {
  return Boolean(enabled);
}
