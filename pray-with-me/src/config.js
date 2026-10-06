// Global settings. Owned by the system teammate.

// ?mock=1 in the URL → fake pose/speech results, no camera/model needed.
export const USE_MOCK =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("mock") === "1";

export const MEDIAPIPE_VERSION = "0.10.14";
// The wasm version MUST match the npm package version above.
export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// نموذج التفريغ. لازم يكون تصدير ONNX متوافق مع transformers.js على Hugging Face.
// ⚠️ نموذج مدرّب على القرآن، و**رخصته TODO** لحد ما ترهف تتأكد منها وتسجّلها في SOURCES.md.
// ما يُنزَّل إلا إذا كان SPEECH_CHECK_ENABLED = true (أو من مختبر التلاوة).
export const ASR_MODEL_ID = "YunusZJ/whisper-base-ar-quran-ONNX";
// النموذج العام الاحتياطي: نرجع له لو النموذج المدرّب ما حمّل أو رخصته ما تنفع.
export const ASR_MODEL_FALLBACK = "Xenova/whisper-base";

// أي نسخة من ملفات النموذج ننزّل (dtype). لازم نحددها بأنفسنا:
// ⚠️ بدونها، المكتبة تختار "q8" على أي جهاز بدون WebGPU (كل الآيفونات مثلاً)، وملف الـ
// encoder بنسخة q8 **ما يشتغل أبداً** (خطأ ConvInteger)، فالنموذج يفشل دايماً على هالأجهزة.
// قسناها 2026-10-06 على تلاوة الفاتحة (الآيات الست + آية ناقصة متعمدة) داخل المتصفح:
//   - الكمبيوتر: النسخة الكاملة fp32 (حوالي 380 ميجا) — نفس اللي كان يشتغل على WebGPU.
//   - الجوال والتابلت: q4 (حوالي 150 ميجا، أصغر 60٪) — نفس النتيجة على كل الآيات.
export const ASR_DTYPE_DESKTOP = { encoder_model: "fp32", decoder_model_merged: "fp32" };
export const ASR_DTYPE_MOBILE = { encoder_model: "q4", decoder_model_merged: "q4" };
// الحجم التقريبي اللي نكتبه للمستخدم وقت التحميل (بالميجا)
export const ASR_SIZE_MB = { desktop: 380, mobile: 150 };

// جوال أو تابلت؟ (الآيباد الجديد يقول إنه Mac، فنعرفه من شاشة اللمس)
export function isMobileDevice(nav = typeof navigator !== "undefined" ? navigator : {}) {
  const ua = nav.userAgent ?? "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
}
export const asrDtype = (nav) => (isMobileDevice(nav) ? ASR_DTYPE_MOBILE : ASR_DTYPE_DESKTOP);
export const asrSizeMB = (nav) => (isMobileDevice(nav) ? ASR_SIZE_MB.mobile : ASR_SIZE_MB.desktop);
// إذا تفريغ آية واحدة تجاوز هذا الوقت على جهاز بدون WebGPU، نرجع لـ"اسمع وردّد"
// تلقائياً بدل ما نخلي المستخدم ينتظر كل آية.
export const SLOW_TRANSCRIBE_MS = 20000;
// الجوال أبطأ: آيفون حقيقي (2026-10-06) فحص "الحمد لله رب العالمين" في 22 ثانية، فكان
// حد الـ 20 ثانية يرمي نتيجة صحيحة. للجوال نسمح بـ 45 ثانية (عدّاد الثواني يظهر وهو ينتظر).
export const SLOW_TRANSCRIBE_MS_MOBILE = 45000;
export const slowTranscribeMs = (nav) => (isMobileDevice(nav) ? SLOW_TRANSCRIBE_MS_MOBILE : SLOW_TRANSCRIBE_MS);
// How many seconds the user must hold a correct pose before the step counts as done.
export const POSE_HOLD_SECONDS = 2;

// كم ثانية ننتظر (من بداية الخطوة أو من آخر تلميح) قبل ما نشغّل نغمة التلميح
// إذا المستخدم ما وصل للوضعية الصحيحة. بحد أقصى 3 تلميحات لكل خطوة.
// رقم مبدئي، اضبطوه بالتجربة. في وضع ?mock=1 نخليه 2 عشان تسمعون النغمتين بسرعة
// (الوضعية الوهمية تصير صحيحة بعد 3 ثواني).
export const HINT_AFTER_SECONDS = USE_MOCK ? 2 : 10;

// سرعات تشغيل فيديو الشرح، والزر يتنقل بينها بالترتيب (1x ← 0.75x ← 1x ...).
// تقدرون تضيفون سرعة ثانية هنا (مثلاً 0.5) بدون ما تغيرون أي كود ثاني.
export const VIDEO_SPEEDS = [1, 0.75];

// رابط "تكلّم مع شخص" في لوح المساعدة.
// ⚠️ لازم يشير إلى مركز إسلامي شريك (صفحة تواصل أو واتساب المركز)، مو أي رابط عام.
// ما دامت القيمة "TODO" ما نعرض السطر أصلاً في الواجهة، عشان ما يطلع رابط ميّت للمستخدم.
export const HELP_CONTACT_URL = "TODO";

// هل نفحص تلاوة الفاتحة؟
// ✅ **مشغّلة حالياً**: الفحص آية آية (src/ui/verse-step.js) يخلّي دمج/تقسيم كلمة واحدة
// ما يفسد بقية السورة، عكس المطابقة على ٢٥ كلمة مرة واحدة اللي كانت تطلّع تنبيهات كثيرة
// خاطئة (npm run eval:speech يعطي الأرقام الحالية). وفيه رجوع تلقائي لـ"اسمع وردّد" إذا
// النموذج ما حمّل، أو المايك مرفوض، أو الجهاز بطيء — المستخدم ما يتحجّز أبداً.
// لو احتجنا نطفيها مرة ثانية (رخصة النموذج، أو مشكلة ظهرت بالتجربة): خطوة الفاتحة ترجع
// "اسمع وردّد" بدون مايك ولا حكم ولا تحميل نموذج.
// ملاحظة: هذا المفتاح للتطبيق فقط. مختبر التلاوة /labs/speech.html يشتغل كامل دايماً،
// لأنه مكان القياس عند رهف.
export const SPEECH_CHECK_ENABLED = true;

// هل ننزّل نموذج Whisper أصلاً؟ قرار واحد في مكان واحد عشان نقدر نختبره.
export const shouldPreloadASR = () => !USE_MOCK && SPEECH_CHECK_ENABLED;

// شاشة "قبل أن تصلي" (الوقت، الوضوء، الطهارة، الستر، القبلة، النية).
// مالكة المحتوى اعتمدت المحتوى الست (كل عنصر في "preparation" داخل fajr.json عليه
// "reviewed": true الآن). المراجعة الشرعية المتخصصة شيء آخر، ولسه معلّقة — انظر SOURCES.md.
// الشاشة تذكير للمستخدم فقط: التطبيق ما يفحص أياً منها، وما نسجّل الاختيارات ولا نرسلها.
export const PREPARATION_SCREEN_ENABLED = true;
