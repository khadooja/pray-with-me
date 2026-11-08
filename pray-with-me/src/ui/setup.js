// شاشة التجهيز: تظهر قبل أول خطوة فيها كاميرا، وتنفتح مرة ثانية من رابط "Setup help".
// كل النصوص في src/i18n/en.json (المفاتيح اللي تبدأ بـ setup_).
// الرسمة SVG تحت. تقدرون تبدلونها بأي رسمة ثانية بكل حرية.
import { t } from "../i18n/index.js";
import { unlockAudio, playSuccess } from "./sound.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ===== الرسمة (منظر من فوق) =====
// كل عنصر له كلمة تسمّيه، عشان ما أحد يخمّن:
// - المستطيل المقوّس = سجادة الصلاة، والرأس والكتفين فوقها = "أنت"
// - السهم فوق = الاتجاه اللي تواجهه
// - المستطيل الصغير يمين = الجوال على الأرض، وعدسته (النقطة) متجهة لك
// - المثلث الفاتح = اللي تشوفه الكاميرا، والخط المتقطع = المسافة (مترين تقريباً)
// الألوان من متغيرات CSS في style.css عشان تتغير مع الثيم.
function illustration() {
  const label = (x, y, key, fill = "var(--text)") =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="15" font-weight="700" fill="${fill}">${esc(t(key))}</text>`;
  return `
    <svg class="setup-art" viewBox="0 0 340 220" role="img" aria-label="${esc(t("setup_illustration_alt"))}">
      <!-- اللي تشوفه الكاميرا -->
      <polygon points="244,138 128,62 128,214" fill="var(--accent)" opacity="0.12" />
      <!-- اتجاهك -->
      ${label(78, 15, "setup_label_facing")}
      <path d="M78 50 L78 26 M70 34 L78 26 L86 34" stroke="var(--muted)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <!-- سجادة الصلاة -->
      <path d="M36 214 L36 78 Q36 56 78 56 Q120 56 120 78 L120 214 Z" fill="var(--card)" stroke="var(--line-strong)" stroke-width="2.5" />
      <!-- أنت: الكتفين ثم الرأس -->
      <ellipse cx="78" cy="140" rx="30" ry="14" fill="var(--accent)" />
      <circle cx="78" cy="131" r="13" fill="var(--text)" />
      ${label(78, 190, "setup_label_you")}
      <!-- المسافة -->
      <line x1="124" y1="138" x2="236" y2="138" stroke="var(--warn)" stroke-width="2.5" stroke-dasharray="7 6" />
      ${label(180, 128, "setup_distance_label", "var(--warn)")}
      <!-- الجوال على الأرض، العدسة متجهة لك -->
      <rect x="244" y="106" width="38" height="64" rx="7" fill="var(--card)" stroke="var(--text)" stroke-width="2.5" />
      <circle cx="251" cy="138" r="4.5" fill="var(--accent)" />
      ${label(263, 192, "setup_label_phone")}
    </svg>`;
}

// onReady: يكمل للخطوة. onBack: يرجع (أو null لو ما فيه رجوع).
export function renderSetup(root, { onReady, onBack }) {
  root.innerHTML = `
    <h1>${esc(t("setup_title"))}</h1>
    <p class="setup-intro">${esc(t("setup_intro"))}</p>
    ${illustration()}
    <ol class="setup-list">
      <li>${esc(t("setup_side"))}</li>
      <li>${esc(t("setup_steady"))}</li>
      <li>${esc(t("setup_visible"))}</li>
      <li>${esc(t("setup_sound"))}</li>
    </ol>
    <button class="btn secondary" id="test-sound">${esc(t("test_sound"))}</button>
    <div class="bottom-spacer"></div>
    <div class="bottom-bar">
      <div class="bar-actions">
        <button class="btn secondary" id="setup-back" ${onBack ? "" : "disabled"}>${esc(t("back"))}</button>
        <button class="btn" id="setup-ready">${esc(t("im_ready"))}</button>
      </div>
    </div>`;

  root.querySelector("#test-sound").onclick = () => {
    unlockAudio();
    playSuccess();
  };
  root.querySelector("#setup-ready").onclick = () => {
    unlockAudio();
    onReady();
  };
  if (onBack) root.querySelector("#setup-back").onclick = onBack;
}
