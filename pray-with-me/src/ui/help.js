// لوح "تحتاج مساعدة؟": يفتح من أي خطوة ويعرض نفس محتواها (بدون أي نص مولّد).
// كل النصوص من en.json، وكل المحتوى من fajr.json.
import { t } from "../i18n/index.js";
import { ready } from "./step-content.js";
import { HELP_CONTACT_URL } from "../config.js";
import { showActionSheet } from "./sheet.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// نعرض رابط "تكلّم مع شخص" فقط إذا فيه رابط حقيقي.
// ما دام "TODO" أو فاضي، ما نعرض السطر أصلاً: أفضل من رابط ميّت.
export function helpContactVisible(url = HELP_CONTACT_URL) {
  const value = String(url ?? "").trim();
  return value !== "" && value !== "TODO";
}

// أزرار اللوح. دالة صافية عشان نقدر نختبرها بدون متصفح.
export function helpActions(step, { url = HELP_CONTACT_URL, onReplay, onTryAgain } = {}) {
  const actions = [];
  if (onReplay) actions.push({ label: t("help_replay_figure"), onClick: onReplay });
  actions.push({ label: t("help_try_again"), primary: true, onClick: onTryAgain });
  if (helpContactVisible(url)) actions.push({ label: t("help_contact"), href: url });
  return actions;
}

// محتوى اللوح: تعليمات الخطوة وذكرها كما هي في fajr.json
export function helpBody(step) {
  const d = step.dhikr;
  return `
    ${ready(step.instruction?.en) ? `<p class="help-instruction">${esc(step.instruction.en)}</p>` : ""}
    ${
      d
        ? `<section class="card dhikr help-dhikr">
            <p class="arabic" dir="rtl" lang="ar">${esc(d.arabic)}</p>
            ${ready(d.transliteration) ? `<p class="translit">${esc(d.transliteration)}</p>` : ""}
            ${ready(d.meaning?.en) ? `<p class="meaning">${esc(d.meaning.en)}</p>` : ""}
            ${ready(d.audio) ? `<audio class="dhikr-audio" controls preload="none" src="${esc(d.audio)}"></audio>` : ""}
          </section>`
        : ""
    }`;
}

export function showHelpSheet(step, handlers) {
  return showActionSheet({
    title: t("help_title"),
    bodyHtml: helpBody(step),
    actions: helpActions(step, handlers),
  });
}
