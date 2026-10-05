// Run: node tests/preparation.test.mjs   (or npm test)
//
// The "Before you pray" screen. The content owner has approved all six items, so these
// tests pin the supplied wording character-for-character: an accidental edit fails here
// rather than reaching a user.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREPARATION_SCREEN_ENABLED } from "../src/config.js";
import { preparationHtml, renderPreparation, allChecked } from "../src/ui/preparation.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const fajr = JSON.parse(read("../src/content/fajr.json"));
const en = JSON.parse(read("../src/i18n/en.json"));
const ITEMS = fajr.preparation;

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

// ---------- the content is exactly what was supplied, and now approved ----------
const EXPECTED = [
  { id: "time", ar: "دخول الوقت", en: "Prayer time", text: "The time for Fajr has started.",
    source: "الدرر السنية، الموسوعة الفقهية: اشتراط دخول الوقت", url: "https://dorar.net/feqhia/831" },
  { id: "wudu", ar: "الوضوء", en: "Wudu", text: "You have made wudu (ablution).",
    source: "الدرر السنية، الموسوعة الفقهية: الطهارة من الحدث", url: "https://dorar.net/feqhia/1113",
    link: "https://youtu.be/2xS70Zn-jRk" },
  { id: "purity", ar: "الطهارة", en: "Purity", text: "Your body, clothes and place are clean.",
    source: "الدرر السنية، الموسوعة الفقهية: الطهارة من النجس", url: "https://dorar.net/feqhia/826" },
  { id: "cover", ar: "ستر العورة", en: "Covering", text: "Your body is covered as required.",
    detail: "Male (10+): cover from navel to knees. Female: cover the entire body except face and hands.",
    source: "الدرر السنية، الموسوعة الفقهية: حد العورة في الصلاة", url: "https://dorar.net/feqhia/874",
    source2: "IslamQA (English) — Conditions of the Validity of Prayer",
    url2: "https://islamqa.info/en/answers/107701" },
  { id: "qibla", ar: "استقبال القبلة", en: "Facing the Qibla", text: "You are facing the direction of the Ka'bah.",
    source: "الدرر السنية، الموسوعة الفقهية: استقبال القبلة", url: "https://dorar.net/feqhia/857" },
  { id: "intent", ar: "النية", en: "Intention", text: "You intend in your heart to pray Fajr.",
    source: "الدرر السنية، الموسوعة الفقهية: النية", url: "https://dorar.net/feqhia/881" },
];

test("the six items match the supplied text exactly", () => {
  assert.equal(ITEMS.length, 6, "six things to get ready");
  EXPECTED.forEach((exp, i) => {
    const it = ITEMS[i];
    assert.equal(it.id, exp.id, `item ${i}: id`);
    assert.equal(it.title.ar, exp.ar, `${exp.id}: Arabic title must not be edited`);
    assert.equal(it.title.en, exp.en, `${exp.id}: English title`);
    assert.equal(it.text, exp.text, `${exp.id}: text must not be reworded`);
    assert.equal(it.source, exp.source, `${exp.id}: source must not be edited`);
    assert.equal(it.url, exp.url, `${exp.id}: url`);
    assert.equal(it.detail, exp.detail, `${exp.id}: detail line`);
    assert.equal(it.source2, exp.source2, `${exp.id}: second source`);
    assert.equal(it.url2, exp.url2, `${exp.id}: second url`);
    assert.equal(it.link, exp.link, `${exp.id}: link`);
  });
});

test("every item is marked reviewed by the content owner", () => {
  for (const it of ITEMS) {
    assert.equal(it.reviewed, true, `${it.id}: the content owner approved all six`);
  }
});

test("the prayer steps were not disturbed by adding the preparation content", () => {
  assert.equal(fajr.steps.length, 13, "the transition takbir is two definitions now");
  assert.equal(fajr.order.length, 24);
});

// ---------- the switch ----------
test("the screen is enabled, with draft content", () => {
  assert.equal(PREPARATION_SCREEN_ENABLED, true);
  const config = read("../src/config.js");
  assert.ok(/PREPARATION_SCREEN_ENABLED = (true|false);/.test(config), "it must stay a plain boolean");
  assert.ok(config.includes("اعتمدت"), "the Arabic comment must say the content owner approved the content");
  assert.ok(config.includes("reviewed\": true"), "the comment must reflect the actual reviewed flag");
});

