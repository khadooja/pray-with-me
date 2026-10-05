// Run: node tests/content.test.mjs   (or npm test)
//
// src/content/fajr.json is generated from docs/content-source.md (the content owner's
// final table) by scripts/build-content.mjs. This file re-parses that same document and
// proves, character for character, that nothing was retyped, reworded or "corrected" on
// the way in — and that anything still missing shows as nothing rather than as "TODO".
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseContentSource, LEVELS } from "../scripts/content-source.mjs";
import { parsePreparationSource } from "../scripts/preparation-source.mjs";
import { entryId, journeyTransitions, resolveJourney } from "../src/content/journey.js";
import {
  ready, levelBadge, instructionLine, transitionNote, versesList, sunnahVersesCard, sourceLinks,
} from "../src/ui/step-content.js";

const url = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(url(p), "utf8");
const fajr = JSON.parse(read("../src/content/fajr.json"));
const en = JSON.parse(read("../src/i18n/en.json"));
const src = parseContentSource(read("../docs/content-source.md"));
const byId = Object.fromEntries(fajr.steps.map((s) => [s.id, s]));
const S = src.byId;
// section 3's own rows (the transition takbirs), matched the same way build-content.mjs does
const row = (needle) => src.transitions.find((t) => t.from.includes(needle));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ---------- copied, not written ----------

// which step in fajr.json came from which row of the content owner's table
const FROM_SOURCE = {
  takbir: "takbir",
  standing: "standing",
  ruku: "ruku",
  rising: "rising",
  itidal: "itidal",
  sujood: "sujood",
  jalsa: "jalsa",
  tashahhud: "tashahhud",
  taslim: "taslim",
  takbir_to_ruku: "takbir_transition",
  takbir_to_sujood: "takbir_transition",
};

test("every Arabic name is copied from the content owner's table, character for character", () => {
  for (const [id, row] of Object.entries(FROM_SOURCE)) {
    assert.equal(byId[id].title.ar, S[row].nameAr, `${id}: the Arabic name was altered`);
  }
});

test("every English name is copied as given", () => {
  for (const [id, row] of Object.entries(FROM_SOURCE)) {
    assert.equal(byId[id].title.en, S[row].nameEnParts.join(" — "), `${id}: the English name was altered`);
  }
});

test("every dhikr, transliteration and meaning is copied as given", () => {
  for (const [id, row] of Object.entries(FROM_SOURCE)) {
    // the table's standing row carries Al-Fatihah; it became the fatiha step's verses
    if (id === "standing") continue;
    const d = byId[id].dhikr;
    if (!S[row].dhikrAr) {
      assert.equal(d, undefined, `${id}: carries a dhikr the table does not give`);
      continue;
    }
    assert.equal(d.arabic, S[row].dhikrAr, `${id}: the dhikr was altered`);
    assert.equal(d.transliteration, S[row].transliteration, `${id}: the transliteration was altered`);
    assert.equal(d.meaning.en, S[row].meaning, `${id}: the meaning was altered`);
  }
});

test("instructions are copied as given, typos and spacing included", () => {
  // deliberately exact: the content owner's wording is hers to change, not ours
  // takbir_to_ruku/takbir_to_sujood/rising now take theirs from section 3's own column
  // instead of this section-1 text — checked separately, below
  const fromSection3 = ["takbir_to_ruku", "takbir_to_sujood", "rising"];
  for (const [id, r] of Object.entries(FROM_SOURCE)) {
    if (fromSection3.includes(id)) continue;
    assert.equal(byId[id].instruction.en, S[r].instruction || "TODO", `${id}: the instruction was reworded`);
  }
});

test("each step keeps the content owner's own source string", () => {
  for (const [id, row] of Object.entries(FROM_SOURCE)) {
    if (id === "standing") continue; // split between standing and fatiha, see build-content.mjs
    assert.ok(byId[id].source.includes(S[row].sources.split("|")[0].trim()),
      `${id}: the source line no longer matches the table`);
  }
});

test("the twenty-one numbered sources are copied with their links", () => {
  assert.equal(Object.keys(fajr.sources).length, 21);
  for (const [n, entry] of Object.entries(src.sources)) {
    assert.equal(fajr.sources[n].title, entry.title, `[${n}]: the title was altered`);
    assert.equal(fajr.sources[n].url, entry.url, `[${n}]: the link was altered`);
  }
});

