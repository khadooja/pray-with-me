// أصوات التنبيه: تتولّد بالكود عن طريق Web Audio API (بدون ملفات صوت، وبدون رخص).
// الصوت إضافة فقط: لو الجهاز ما يدعم الصوت أو صامت، النص على الشاشة يكفي.
// كل الدوال هنا ما ترمي أخطاء أبداً، وإذا فشلت تسكت وبس.

let ctx = null;

// لازم تنادونها من داخل ضغطة زر (مثل "تشغيل الكاميرا") وقبل أي await،
// لأن المتصفحات (خصوصاً سفاري على الآيفون) تمنع الصوت قبل تفاعل المستخدم.
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

// نغمة وحدة: freq = التردد بالهرتز (أعلى = أحدّ)، start = متى تبدأ (ثواني من الآن)،
// duration = طولها بالثواني، volume = الارتفاع من 0 إلى 1، type = شكل الموجة.
function tone(freq, start, duration, volume, type = "sine") {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // دخول وخروج ناعم عشان ما يطلع صوت "طقّة"
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function ready() {
  return ctx && ctx.state === "running";
}

// نغمة النجاح: نوتتين صاعدتين (دو ثم صول)، المجموع تقريباً 0.4 ثانية.
export function playSuccess() {
  try {
    if (!ready()) unlockAudio();
    if (!ctx) return;
    tone(523.25, 0, 0.18, 0.3); // C5
    tone(783.99, 0.18, 0.22, 0.3); // G5
  } catch {
    // ignore
  }
}

// نغمة التلميح: أنعم وأوطى من نغمة النجاح، نغمة وحدة 0.3 ثانية.
export function playHint() {
  try {
    if (!ready()) unlockAudio();
    if (!ctx) return;
    tone(329.63, 0, 0.3, 0.15, "triangle"); // E4
  } catch {
    // ignore
  }
}

// اهتزاز عند النجاح: يشتغل بس على الأجهزة اللي تدعمه (كروم أندرويد). ما نعتمد عليه.
export function vibrateSuccess() {
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(200);
  } catch {
    // ignore
  }
}
