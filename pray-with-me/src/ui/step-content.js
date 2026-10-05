// بناء أجزاء محتوى الخطوة: تصنيف الركن/الواجب/السنة، ملاحظة الانتقال، آيات الفاتحة،
// وروابط المصادر. دوال صافية ترجع HTML، عشان نقدر نختبرها بدون متصفح.
//
// ⚠️ ما فيه أي نص ديني مكتوب هنا: كل الكلام يجي من fajr.json (منسوخ من ملف مالكة المحتوى)،
// وكل كلمات الواجهة من en.json.
import { t, has } from "../i18n/index.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ما نعرض كلمة TODO للمستخدم أبداً: أي حقل ناقص يختفي سطره
export function ready(value) {
  const v = String(value ?? "").trim();
  return v !== "" && v !== "TODO";
}

// شارة التصنيف: ركن / واجب / سنة
export function levelBadge(level, extraClass = "") {
  if (!level) return "";
  const key = `level_${level}`;
  if (!has(key)) return "";
  return `<span class="level level-${esc(level)} ${extraClass}">${esc(t(key))}</span>`;
}

// سطر التعليمات، ومعه شارة "سنة" إذا كانت التعليمات سنة
export function instructionLine(step) {
  if (!ready(step.instruction?.en)) return "";
  return `<p class="instruction">${esc(step.instruction.en)}${
    step.instructionLevel ? ` ${levelBadge(step.instructionLevel, "inline")}` : ""
  }</p>`;
}

// ملاحظة الانتقال: تظهر في أول الخطوة اللي بعد الانتقال
export function transitionNote(note) {
  if (!note) return "";
  return `
    <section class="transition-note">
      <p class="transition-head">${esc(t("transition_title"))}</p>
      <p class="arabic" dir="rtl" lang="ar">${esc(note.dhikr)}</p>
      ${ready(note.transliteration) ? `<p class="translit">${esc(note.transliteration)}</p>` : ""}
      ${ready(note.instruction) ? `<p class="transition-instruction">${esc(note.instruction)}</p>` : ""}
    </section>`;
}

// آيات الفاتحة: عربي + نطق + معنى لكل آية
export function versesList(verses = []) {
  if (!verses.length) return "";
  return `<ol class="verses">${verses
    .map(
      (v) => `<li class="verse">
        <p class="arabic" dir="rtl" lang="ar">${esc(v.arabic)}</p>
        ${ready(v.transliteration) ? `<p class="translit">${esc(v.transliteration)}</p>` : ""}
        ${ready(v.meaning) ? `<p class="meaning">${esc(v.meaning)}</p>` : ""}
      </li>`
    )
    .join("")}</ol>
    <p class="ayn-note">${esc(t("ayn_note"))}</p>`;
}

// البسملة والتأمين: سنة، في بطاقة منفصلة، وما تدخل أبداً في الفحص
export function sunnahVersesCard(verses = []) {
  if (!verses.length) return "";
  return `
    <section class="card sunnah-card">
      <p class="sunnah-head">${levelBadge("sunnah")}</p>
      ${verses
        .map(
          (v) => `<div class="verse">
            <p class="arabic" dir="rtl" lang="ar">${esc(v.arabic)}</p>
            ${ready(v.transliteration) ? `<p class="translit">${esc(v.transliteration)}</p>` : ""}
            ${ready(v.meaning) ? `<p class="meaning">${esc(v.meaning)}</p>` : ""}
          </div>`
        )
        .join("")}
    </section>`;
}

// مصادر الخطوة: أرقام صغيرة تفتح رابط المصدر في تبويب جديد
export function sourceLinks(refs = [], sources = {}) {
  const valid = refs.filter((n) => sources[n]?.url);
  if (!valid.length) return "";
  return `
    <p class="sources">
      <span class="sources-label">${esc(t("sources_label"))}</span>
      ${valid
        .map(
          (n) =>
            `<a class="source-ref" href="${esc(sources[n].url)}" target="_blank" rel="noopener noreferrer"
               title="${esc(sources[n].title)}">[${n}]</a>`
        )
        .join(" ")}
    </p>`;
}
