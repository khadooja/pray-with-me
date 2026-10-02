// الألواح اللي تطلع من تحت (bottom sheet): لوح النجاح بعد ما الخطوة تنجح، ولوح التأكيد عند الخروج.
// كلها شكل فقط، ما فيها أي منطق تقييم. النصوص من en.json.
// تقدرون تغيرون الشكل من style.css (الأصناف: .sheet-backdrop و .sheet).
import { t } from "../i18n/index.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let openSheet = null; // لوح واحد بس يكون مفتوح

// يسكّر اللوح المفتوح (إذا فيه). ننادونها قبل الانتقال لأي خطوة.
export function dismissSheet() {
  openSheet?.();
}

// الأساس المشترك: خلفية معتمة + لوح يطلع من تحت.
// buttons: [{ label, primary, onClick }] — الزر الأساسي يأخذ التركيز.
// dismissible: يسكّر بالضغط على الخلفية أو زر Escape.
// focusIndex: أي زر يأخذ التركيز (في لوح التأكيد نركّز على "البقاء" مو على الخروج).
function showSheet({ title, text, buttons, label, dismissible = true, focusIndex = 0 }) {
  dismissSheet(); // ما نكدّس ألواح فوق بعض
  const host = document.getElementById("app");
  if (!host) return () => {};

  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label ?? title)}">
      <h2 class="sheet-title">${esc(title)}</h2>
      ${text ? `<p class="sheet-text">${esc(text)}</p>` : ""}
      <div class="sheet-actions">
        ${buttons
          .map(
            (b, i) =>
              `<button type="button" class="btn block${b.primary ? "" : " secondary"}" data-i="${i}">${esc(b.label)}</button>`
          )
          .join("")}
      </div>
    </section>`;
  host.appendChild(backdrop);

  function close() {
    if (openSheet !== close) return;
    openSheet = null;
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
  }
  function onKey(e) {
    if (e.key === "Escape" && dismissible) close();
  }

  buttons.forEach((b, i) => {
    backdrop.querySelector(`[data-i="${i}"]`).onclick = () => {
      close();
      b.onClick?.();
    };
  });
  // الضغط على الخلفية نفسها (مو على اللوح) يسكّر
  if (dismissible) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };
  }
  document.addEventListener("keydown", onKey);
  openSheet = close;

  // نضيف الصنف في الإطار اللي بعده عشان الحركة (الانزلاق من تحت) تشتغل
  requestAnimationFrame(() => backdrop.classList.add("open"));
  backdrop.querySelector(`[data-i="${focusIndex}"]`)?.focus();
  return close;
}

// لوح النجاح: كلمة قصيرة + سطر يشرح ليش الوضعية كانت صحيحة + زر "متابعة".
export function showSuccessSheet({ title, text, onContinue }) {
  return showSheet({
    title,
    text,
    buttons: [{ label: t("continue"), primary: true, onClick: onContinue }],
  });
}

// لوح التأكيد عند الضغط على زر الخروج (✕).
export function showConfirmSheet({ title, text, confirmLabel, cancelLabel, onConfirm }) {
  return showSheet({
    title,
    text,
    buttons: [
      { label: cancelLabel, primary: false },
      { label: confirmLabel, primary: true, onClick: onConfirm },
    ],
    focusIndex: 0, // "البقاء" هو المركّز، عشان ضغطة Enter ما تخرج المستخدم بالغلط
  });
}
