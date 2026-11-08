// شاشة الترحيب: أول ما يفتح التطبيق، مرة وحدة في الزيارة (قبل تجهيز الكاميرا).
// تعرّف بالتطبيق وفكرته وتطمّن على الخصوصية، وما تسجّل أي شيء ولا تحمّل أي نموذج.
// كل النصوص من src/i18n/en.json (المفاتيح اللي تبدأ بـ welcome_).
// ⚠️ ما نذكر هنا إلا اللي التطبيق يسويه فعلاً (الكاميرا والخصوصية). التنبيه الكامل عن
// حدود الفحص يظهر في التذييل (footer) تحت الشاشة، وقيمته تتغير مع مفتاح الفحص.
import { t } from "../i18n/index.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// أيقونات خطية بسيطة، تقدرون تبدلونها بحرية.
const ICONS = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  free: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
};

const icon = (id) =>
  `<svg class="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

const POINTS = [
  ["camera", "welcome_point_camera"],
  ["lock", "welcome_point_private"],
  ["free", "welcome_point_free"],
];

export function welcomeHtml() {
  return `
    <section class="welcome">
      <div class="welcome-hero">
        <p class="welcome-ar" dir="rtl" lang="ar">${esc(t("welcome_title_ar"))}</p>
        <h1 class="welcome-title">${esc(t("app_title"))}</h1>
        <p class="welcome-tagline">${esc(t("welcome_tagline"))}</p>
      </div>
      <ul class="welcome-points">
        ${POINTS.map(([id, key]) => `<li>${icon(id)}<span>${esc(t(key))}</span></li>`).join("")}
      </ul>
      <button type="button" class="btn block welcome-start" id="welcome-start">${esc(t("welcome_start"))}</button>
    </section>`;
}

// onStart: يكمل للخطوة اللي بعد الترحيب (تجهيز الكاميرا).
export function renderWelcome(root, { onStart }) {
  root.innerHTML = welcomeHtml();
  root.querySelector("#welcome-start").onclick = onStart;
  return () => {};
}