test("every reference a step cites exists in the sources map", () => {
  for (const s of fajr.steps) {
    for (const n of s.sourceRefs ?? []) {
      assert.ok(fajr.sources[n], `${s.id} cites [${n}], which is not in the sources map`);
    }
  }
});

// ---------- Al-Fatihah ----------

test("the Al-Fatihah verses are copied from the table, in order", () => {
  const fromTable = src.verses.filter((v) => !v.level);
  assert.equal(byId.fatiha.verses.length, fromTable.length, "a verse was added or dropped");
  byId.fatiha.verses.forEach((v, i) => {
    assert.equal(v.arabic, fromTable[i].arabic, `verse ${i + 1}: the Arabic was altered`);
    assert.equal(v.transliteration, fromTable[i].transliteration, `verse ${i + 1}: the transliteration was altered`);
    assert.equal(v.meaning, fromTable[i].meaning, `verse ${i + 1}: the meaning was altered`);
  });
});

test("the basmala and the amin are kept apart as Sunnah", () => {
  const sunnah = src.verses.filter((v) => v.level === "sunnah");
  assert.equal(sunnah.length, 2, "the table marks exactly two Sunnah lines");
  assert.equal(byId.fatiha.sunnahVerses.length, 2);
  for (const v of byId.fatiha.sunnahVerses) assert.equal(v.level, "sunnah");
  byId.fatiha.sunnahVerses.forEach((v, i) => {
    assert.equal(v.arabic, sunnah[i].arabic, "a Sunnah line was altered");
  });
});

test("the checking reference is byte-identical to the reviewed text", () => {
  assert.equal(
    byId.fatiha.reference,
    "الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين اياك نعبد واياك نستعين اهدنا الصراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين"
  );
});

test("the Sunnah lines are excluded from what is checked", () => {
  // the matcher must never fail someone for leaving out something not required
  for (const v of byId.fatiha.sunnahVerses) {
    const firstWord = v.arabic.split(/\s+/)[0];
    assert.ok(!byId.fatiha.reference.includes(firstWord),
      `"${firstWord}" is Sunnah but appears in the checked reference`);
  }
});

