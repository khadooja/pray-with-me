// شاشة التجهيز: تظهر قبل أول خطوة فيها كاميرا، وتنفتح مرة ثانية من رابط "Setup help".
// كل النصوص في src/i18n/en.json (المفاتيح اللي تبدأ بـ setup_).
// الرسمة SVG تحت. تقدرون تبدلونها بأي رسمة ثانية بكل حرية.
import { t } from "../i18n/index.js";
import { unlockAudio, playSuccess } from "./sound.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ===== الرسمة (منظر من فوق) =====
// - المستطيل الكبير = سجادة الصلاة، والدائرة والبيضاوي = المصلي (رأس وكتفين)
// - السهم فوق المصلي = اتجاه القبلة (المصلي يواجه للأمام، مو للجوال)
// - المستطيل الصغير يمين = الجوال على الأرض، على جنب المصلي
// - الخط المتقطع = المسافة تقريباً مترين
// الألوان من متغيرات CSS في style.css عشان تتغير مع الثيم.
function illustration() {
  return `
    <svg class="setup-art" viewBox="0 0 320 200" role="img" aria-label="${esc(t("setup_illustration_alt"))}">
      <!-- سجادة الصلاة -->
      <rect x="40" y="40" width="80" height="140" rx="8" fill="var(--card)" stroke="var(--muted)" stroke-width="2" />
      <!-- اتجاه القبلة -->
      <path d="M80 34 L80 12 M72 20 L80 12 L88 20" stroke="var(--muted)" stroke-width="2" fill="none" stroke-linecap="round" />
      <!-- المصلي: الكتفين ثم الرأس -->
      <ellipse cx="80" cy="112" rx="30" ry="14" fill="var(--accent)" opacity="0.85" />
      <circle cx="80" cy="104" r="13" fill="var(--text)" />
      <!-- المسافة: خط متقطع من المصلي إلى الجوال -->
      <line x1="114" y1="110" x2="246" y2="110" stroke="var(--warn)" stroke-width="2" stroke-dasharray="6 6" />
      <text x="180" y="100" text-anchor="middle" fill="var(--warn)" font-size="16" font-weight="700">${esc(t("setup_distance_label"))}</text>
      <!-- الجوال على الأرض، الشاشة متجهة للمصلي -->
      <rect x="252" y="86" width="28" height="48" rx="5" fill="var(--bg)" stroke="var(--text)" stroke-width="2" />
      <circle cx="258" cy="110" r="3" fill="var(--accent)" />
    </svg>`;
}

// onReady: يكمل للخطوة. onBack: يرجع (أو null لو ما فيه رجوع).
export function renderSetup(root, { onReady, onBack }) {
  root.innerHTML = `
    <h1>${esc(t("setup_title"))}</h1>
    ${illustration()}
    <ol class="setup-list">
      <li>${esc(t("setup_side"))}</li>
      <li>${esc(t("setup_steady"))}</li>
      <li>${esc(t("setup_visible"))}</li>
      <li>${esc(t("setup_sound"))}</li>
    </ol>
    <button class="btn secondary" id="test-sound">${esc(t("test_sound"))}</button>
    <nav class="nav">
      <button class="btn secondary" id="setup-back" ${onBack ? "" : "disabled"}>${esc(t("back"))}</button>
      <button class="btn" id="setup-ready">${esc(t("im_ready"))}</button>
    </nav>`;

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
