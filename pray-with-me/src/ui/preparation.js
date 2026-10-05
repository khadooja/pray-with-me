// شاشة "قبل أن تصلي": ست تذكيرات قبل تكبيرة الإحرام.
//
// ⚠️ المحتوى مسودّة (reviewed: false على كل عنصر في fajr.json)، ومالكة المحتوى تراجعه.
// الشاشة **تذكير فقط**: التطبيق ما يفحص أياً منها.
// ⚠️ هذا الملف ما يستورد سجل المحاولات (../progress/store.js) ولا المايك **عن قصد**:
// علامات الصح هنا ليست "محاولات"، وما نسجّلها ولا نرسلها لأي مكان. الاختبار يتأكد.
import { t } from "../i18n/index.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// أيقونات خطية بسيطة، واحدة لكل عنصر. تقدرون تبدلونها بحرية.
const ICONS = {
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wudu: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z"/>',
  purity: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>',
  cover: '<path d="M9 3l3 2 3-2 5 3-2 4-2-1v10H8V9L6 10 4 6z"/>',
  qibla: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  intent: '<path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z"/>',
};

const icon = (id) =>
  `<svg class="prep-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] ?? ICONS.intent}</svg>`;

// هل كل العناصر متعلّمة؟ (الزر ما يشتغل إلا بعدها)
export function allChecked(items, checked) {
  return items.length > 0 && items.every((i) => checked.has(i.id));
}

export function preparationHtml(items, checked) {
  const done = items.filter((i) => checked.has(i.id)).length;
  const ready = allChecked(items, checked);

  const segments = items
    .map((i) => `<span class="prep-seg${checked.has(i.id) ? " on" : ""}"></span>`)
    .join("");

  const cards = items
    .map(
      (i) => `
      <button type="button" class="prep-card${checked.has(i.id) ? " on" : ""}"
              data-id="${esc(i.id)}" aria-pressed="${checked.has(i.id)}">
        ${icon(i.id)}
        <span class="prep-body">
          <span class="prep-head">
            <strong>${esc(i.title.en)}</strong>
            <span class="prep-ar" dir="rtl" lang="ar">${esc(i.title.ar)}</span>
          </span>
          <span class="prep-text">${esc(i.text)}</span>
          ${i.id === "qibla" ? `<span class="prep-soon">${esc(t("prep_qibla_soon"))}</span>` : ""}
        </span>
        <span class="prep-check" aria-hidden="true"></span>
      </button>`
    )
    .join("");

  const sources = items
    .map(
      (i) => `<li><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.source)}</a></li>`
    )
    .join("");

  return `
    <p class="prep-label">${esc(t("prep_label"))}</p>
    <h1 class="prep-title">
      <span class="ar" dir="rtl" lang="ar">${esc(t("prep_title_ar"))}</span>
      <span class="en">${esc(t("prep_title_en"))}</span>
    </h1>
    <p class="instruction">${esc(t("prep_subtitle"))}</p>

    <div class="prep-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${items.length}"
         aria-valuenow="${done}" aria-label="${esc(t("prep_progress", { x: done, n: items.length }))}">
      <span class="prep-segments">${segments}</span>
      <span class="prep-count" id="prep-count">${esc(t("prep_progress", { x: done, n: items.length }))}</span>
    </div>

    <div class="prep-cards">${cards}</div>

    <p class="prep-note">
      <svg class="prep-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.2"/></svg>
      ${esc(t("prep_note"))}
    </p>
    <button type="button" class="link" id="prep-sources-toggle" aria-expanded="false">${esc(t("prep_sources"))}</button>
    <ul class="prep-sources" id="prep-sources" hidden>${sources}</ul>

    <div class="bottom-spacer"></div>
    <div class="bottom-bar">
      <button class="btn block" id="prep-ready" ${ready ? "" : "disabled"}>${esc(t("im_ready"))}</button>
      <p class="prep-hint" id="prep-hint"${ready ? " hidden" : ""}>${esc(t("prep_hint"))}</p>
    </div>`;
}

// يرسم الشاشة ويربط الأزرار. onReady تُنادى لما يضغط "أنا جاهز" بعد تعليم الكل.
// يرجع دالة تنظيف مثل بقية الشاشات.
export function renderPreparation(root, items, { onReady } = {}) {
  const checked = new Set();

  function paint() {
    root.innerHTML = preparationHtml(items, checked);

    root.querySelectorAll(".prep-card").forEach((card) => {
      card.onclick = () => {
        const id = card.dataset.id;
        if (checked.has(id)) checked.delete(id);
        else checked.add(id);
        paint(); // نعيد الرسم عشان الشريط والعدّاد والزر يتحدثون مع بعض
      };
    });

    const toggle = root.querySelector("#prep-sources-toggle");
    const list = root.querySelector("#prep-sources");
    if (toggle && list) {
      toggle.onclick = () => {
        const open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        if (open) list.setAttribute("hidden", "");
        else list.removeAttribute("hidden");
      };
    }

    const ready = root.querySelector("#prep-ready");
    if (ready) ready.onclick = () => allChecked(items, checked) && onReady?.();
  }

  paint();
  return () => {};
}
