// Run: node scripts/build-content.mjs
//
// Writes src/content/fajr.json from docs/content-source.md. Every piece of religious text is
// copied mechanically by scripts/content-source.mjs, never typed or reworded here.
// The "preparation" block comes from docs/preparation-source.md the same way; it has its
// own review state, kept exactly as that file gives it. The Al-Fatihah "reference" string
// used for checking is preserved untouched — it is never regenerated from either source.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseContentSource } from "./content-source.mjs";
import { parsePreparationSource } from "./preparation-source.mjs";

const url = (p) => new URL(p, import.meta.url);
const src = parseContentSource(readFileSync(url("../docs/content-source.md"), "utf8"));
const prep = parsePreparationSource(readFileSync(url("../docs/preparation-source.md"), "utf8"));
const existing = JSON.parse(readFileSync(url("../src/content/fajr.json"), "utf8"));
const prev = Object.fromEntries(existing.steps.map((s) => [s.id, s]));

// Audio is wired only when the file is actually on disk; otherwise it stays TODO and
// renders nothing. public/audio has no transition-takbir recording yet.
const audio = (name) => {
  for (const ext of ["mp3", "m4a", "ogg", "wav"]) {
    if (existsSync(url(`../public/audio/${name}.${ext}`))) return `/audio/${name}.${ext}`;
  }
  return "TODO";
};

const titleEn = (parts) => parts.join(" — ");

function base(id, s, { nameAr, nameEnParts } = {}) {
  const step = {
    id,
    type: prev[id]?.type ?? "guided",
    ...(prev[id]?.check ? { check: prev[id].check } : {}),
    title: { ar: nameAr ?? s.nameAr, en: titleEn(nameEnParts ?? s.nameEnParts) },
    level: s.level,
    instruction: { en: s.instruction || "TODO" },
    ...(s.instructionLevel ? { instructionLevel: s.instructionLevel } : {}),
    source: s.sources,
    sourceRefs: s.sourceRefs,
  };
  return step;
}

const dhikr = (s, audioName) => ({
  arabic: s.dhikrAr,
  transliteration: s.transliteration,
  meaning: { en: s.meaning },
  level: s.dhikrLevel,
  ...(s.once ? { once: true } : {}),
  audio: audioName ? audio(audioName) : "TODO",
});

const S = src.byId;
const steps = [];

// ---- takbir ----
steps.push({ ...base("takbir", S.takbir), dhikr: dhikr(S.takbir, "takbir") });

// ---- standing ----
// The source file's "standing" entry bundles the standing posture with Al-Fatihah.
// The posture half lives here; the Fatihah half becomes the fatiha step below.
steps.push({
  ...base("standing", S.standing),
  source: "الاسم:[2] | التعليمات:[3]",
  sourceRefs: [2, 3],
});

// ---- fatiha ----
// The checking reference is NOT regenerated: it stays exactly as the AI module expects.
const fatihaVerses = src.verses.filter((v) => !v.level); // the six verses of the surah
const sunnahVerses = src.verses.filter((v) => v.level === "sunnah"); // basmala and amin
steps.push({
  id: "fatiha",
  type: "speech",
  title: { ar: S.standing.dhikrAr, en: S.standing.transliteration },
  level: S.standing.dhikrLevel,
  instruction: { en: prev.fatiha.instruction.en },
  reference: prev.fatiha.reference,
  verses: fatihaVerses.map((v) => ({ arabic: v.arabic, transliteration: v.transliteration, meaning: v.meaning })),
  sunnahVerses: sunnahVerses.map((v) => ({
    arabic: v.arabic, transliteration: v.transliteration, meaning: v.meaning, level: v.level, sourceRefs: v.refs,
  })),
  audio: audio("fatiha"),
  source: "المعنى:[4] | النطق:[15] | الترخيص:[16] | الصوت:[14]",
  sourceRefs: [...new Set([...src.fatihaRefs, 14])].sort((a, b) => a - b),
});

