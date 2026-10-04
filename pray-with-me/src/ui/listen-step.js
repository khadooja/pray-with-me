// خطوة الفاتحة لما يكون فحص التلاوة مطفأً (SPEECH_CHECK_ENABLED = false):
// "اسمع وردّد" — نعرض الآيات، ومعها النطق والمعنى والصوت إذا كانوا جاهزين،
// وزر "قرأتها" يكمل للخطوة اللي بعدها.
//
// ⚠️ هذا الملف **ما يستورد** المايك (../speech/index.js) ولا سجل المحاولات
// (../progress/store.js) **عن قصد**: فما عنده أي طريقة يطلب بها المايك أو ينزّل نموذجاً
// أو يسجّل محاولة. الاختبار يتأكد من هذا.
import { t } from "../i18n/index.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// الحقول في fajr.json لسه فيها "TODO" (المحتوى ما خلص).
// ما نعرض كلمة TODO للمستخدم أبداً: إذا القيمة ناقصة نخفي السطر كله.
export function ready(value) {
  const v = String(value ?? "").trim();
  return v !== "" && v !== "TODO";
}

// محتوى منطقة التدريب. دالة صافية ترجع HTML، عشان نقدر نختبرها.
export function listenStepHtml(step) {
  return `
    <section class="card">
      <p class="label">${esc(t("recite_this"))}</p>
      <p class="arabic reference" dir="rtl" lang="ar">${esc(step.reference)}</p>
      ${ready(step.transliteration) ? `<p class="translit">${esc(step.transliteration)}</p>` : ""}
      ${ready(step.meaning) ? `<p class="meaning">${esc(step.meaning)}</p>` : ""}
      ${ready(step.audio) ? `<audio class="dhikr-audio" controls preload="none" src="${esc(step.audio)}"></audio>` : ""}
    </section>
    <p class="hint">${esc(t("listen_repeat_hint"))}</p>
    <button class="btn" id="recited">${esc(t("i_have_recited"))}</button>`;
}

// يرسم الخطوة ويربط الزر. onDone تُنادى مرة وحدة لما يضغط "قرأتها".
// يرجع دالة تنظيف مثل بقية الخطوات (ما فيه شيء يُنظَّف هنا، لكن نحافظ على نفس الشكل).
export function renderListenStep(step, root, onDone) {
  root.innerHTML = listenStepHtml(step);
  const btn = root.querySelector("#recited");
  if (btn) btn.onclick = () => onDone?.();
  return () => {};
}
