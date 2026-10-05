// Run: node tests/preparation.test.mjs   (or npm test)
//
// The "Before you pray" screen. The content is a DRAFT the content owner is reviewing,
// so these tests pin the supplied wording character-for-character: an accidental edit
// fails here rather than reaching a user.
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

// ---------- the content is exactly what was supplied, and still unreviewed ----------
const EXPECTED = [
  ["time", "دخول الوقت", "Prayer time", "The time for Fajr has started.",
    "الدرر السنية، الموسوعة الفقهية: اشتراط دخول الوقت", "https://dorar.net/feqhia/831"],
  ["wudu", "الوضوء", "Wudu", "You have made wudu (ablution).",
    "الدرر السنية، الموسوعة الفقهية: الطهارة من الحدث", "https://dorar.net/feqhia/1113"],
  ["purity", "الطهارة", "Purity", "Your body, clothes and place are clean.",
    "الدرر السنية، الموسوعة الفقهية: الطهارة من النجس", "https://dorar.net/feqhia/826"],
  ["cover", "ستر العورة", "Covering", "Your body is covered as required.",
    "الدرر السنية، الموسوعة الفقهية: حد العورة في الصلاة", "https://dorar.net/feqhia/874"],
  ["qibla", "استقبال القبلة", "Facing the Qibla", "You are facing the direction of the Ka'bah.",
    "الدرر السنية، الموسوعة الفقهية: استقبال القبلة", "https://dorar.net/feqhia/857"],
  ["intent", "النية", "Intention", "You intend in your heart to pray Fajr.",
    "الدرر السنية، الموسوعة الفقهية: النية", "https://dorar.net/feqhia/881"],
];

test("the six items match the supplied text exactly", () => {
  assert.equal(ITEMS.length, 6, "six things to get ready");
  EXPECTED.forEach(([id, ar, enTitle, text, source, url], i) => {
    const it = ITEMS[i];
    assert.equal(it.id, id, `item ${i}: id`);
    assert.equal(it.title.ar, ar, `${id}: Arabic title must not be edited`);
    assert.equal(it.title.en, enTitle, `${id}: English title`);
    assert.equal(it.text, text, `${id}: text must not be reworded`);
    assert.equal(it.source, source, `${id}: source must not be edited`);
    assert.equal(it.url, url, `${id}: url`);
  });
});

test("every item is still marked unreviewed", () => {
  for (const it of ITEMS) {
    assert.equal(it.reviewed, false, `${it.id}: reviewed must stay false until the content owner approves`);
  }
});

test("the prayer steps were not disturbed by adding the preparation content", () => {
  assert.equal(fajr.steps.length, 12);
  assert.equal(fajr.order.length, 24);
});

// ---------- the switch ----------
test("the screen is enabled, with draft content", () => {
  assert.equal(PREPARATION_SCREEN_ENABLED, true);
  const config = read("../src/config.js");
  assert.ok(/PREPARATION_SCREEN_ENABLED = (true|false);/.test(config), "it must stay a plain boolean");
  assert.ok(config.includes("مسودّة"), "the Arabic comment must still say the content is a draft");
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

test("sources render as links that open in a new tab", () => {
  const out = html();
  for (const it of ITEMS) {
    assert.ok(out.includes(`href="${it.url}"`), `${it.id}: source link missing`);
    assert.ok(out.includes(esc(it.source)), `${it.id}: source text missing`);
  }
  assert.equal((out.match(/target="_blank"/g) || []).length, 6);
  assert.equal((out.match(/rel="noopener noreferrer"/g) || []).length, 6);
  assert.ok(out.includes('id="prep-sources" hidden'), "the list starts collapsed");
  assert.ok(out.includes('aria-expanded="false"'), "the toggle reports its state");
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