// ---------- rendering ----------
const html = (checked = new Set()) => preparationHtml(ITEMS, checked);
// the renderer escapes text, so "Ka'bah" appears as "Ka&#39;bah"
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

test("all six are shown, each as a real toggle button", () => {
  const out = html();
  for (const it of ITEMS) {
    assert.ok(out.includes(it.title.en), `${it.id}: English title missing`);
    assert.ok(out.includes(it.title.ar), `${it.id}: Arabic label missing`);
    assert.ok(out.includes(esc(it.text)), `${it.id}: text missing`);
    assert.ok(out.includes(`data-id="${it.id}"`), `${it.id}: no card`);
  }
  assert.equal((out.match(/aria-pressed="false"/g) || []).length, 6, "six untoggled cards");
  assert.equal((out.match(/<svg class="prep-icon"/g) || []).length, 6, "each card needs its icon");
});

test("the headings and subtitle come from en.json", () => {
  const out = html();
  for (const key of ["prep_label", "prep_title_ar", "prep_title_en", "prep_subtitle", "prep_note", "prep_sources"]) {
    assert.ok(out.includes(esc(en[key])), `${key} should appear on the screen`);
  }
});

test("the qibla card carries a coming-soon label and nothing else does", () => {
  const out = html();
  assert.ok(out.includes(esc(en.prep_qibla_soon)));
  assert.equal((out.match(/prep-soon/g) || []).length, 1, "only the qibla card is marked coming soon");
  // it is a label, not a control
  assert.ok(!/<button[^>]*prep-soon/.test(out), "the coming-soon label must not be clickable");
});

test("the ready button is disabled until all six are ticked", () => {
  assert.ok(html().includes('id="prep-ready" disabled'), "disabled with none ticked");
  const five = new Set(ITEMS.slice(0, 5).map((i) => i.id));
  assert.ok(html(five).includes('id="prep-ready" disabled'), "still disabled at five");
  assert.ok(!allChecked(ITEMS, five));

  const all = new Set(ITEMS.map((i) => i.id));
  assert.ok(allChecked(ITEMS, all));
  assert.ok(!html(all).includes('id="prep-ready" disabled'), "enabled only at six");
  assert.ok(html(all).includes('id="prep-hint" hidden'), "the hint disappears once ready");
  assert.ok(html().includes(esc(en.prep_hint)), "the hint shows while disabled");
});

test("the progress count and segments follow the ticks", () => {
  assert.ok(html().includes("0 of 6 ready"));
  assert.ok(html(new Set(["time", "wudu"])).includes("2 of 6 ready"));
  assert.ok(html(new Set(ITEMS.map((i) => i.id))).includes("6 of 6 ready"));
  assert.equal((html(new Set(["time", "wudu"])).match(/prep-seg on/g) || []).length, 2);
});

test("sources render as links that open in a new tab, including cover's second source", () => {
  const out = html();
  for (const it of ITEMS) {
    assert.ok(out.includes(`href="${it.url}"`), `${it.id}: source link missing`);
    assert.ok(out.includes(esc(it.source)), `${it.id}: source text missing`);
  }
  assert.ok(out.includes(`href="${ITEMS.find((i) => i.id === "cover").url2}"`), "cover's second source is missing");
  assert.ok(out.includes(esc(ITEMS.find((i) => i.id === "cover").source2)));
  // one <li> per item, plus one for cover's extra source — independent of the wudu how-to
  // link, which lives outside #prep-sources entirely and is checked separately
  const list = out.slice(out.indexOf('id="prep-sources"'));
  assert.equal((list.match(/target="_blank"/g) || []).length, 7);
  assert.equal((list.match(/rel="noopener noreferrer"/g) || []).length, 7);
  assert.ok(out.includes('id="prep-sources" hidden'), "the list starts collapsed");
  assert.ok(out.includes('aria-expanded="false"'), "the toggle reports its state");
});

test("the cover card shows its detail line, and no other card does", () => {
  const out = html();
  const cover = ITEMS.find((i) => i.id === "cover");
  assert.equal((out.match(/class="prep-detail"/g) || []).length, 1, "only one detail line on screen");
  assert.ok(out.includes(`<span class="prep-detail">${esc(cover.detail)}</span>`));
});