test("the AA note explains the ayn, and the verses list carries it", () => {
  assert.ok(en.ayn_note.includes("AA"), "the note must name the letter pair it explains");
  // the renderer escapes quotes, so compare against the escaped form
  const escaped = en.ayn_note.replace(/"/g, "&quot;");
  assert.ok(versesList(byId.fatiha.verses).includes(escaped), "the note must be on the verses list");
});

// ---------- levels ----------

test("every step carries a level, and only the ones the table gives", () => {
  const allowed = [...Object.values(LEVELS), null];
  for (const s of fajr.steps) {
    assert.ok(allowed.includes(s.level ?? null), `${s.id}: unexpected level "${s.level}"`);
    if (s.id !== "second_rakah") {
      assert.ok(s.level, `${s.id}: the table gives it a level, so it must not be missing here`);
    }
  }
});

test("each step's level is the one the table gives it", () => {
  for (const [id, row] of Object.entries(FROM_SOURCE)) {
    assert.equal(byId[id].level, S[row].level, `${id}: the level does not match the table`);
  }
});

test("the instruction level is only set where the table marks one", () => {
  const fromSection3 = ["takbir_to_ruku", "takbir_to_sujood", "rising"]; // checked separately, below
  for (const [id, r] of Object.entries(FROM_SOURCE)) {
    if (fromSection3.includes(id)) continue;
    assert.equal(byId[id].instructionLevel ?? null, S[r].instructionLevel ?? null,
      `${id}: the instruction level does not match the table`);
  }
  // the table marks no level on these two instructions, so neither do we
  assert.equal(byId.itidal.instructionLevel, undefined);
  assert.equal(byId.sujood.instructionLevel, undefined);
});

test("every level has a label, so no raw key ever shows", () => {
  for (const level of Object.values(LEVELS)) {
    assert.ok(en[`level_${level}`], `en.json has no label for "${level}"`);
    assert.ok(levelBadge(level).includes(en[`level_${level}`]));
  }
  assert.equal(levelBadge(null), "", "no level means no badge");
  assert.equal(levelBadge("made_up"), "", "an unknown level renders nothing rather than its key");
});

test("the once marker is on exactly the three dhikr the table marks", () => {
  const once = fajr.steps.filter((s) => s.dhikr?.once).map((s) => s.id).sort();
  assert.deepEqual(once, ["jalsa", "ruku", "sujood"]);
  for (const id of once) assert.ok(S[id].once, `the table does not mark ${id} as said once`);
});

// ---------- the two transition takbirs ----------

test("the transition takbir is two steps: into ruku, and into sujood", () => {
  assert.equal(byId.takbir_to_ruku.raiseHands, true, "the hands are raised going into ruku");
  assert.equal(byId.takbir_to_sujood.raiseHands, false, "the hands are not raised going into sujood");
  // both say the same words, from the same row of the table
  assert.equal(byId.takbir_to_ruku.dhikr.arabic, byId.takbir_to_sujood.dhikr.arabic);
  assert.equal(byId.takbir_to_ruku.dhikr.arabic, S.takbir_transition.dhikrAr);
});

test("every row of section 3 now carries its own instruction", () => {
  // sanity on the source side: all seven rows have real text, not blanks
  assert.equal(src.transitions.length, 7);
  for (const t of src.transitions) {
    assert.ok(t.instruction && t.instruction.trim() !== "", `row "${t.from}" has no instruction`);
  }
});

test("takbir_to_ruku and takbir_to_sujood take their instruction from their own row, verbatim", () => {
  assert.equal(byId.takbir_to_ruku.instruction.en, row("للركوع").instruction);
  assert.equal(byId.takbir_to_sujood.instruction.en, row("السجود").instruction);
  // row 1 (into rukū) raises the hands, sunnah; row 3 (into sujood) carries no level
  assert.equal(byId.takbir_to_ruku.instructionLevel, "sunnah");
  assert.equal(byId.takbir_to_sujood.instructionLevel, undefined, "she gave it no level");
  assert.ok(byId.takbir_to_sujood.sourceRefs.includes(20),
    "the raising-hands fatwa [20] must cite both transition-takbir steps");
  const sujoodHtml = instructionLine(byId.takbir_to_sujood);
  assert.ok(sujoodHtml.includes("Do not raise your hands."), "the instruction must render");
  assert.ok(!sujoodHtml.includes(en.level_sunnah), "no level badge: the table gives this one none");
  const rukuHtml = instructionLine(byId.takbir_to_ruku);
  assert.ok(rukuHtml.includes(en.level_sunnah), "raising the hands is Sunnah and must say so");
});

test("rising replaces its instruction with row 2's text (the takbir said while rising), sunnah-labelled", () => {
  const r2 = row("الركوع ← للوقوف");
  assert.equal(r2.raiseHands, true);
  assert.equal(byId.rising.instruction.en, r2.instruction);
  assert.equal(byId.rising.instructionLevel, "sunnah");
  // its name, level and dhikr are untouched — only the instruction text changed source
  assert.equal(byId.rising.title.ar, S.rising.nameAr);
  assert.equal(byId.rising.dhikr.arabic, S.rising.dhikrAr);
});

test("the two documented irregularities survive verbatim, uncorrected", () => {
  // row 5: a stray space before the period ("Sujūd .")
  assert.ok(row("من الجلوس ← للسجود").instruction.includes("Sujūd ."),
    "row 5's stray space before the period must not be auto-corrected");
  // row 7: no "s", no trailing period ("...your hand")
  assert.ok(row("لجلسة التشهد").instruction.endsWith("your hand"),
    "row 7's missing s/period must not be auto-corrected");
});

test("the transition notes are defined once and attached by position", () => {
  const notes = journeyTransitions(fajr);
  const where = notes.map((n, i) => (n ? entryId(fajr.order[i]) : null)).filter(Boolean);
  assert.deepEqual(where, ["jalsa", "sujood", "second_rakah", "jalsa", "sujood", "tashahhud"]);
  // the same four definitions are reused across the two rakahs
  assert.equal(Object.keys(fajr.transitions).length, 4);
  for (const note of Object.values(fajr.transitions)) {
    assert.equal(note.dhikr, S.takbir_transition.dhikrAr, "a note was given different words");
    assert.equal(note.transliteration, S.takbir.transliteration, "the transliteration must come from the takbir step");
    assert.equal(note.raiseHands, false, "the hands are not raised in any of these four transitions");
  }
});

test("a transition note shows the content owner's own instruction, not generated wording", () => {
  const html = transitionNote(fajr.transitions.to_jalsa);
  assert.ok(html.includes(en.transition_title));
  assert.ok(html.includes(fajr.transitions.to_jalsa.instruction), "the row's instruction must render");
  assert.equal(transitionNote(null), "", "a position with no transition renders nothing");
  // the generated "Raise your hands: No/Yes" wording is retired; the keys must be gone
  assert.equal(en.raise_hands_no, undefined, "raise_hands_no must be removed, it is now unused");
  assert.equal(en.raise_hands_yes, undefined, "raise_hands_yes must be removed, it is now unused");
});

test("all four transition notes carry their own row's instruction, verbatim", () => {
  const expected = {
    to_jalsa: row("للجلوس").instruction,
    to_sujood: row("من الجلوس").instruction,
    to_standing: row("الركعة الثانية").instruction,
    to_tashahhud: row("لجلسة التشهد").instruction,
  };
  for (const [key, text] of Object.entries(expected)) {
    assert.equal(fajr.transitions[key].instruction, text, `${key}: instruction does not match its row`);
    assert.ok(transitionNote(fajr.transitions[key]).includes(text), `${key}: must render on screen`);
  }
});

// ---------- nothing unfinished reaches the screen ----------

test("no step renders the word TODO anywhere", () => {
  for (const s of resolveJourney(fajr)) {
    const html = [
      levelBadge(s.level),
      instructionLine(s),
      versesList(s.verses ?? []),
      sunnahVersesCard(s.sunnahVerses ?? []),
      sourceLinks(s.sourceRefs ?? [], fajr.sources),
    ].join("");
    assert.ok(!html.includes("TODO"), `${s.id}: "TODO" would be shown to a user`);
  }
  for (const note of Object.values(fajr.transitions)) {
    assert.ok(!transitionNote(note).includes("TODO"), "a transition note would show TODO");
  }
});

test("audio is wired only to files that are actually on disk", () => {
  for (const s of fajr.steps) {
    const path = s.dhikr?.audio ?? s.audio;
    if (!ready(path)) continue;
    assert.ok(path.startsWith("/audio/"), `${s.id}: unexpected audio path "${path}"`);
    assert.ok(existsSync(url(`../public${path}`)), `${s.id}: ${path} is missing from public/audio`);
  }
  // the transition takbir has no recording yet, so it stays silent rather than broken
  assert.equal(byId.takbir_to_ruku.dhikr.audio, "TODO");
  assert.equal(byId.takbir_to_sujood.dhikr.audio, "TODO");
});

test("the sources line renders real links only", () => {
  const html = sourceLinks(byId.ruku.sourceRefs, fajr.sources);
  assert.ok(html.includes(en.sources_label));
  assert.ok(html.includes(fajr.sources[1].url));
  assert.equal(sourceLinks([999], fajr.sources), "", "an unknown reference renders nothing");
  assert.equal(sourceLinks([], fajr.sources), "");
});

test("the audio and transliteration credit is in the footer text", () => {
  assert.ok(/ElevenLabs/.test(en.footer_audio), "the generated audio must be credited");
  assert.ok(/non-commercial/i.test(en.footer_audio), "the licence limit must be stated");
  assert.ok(/Quran\.com/.test(en.footer_audio), "the transliteration source must be credited");
});

test("the Al-Fatihah reciter is credited in the footer and in SOURCES.md", () => {
  // the content owner's note names the reciter; this is the approved English wording
  assert.ok(src.notes.some((n) => n.includes("شيخ أبو بكر الشاطري")),
    "the content owner's note naming the reciter must still be in docs/content-source.md");
  assert.ok(en.footer_audio.includes("Sheikh Abu Bakr Al-Shatri (mp3quran.net)"),
    "the reciter credit must be in the footer text");
  const sourcesMd = read("../SOURCES.md");
  assert.ok(sourcesMd.includes("Sheikh Abu Bakr Al-Shatri (mp3quran.net)"),
    "the reciter credit must be in SOURCES.md");
});

// ---------- the preparation screen's content has its own source document too ----------

test("the preparation items are copied from docs/preparation-source.md, character for character", () => {
  const items = parsePreparationSource(read("../docs/preparation-source.md"));
  assert.equal(items.length, 6);
  assert.equal(fajr.preparation.length, 6);
  fajr.preparation.forEach((it, i) => {
    const exp = items[i];
    assert.equal(it.id, exp.id, `preparation[${i}]: id does not match the source doc`);
    assert.equal(it.title.ar, exp.titleAr, `${it.id}: Arabic title was altered`);
    assert.equal(it.title.en, exp.titleEn, `${it.id}: English title was altered`);
    assert.equal(it.text, exp.text, `${it.id}: text was altered`);
    assert.equal(it.detail ?? "", exp.detail, `${it.id}: detail was altered`);
    assert.equal(it.source, exp.source, `${it.id}: source was altered`);
    assert.equal(it.url, exp.url, `${it.id}: url was altered`);
    assert.equal(it.source2 ?? "", exp.source2, `${it.id}: second source was altered`);
    assert.equal(it.url2 ?? "", exp.url2, `${it.id}: second url was altered`);
    assert.equal(it.link ?? "", exp.link, `${it.id}: link was altered`);
    assert.equal(it.reviewed, exp.reviewed, `${it.id}: reviewed flag does not match the source doc`);
  });
});

test("the preparation items are all reviewed by the content owner, with her two conditions met", () => {
  for (const it of fajr.preparation) {
    assert.equal(it.reviewed, true, `${it.id}: the content owner approved all six`);
  }
  const cover = fajr.preparation.find((i) => i.id === "cover");
  assert.equal(cover.detail,
    "Male (10+): cover from navel to knees. Female: cover the entire body except face and hands.");
  assert.equal(cover.source2, "IslamQA (English) — Conditions of the Validity of Prayer");
  assert.equal(cover.url2, "https://islamqa.info/en/answers/107701");

  const wudu = fajr.preparation.find((i) => i.id === "wudu");
  assert.equal(wudu.link, "https://youtu.be/2xS70Zn-jRk");
  assert.ok(!wudu.link.includes("?si="), "the tracking parameter must be dropped");

  // no other item picked up these optional fields by accident
  for (const it of fajr.preparation) {
    if (it.id === "cover") continue;
    assert.equal(it.detail, undefined, `${it.id}: must not carry a detail line`);
    assert.equal(it.source2, undefined, `${it.id}: must not carry a second source`);
  }
  for (const it of fajr.preparation) {
    if (it.id === "wudu") continue;
    assert.equal(it.link, undefined, `${it.id}: must not carry a link`);
  }
});

test("SOURCES.md documents the preparation screen's review status and the wudu video", () => {
  const md = read("../SOURCES.md");
  assert.ok(md.includes("Reviewed by the content owner; specialist (Sharia) review pending."),
    "the review status line must appear, computed from the actual reviewed flags");
  for (const it of fajr.preparation) assert.ok(md.includes(`\`${it.id}\``), `SOURCES.md does not list ${it.id}`);
  assert.ok(md.includes("external video (YouTube)"));
  assert.ok(md.includes("https://youtu.be/2xS70Zn-jRk"));
  assert.ok(/\|\s*TODO\s*\|\s*TODO\s*\|/.test(md), "channel/author and reviewed-by must both still be TODO");
});

test("SOURCES.md lists every step and every numbered reference", () => {
  const md = read("../SOURCES.md");
  for (const s of fajr.steps) assert.ok(md.includes(`\`${s.id}\``), `SOURCES.md does not list ${s.id}`);
  for (const [n, entry] of Object.entries(src.sources)) {
    assert.ok(md.includes(`[${n}]`), `SOURCES.md does not list reference [${n}]`);
    if (entry.url) assert.ok(md.includes(entry.url), `SOURCES.md does not link reference [${n}]`);
  }
  for (const note of src.notes) {
    assert.ok(md.includes(note), "a note from the content owner is missing from SOURCES.md");
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
