// خطوة الفاتحة لما يكون فحص التلاوة مطفأً (SPEECH_CHECK_ENABLED = false):
// "اسمع وردّد" — نعرض الآيات، ومعها النطق والمعنى والصوت إذا كانوا جاهزين،
// وزر "قرأتها" يكمل للخطوة اللي بعدها.
//
// ⚠️ هذا الملف **ما يستورد** المايك (../speech/index.js) ولا سجل المحاولات
// (../progress/store.js) **عن قصد**: فما عنده أي طريقة يطلب بها المايك أو ينزّل نموذجاً
// أو يسجّل محاولة. الاختبار يتأكد من هذا.
import { t } from "../i18n/index.js";
import { versesList, sunnahVersesCard, ready } from "./step-content.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ما نعرض كلمة TODO للمستخدم أبداً: إذا القيمة ناقصة نخفي السطر كله.
// التعريف في step-content.js، ونعيد تصديره من هنا عشان الاختبارات القديمة.
export { ready };

// محتوى منطقة التدريب. دالة صافية ترجع HTML، عشان نقدر نختبرها.
export function listenStepHtml(step) {
  return `
    <section class="card">
      <p class="label">${esc(t("recite_this"))}</p>
      ${
        // الآيات كل آية بسطرها (عربي + نطق + معنى). إذا المحتوى لسه ما وصل،
        // نرجع للنص المرجعي كامل بدون تفصيل.
        step.verses?.length
          ? versesList(step.verses)
          : `<p class="arabic reference" dir="rtl" lang="ar">${esc(step.reference)}</p>`
      }
      ${ready(step.audio) ? `<audio class="dhikr-audio" controls preload="none" src="${esc(step.audio)}"></audio>` : ""}
    </section>
    ${/* البسملة والتأمين: سنة، في بطاقة منفصلة، وما تدخل أبداً في الفحص */ ""}
    ${sunnahVersesCard(step.sunnahVerses)}
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