// ---- the two transition takbirs (section 3 splits the single definition in section 1) ----
const T = src.byId.takbir_transition;
const row = (needle) => src.transitions.find((t) => t.from.includes(needle));
for (const [id, marker] of [["takbir_to_ruku", "للركوع"], ["takbir_to_sujood", "السجود"]]) {
  const r = row(marker);
  steps.push({
    ...base(id, T),
    // every row of section 3 now gives its own instruction; raising the hands is sunnah
    // on row 1 (into rukū) only — row 3 (into sujood) carries none
    instruction: { en: r.instruction || "TODO" },
    instructionLevel: r.raiseHands ? "sunnah" : undefined,
    raiseHands: r.raiseHands,
    ruling: r.ruling,
    transitionFrom: r.from,
    dhikr: dhikr(T, "takbir_transition"),
    sourceRefs: [...new Set([...T.sourceRefs, ...src.transitionRefs])].sort((a, b) => a - b),
  });
}

// ---- rising: row 2 (ركوع → وقوف) replaces its section-1 instruction with the
// transition table's own wording for the same takbir, sunnah-labelled like row 1 ----
steps.push({
  ...base("rising", S.rising),
  instruction: { en: row("الركوع ← للوقوف").instruction || "TODO" },
  instructionLevel: "sunnah",
  dhikr: dhikr(S.rising, "rising"),
});

// ---- the remaining steps ----
for (const id of ["ruku", "itidal", "sujood", "jalsa", "tashahhud", "taslim"]) {
  steps.push({ ...base(id, S[id]), dhikr: dhikr(S[id], id) });
}

// ---- second_rakah keeps its own transition wording, it has no entry in the source file ----
steps.push({ ...prev.second_rakah, level: prev.second_rakah.level ?? null });

// strip undefined keys produced above
const tidy = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? undefined : v)));

// ---- transition notes, defined once and referenced from the order ----
const note = (needle) => {
  const r = row(needle);
  return {
    dhikr: r.dhikr,
    transliteration: S.takbir.transliteration, // the takbir step's transliteration, as instructed
    instruction: r.instruction || "TODO",
    raiseHands: r.raiseHands,
    ruling: r.ruling,
    from: r.from,
    sourceRefs: src.transitionRefs,
  };
};
const transitions = {
  to_jalsa: note("للجلوس"),
  to_sujood: note("من الجلوس"),
  to_standing: note("الركعة الثانية"),
  to_tashahhud: note("لجلسة التشهد"),
};

// ---- the journey: ids, with a transition note where section 3 gives one ----
const rakah = (last) => [
  "standing", "fatiha", "takbir_to_ruku", "ruku", "rising", "itidal", "takbir_to_sujood", "sujood",
  { id: "jalsa", transition: "to_jalsa" },
  { id: "sujood", transition: "to_sujood" },
  last,
];
const order = [
  "takbir",
  ...rakah({ id: "second_rakah", transition: "to_standing" }),
  ...rakah({ id: "tashahhud", transition: "to_tashahhud" }),
  "taslim",
];

const out = {
  _note: existing._note,
  prayer: existing.prayer,
  preparation: prep.map((p) => ({
    id: p.id,
    title: { ar: p.titleAr, en: p.titleEn },
    text: p.text,
    ...(p.detail ? { detail: p.detail } : {}),
    source: p.source,
    url: p.url,
    ...(p.source2 ? { source2: p.source2, url2: p.url2 } : {}),
    ...(p.link ? { link: p.link } : {}),
    reviewed: p.reviewed,
  })),
  sources: src.sources,
  transitions,
  order,
  steps: tidy(steps),
};

