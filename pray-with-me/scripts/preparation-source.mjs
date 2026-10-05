// Parses docs/preparation-source.md (the "Before you pray" screen's content) the same way
// content-source.mjs parses the prayer steps: a block parser keyed by "### item: <id>",
// so scripts/build-content.mjs never has these six items typed into it by hand.
//
// This file contains NO religious text of its own — only the field labels used to find it.

const clean = (s) => s.replace(/ /g, " ").trim();

export function parsePreparationSource(md) {
  const lines = md.split(/\r?\n/);
  const items = [];
  let current = null;
  for (const line of lines) {
    const head = /^###\s+item:\s*(\S+)/.exec(line);
    if (head) {
      current = { id: head[1], raw: {} };
      items.push(current);
      continue;
    }
    if (!current) continue;
    const field = /^-\s*([^:]+):\s*(.*)$/.exec(line);
    if (field) current.raw[clean(field[1])] = clean(field[2]);
    if (/^##\s/.test(line)) current = null;
  }

  return items.map((it) => ({
    id: it.id,
    titleAr: it.raw["Arabic title"] ?? "",
    titleEn: it.raw["English title"] ?? "",
    text: it.raw["Text (English)"] ?? "",
    // optional: a small muted detail line (only "cover" has one so far)
    detail: it.raw["Detail (English)"] ?? "",
    source: it.raw["Source"] ?? "",
    url: it.raw["URL"] ?? "",
    // optional: a second citation (only "cover" has one so far)
    source2: it.raw["Source 2"] ?? "",
    url2: it.raw["URL 2"] ?? "",
    // optional: a link to external media (only "wudu" has one so far)
    link: it.raw["Link URL"] ?? "",
    reviewed: it.raw["Reviewed"] === "yes",
  }));
}
