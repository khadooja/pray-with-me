// فيديو الشرح: يظهر فوق بطاقة الذكر إذا الخطوة فيها حقل "video" في fajr.json.
// - الحقل اختياري. بدونه، أو إذا الملف ما انفتح، البطاقة تختفي والخطوة تشتغل مثل أول.
// - ما فيه تشغيل تلقائي، والصوت شغّال (الفيديو فيه صوت المُعلّم). المستخدم يضغط تشغيل.
// - أزرار التحكم هنا مخصصة (تشغيل/إيقاف، إعادة، سرعة)، بدون أزرار المتصفح الأصلية.
// كل النصوص من en.json (المفاتيح اللي تبدأ بـ video_)، والسرعات من VIDEO_SPEEDS في config.js.
import { t } from "../i18n/index.js";
import { VIDEO_SPEEDS } from "../config.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// HTML البطاقة، أو نص فاضي إذا الخطوة ما فيها فيديو.
// attached = true إذا تحت الفيديو بطاقة ذكر (نلصقهم ببعض بصرياً).
export function videoCard(step) {
  if (!step.video) return "";
  return `
    <section class="video-card${step.dhikr ? " attached" : ""}" aria-label="${esc(t("video_label"))}">
      <video playsinline preload="metadata" src="${esc(step.video)}"></video>
      <div class="video-controls">
        <button type="button" class="vbtn" data-act="toggle">${esc(t("video_play"))}</button>
        <button type="button" class="vbtn" data-act="replay">${esc(t("video_replay"))}</button>
        <button type="button" class="vbtn" data-act="speed" aria-label="${esc(t("video_speed_label"))}">${esc(t("video_speed", { x: VIDEO_SPEEDS[0] }))}</button>
      </div>
    </section>`;
}

// يربط الأزرار. root = الحاوية اللي فيها البطاقة (app).
// يرجع { pause, dispose }: pause توقف الفيديو (مثلاً لما تشتغل الكاميرا)،
// و dispose تنادونها عند مغادرة الخطوة (توقف الصوت وتوقف التحميل).
// إذا ما فيه فيديو يرجع كائن فاضي آمن.
export function setupVideo(root) {
  const card = root.querySelector(".video-card");
  const noop = { pause() {}, dispose() {} };
  if (!card) return noop;

  const video = card.querySelector("video");
  const toggleBtn = card.querySelector('[data-act="toggle"]');
  const replayBtn = card.querySelector('[data-act="replay"]');
  const speedBtn = card.querySelector('[data-act="speed"]');
  let speedIdx = 0;
  let disposed = false;

  const play = () => video.play().catch(() => {}); // المتصفح ممكن يرفض: نتجاهل بهدوء
  const syncToggle = () => {
    toggleBtn.textContent = t(video.paused || video.ended ? "video_play" : "video_pause");
  };

  toggleBtn.onclick = () => (video.paused || video.ended ? play() : video.pause());
  replayBtn.onclick = () => {
    video.currentTime = 0;
    play();
  };
  speedBtn.onclick = () => {
    speedIdx = (speedIdx + 1) % VIDEO_SPEEDS.length;
    video.playbackRate = VIDEO_SPEEDS[speedIdx];
    speedBtn.textContent = t("video_speed", { x: VIDEO_SPEEDS[speedIdx] });
  };
  video.addEventListener("play", syncToggle);
  video.addEventListener("pause", syncToggle);
  video.addEventListener("ended", syncToggle);

  // الملف ما انفتح: نشيل البطاقة، ونرجع بطاقة الذكر لشكلها العادي ونظهر مشغّل صوتها.
  video.addEventListener("error", () => {
    if (disposed) return;
    card.remove();
    root.querySelector(".dhikr-audio")?.removeAttribute("hidden");
  });

  return {
    pause: () => video.pause(),
    dispose: () => {
      disposed = true;
      video.pause();
      video.removeAttribute("src"); // يوقف أي تحميل شغّال
      video.load();
    },
  };
}