writeFileSync(url("../src/content/fajr.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`steps: ${out.steps.length} · order: ${order.length} · sources: ${Object.keys(out.sources).length}`);
console.log(`audio wired: ${out.steps.filter((s) => (s.dhikr?.audio ?? s.audio ?? "TODO") !== "TODO").length}`);
console.log(`reference unchanged: ${out.steps.find((s) => s.id === "fatiha").reference === prev.fatiha.reference}`);

// ---- SOURCES.md: the content rows are generated so the source strings stay verbatim ----
// The hand-written tables (videos, software and models) are kept exactly as they are.
const sourcesMd = readFileSync(url("../SOURCES.md"), "utf8");
const KEEP = sourcesMd.slice(sourcesMd.indexOf("## Demonstration videos"));
// the content owner separates a step's sources with "|", which is also the Markdown
// table separator, so it is escaped in the cell
const cell = (v) => String(v ?? "—").replaceAll("|", "\\|");
const link = (n) => (src.sources[n]?.url ? `[[${n}]](${src.sources[n].url})` : `[${n}]`);
const refList = (refs) => refs.map(link).join(" ");

const contentRows = out.steps
  .map((s) => `| \`${s.id}\` | ${cell(s.title.ar)} — ${cell(s.title.en)} | ${cell(s.source)} | ${refList(s.sourceRefs ?? [])} |`)
  .join("\n");

const sourceRows = Object.entries(src.sources)
  .map(([n, v]) => `| [${n}] | ${cell(v.title)} | ${v.url ? `<${v.url}>` : "TODO"} |`)
  .join("\n");

// ---- the preparation screen's own rows, from docs/preparation-source.md ----
const prepCite = (title, u) => (u ? `[${cell(title)}](${u})` : cell(title));
const prepRows = out.preparation
  .map((p) => {
    const sources = [prepCite(p.source, p.url), ...(p.url2 ? [prepCite(p.source2, p.url2)] : [])].join(", ");
    return `| \`${p.id}\` | ${cell(p.title.ar)} — ${cell(p.title.en)} | ${sources} | ${p.detail ? cell(p.detail) : "—"} |`;
  })
  .join("\n");
// computed from the data, not hand-typed, so it can't silently claim a review that didn't happen
const prepReviewLine = out.preparation.every((p) => p.reviewed)
  ? "Reviewed by the content owner; specialist (Sharia) review pending."
  : "Draft — not yet reviewed by the content owner.";
const prepMediaRows = out.preparation
  .filter((p) => p.link)
  .map((p) => `| \`${p.id}\` | external video (YouTube) | ${p.link} | TODO | TODO |`)
  .join("\n");

writeFileSync(
  url("../SOURCES.md"),
  `# Sources and attributions

Generated by \`node scripts/build-content.mjs\` from \`docs/content-source.md\` (the content
owner's final table). The religious content, its source strings and the numbered references
below are copied from that file verbatim — edit it there, not here.

## Religious content (\`src/content/fajr.json\`)

Reviewed by the content owner. Every step carries the reference numbers it came from.

| Step | Title | Source (as given by the content owner) | References |
| --- | --- | --- | --- |
${contentRows}

Transition takbir (\`takbir_to_ruku\`, \`takbir_to_sujood\` and the transition notes in the
journey): ${refList(src.transitionRefs)}. Al-Fatihah verses: ${refList(src.fatihaRefs)}.

## Preparation screen ("Before you pray")

${prepReviewLine} The screen is a reminder only — the app checks none of this.

| Item | Title | Sources | Detail shown on screen |
| --- | --- | --- | --- |
${prepRows}

### Preparation screen media

| Item | Type | URL | Channel / author | Reviewed by |
| --- | --- | --- | --- | --- |
${prepMediaRows}

## Notes from the content owner

${src.notes.map((n) => `- ${n}`).join("\n")}

## Recitation audio (\`public/audio/\`)

| Item | Source | License / terms |
| --- | --- | --- |
| Dhikr audio for the steps (${out.steps.filter((s) => (s.dhikr?.audio ?? s.audio ?? "TODO") !== "TODO").length} files) | ElevenLabs Text to Speech ${link(12)}, pronunciation reviewed by the team | Free plan, non-commercial use ${link(13)} |
| Al-Fatihah transliteration | Quran.com ${link(15)} | Quran.Foundation Developer Terms of Service ${link(16)} |
| Al-Fatihah meaning (Dr. Ghali) | ${src.sources[4].title} | ${src.sources[4].url ? `<${src.sources[4].url}>` : "TODO"} |
| Al-Fatihah recitation | Sheikh Abu Bakr Al-Shatri (mp3quran.net) ${link(14)} | ${src.sources[14].url ? `<${src.sources[14].url}>` : "TODO"} |
| Transition takbir audio | not recorded yet | TODO |

## Numbered references

| # | Source | Link |
| --- | --- | --- |
${sourceRows}

${KEEP}`
);
console.log(`SOURCES.md: ${out.steps.length} content rows · ${Object.keys(src.sources).length} references`);