test("the wudu link renders outside the card, with the exact URL and its own label", () => {
  const out = html();
  const wudu = ITEMS.find((i) => i.id === "wudu");
  assert.equal((out.match(/class="prep-link"/g) || []).length, 1, "exactly one link on the whole screen");
  assert.ok(!wudu.link.includes("?si="), "the source url itself must have no tracking parameter");
  assert.ok(out.includes(`<a class="prep-link" href="${wudu.link}" target="_blank" rel="noopener noreferrer">`),
    "the link must point at the exact url, open in a new tab, and not leak a referrer");
  assert.ok(out.includes(esc(en.prep_link_wudu)), "the label must come from en.json");

  // structural proof it cannot toggle the card: it is not inside that card's own <button>…</button>
  const cardStart = out.indexOf('data-id="wudu"');
  const cardMarkup = out.slice(cardStart, out.indexOf("</button>", cardStart) + "</button>".length);
  assert.ok(!cardMarkup.includes("prep-link"), "the link must not be nested inside the button");
  const afterCard = out.slice(out.indexOf("</button>", cardStart));
  assert.ok(afterCard.slice(0, 200).includes("prep-link"), "the link must follow, as a sibling of the button");
});

// ---------- interaction, with a tiny fake DOM ----------
function fakeRoot() {
  const root = {
    _html: "",
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.nodes = parse(v); },
    nodes: [],
    querySelectorAll(sel) { return this.nodes.filter((n) => n.sel === sel); },
    querySelector(sel) { return this.nodes.find((n) => n.sel === sel || n.id === sel.replace("#", "")) ?? null; },
  };
  function parse(v) {
    const out = [];
    for (const m of v.matchAll(/data-id="([^"]+)"/g)) {
      out.push({ sel: ".prep-card", dataset: { id: m[1] }, onclick: null });
    }
    for (const id of ["prep-ready", "prep-sources-toggle", "prep-sources", "prep-hint", "prep-count"]) {
      if (v.includes(`id="${id}"`)) {
        const attrs = {};
        out.push({
          sel: `#${id}`, id, onclick: null, attrs,
          getAttribute: (k) => (k === "aria-expanded" ? (v.includes('aria-expanded="true"') ? "true" : "false") : attrs[k]),
          setAttribute: (k, val) => { attrs[k] = val; },
          removeAttribute: (k) => { delete attrs[k]; },
        });
      }
    }
    return out;
  }
  return root;
}

test("tapping cards toggles them and finally enables the button", () => {
  const root = fakeRoot();
  let ready = 0;
  renderPreparation(root, ITEMS, { onReady: () => ready++ });

  // the button does nothing while incomplete
  root.querySelector("#prep-ready").onclick();
  assert.equal(ready, 0, "it must not start the prayer before all six are ticked");

  for (const it of ITEMS) root.querySelectorAll(".prep-card").find((c) => c.dataset.id === it.id).onclick();
  assert.ok(root.innerHTML.includes("6 of 6 ready"));
  assert.ok(!root.innerHTML.includes('id="prep-ready" disabled'));

  root.querySelector("#prep-ready").onclick();
  assert.equal(ready, 1, "now it starts the prayer");
});

test("ticking is reversible", () => {
  const root = fakeRoot();
  renderPreparation(root, ITEMS, { onReady() {} });
  const tap = (id) => root.querySelectorAll(".prep-card").find((c) => c.dataset.id === id).onclick();
  tap("wudu");
  assert.ok(root.innerHTML.includes("1 of 6 ready"));
  tap("wudu");
  assert.ok(root.innerHTML.includes("0 of 6 ready"), "tapping again should untick it");
  assert.ok(root.innerHTML.includes('id="prep-ready" disabled'));
});

// ---------- nothing is recorded or sent ----------
test("the screen records nothing and sends nothing", () => {
  const src = read("../src/ui/preparation.js");
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["../i18n/index.js"], `unexpected imports: ${imports.join(", ")}`);
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/recordAttempt|localStorage|fetch\(|XMLHttpRequest/.test(code),
    "ticks are reminders, not attempts: nothing may be stored or sent");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
