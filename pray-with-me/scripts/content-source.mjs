// Parses docs/content-source.md (the content owner's final table) into structured data.
//
// Why a parser instead of typing the content in by hand: every Arabic word, transliteration,
// meaning and source string is copied mechanically from her file, so it cannot be mistyped,
// "corrected" or paraphrased. scripts/build-content.mjs writes fajr.json from this, and
// tests/content.test.mjs re-parses the same file and asserts fajr.json still matches.
//
// This file contains NO religious text of its own — only the field labels used to find it.

export const LEVELS = { "ركن": "rukn", "واجب": "wajib", "سنة": "sunnah" };
const ONCE_MARKERS = ["-مرة واحدة فقط-", "-once-"];

const clean = (s) => s.replace(/ /g, " ").trim();

// A value line is "- Label: part | part | (level)". Returns the parts, the level and
// whether the content owner marked it as said once.
function splitValue(raw) {
  const parts = clean(raw).split("|").map(clean).filter(Boolean);
  let level = null;
  let once = false;
  const text = [];
  for (const p of parts) {
    const lvl = /^\((.+)\)$/.exec(p);
    if (lvl && LEVELS[clean(lvl[1])]) { level = LEVELS[clean(lvl[1])]; continue; }
    if (ONCE_MARKERS.includes(p)) { once = true; continue; }
    text.push(p);
  }
  return { parts: text, level, once };
}

const refsIn = (s) => [...String(s).matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));

export function parseContentSource(md) {
  const lines = md.split(/\r?\n/);

  // ---------- section 1: steps ----------
  const steps = [];
  let current = null;
  for (const line of lines) {
    const head = /^###\s+step:\s*(\S+)/.exec(line);
    if (head) {
      current = { id: head[1], raw: {} };
      steps.push(current);
      continue;
    }
    if (!current) continue;
    const field = /^-\s*([^:]+):\s*(.*)$/.exec(line);
    if (field) current.raw[clean(field[1])] = clean(field[2]);
    if (/^##\s/.test(line)) current = null;
  }

  const parsed = steps.map((s) => {
    const name = splitValue(s.raw["Arabic name and level"] ?? "");
    const en = splitValue(s.raw["English name"] ?? "");
    const ins = splitValue(s.raw["Instructions (English) and level"] ?? "");
    const dhikr = splitValue(s.raw["Dhikr (Arabic) and level"] ?? "");
    const translit = splitValue(s.raw["Transliteration"] ?? "");
    const meaning = clean(s.raw["Meaning (English)"] ?? "");
    const audio = clean(s.raw["Audio"] ?? "");
    const sources = clean(s.raw["Sources"] ?? "");
    const file = /save as (public\/audio\/[\w.]+)<?/.exec(audio);
    return {
      id: s.id,
      nameAr: name.parts.join(" "),
      level: name.level,
      nameEnParts: en.parts,
      instruction: ins.parts.join(" "),
      instructionLevel: ins.level,
      dhikrAr: dhikr.parts.join(" "),
      dhikrLevel: dhikr.level,
      once: dhikr.once || translit.once,
      transliteration: translit.parts.join(" "),
      meaning,
      audioHint: file ? file[1].replace("public/", "/") : null,
      sources,
      sourceRefs: [...new Set(refsIn(sources))].sort((a, b) => a - b),
    };
  });

  // ---------- section 2: Al-Fatihah verses ----------
  const verses = [];
  let inTable = false;
  for (const line of lines) {
    if (/^##\s*2\./.test(line)) { inTable = true; continue; }
    if (inTable && /^##\s/.test(line)) break;
    if (!inTable || !line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map(clean);
    if (cells.length < 3 || /^-+$/.test(cells[0]) || cells[0] === "Verse (Arabic)") continue;
    // the owner marks the two Sunnah rows inline, e.g. "بسم الله ... (سنة)[18]"
    const lvl = /\((سنة|ركن|واجب)\)/.exec(cells[0]);
    const arabic = clean(cells[0].replace(/\((سنة|ركن|واجب)\)/, "").replace(/\[\d+\]/g, ""));
    const meaning = clean(cells[2].replace(/^\[\d+\]\s*/, ""));
    verses.push({
      arabic,
      transliteration: cells[1],
      meaning,
      level: lvl ? LEVELS[lvl[1]] : null,
      refs: [...new Set([...refsIn(cells[0]), ...refsIn(cells[2])])].sort((a, b) => a - b),
    });
  }

  // ---------- section 3: transition takbirs ----------
  const transitions = [];
  inTable = false;
  for (const line of lines) {
    if (/^##\s*3\./.test(line)) { inTable = true; continue; }
    if (inTable && /^##\s/.test(line)) break;
    if (!inTable || !line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map(clean);
    if (cells.length < 4 || /^-+$/.test(cells[0]) || cells[0] === "Transition") continue;
    // the 5th column is optional: only the direction-specific takbir has its own instruction
    transitions.push({
      from: cells[0], dhikr: cells[1], raiseHands: cells[2] === "نعم", ruling: cells[3],
      instruction: cells[4] ?? "",
    });
  }
  const sectionRefs = (n) => {
    const head = lines.find((l) => new RegExp(`^##\\s*${n}\\.`).test(l)) ?? "";
    return [...new Set(refsIn(head))].sort((a, b) => a - b);
  };

  // ---------- section 5: sources ----------
  const sources = {};
  let inSources = false;
  for (const line of lines) {
    if (/^##\s*5\./.test(line)) { inSources = true; continue; }
    if (inSources && /^##\s/.test(line)) break;
    if (!inSources || !line.trim().startsWith("- ")) continue;
    const n = refsIn(line)[0];
    if (!n) continue;
    const body = clean(line.replace(/^-\s*/, ""));
    const split = body.lastIndexOf(" — ");
    const title = clean((split >= 0 ? body.slice(0, split) : body).replace(`[${n}]`, ""));
    sources[n] = { title: clean(title.replace(/\s{2,}/g, " ")), url: split >= 0 ? clean(body.slice(split + 3)) : "" };
  }

  // ---------- section 4: the content owner's notes ----------
  const notes = [];
  let inNotes = false;
  for (const line of lines) {
    if (/^##\s*4\./.test(line)) { inNotes = true; continue; }
    if (inNotes && /^##\s/.test(line)) break;
    if (inNotes && line.trim().startsWith("- ")) notes.push(clean(line.replace(/^-\s*/, "")));
  }

  return {
    steps: parsed,
    byId: Object.fromEntries(parsed.map((s) => [s.id, s])),
    verses,
    fatihaRefs: sectionRefs(2),
    transitions,
    transitionRefs: sectionRefs(3),
    sources,
    notes,
  };
}
