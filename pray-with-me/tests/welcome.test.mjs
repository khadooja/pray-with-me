// Run: node tests/welcome.test.mjs   (or npm test)
//
// The welcome screen: shown once at launch, says what the app does, records nothing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { welcomeHtml, renderWelcome } from "../src/ui/welcome.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const en = JSON.parse(read("../src/i18n/en.json"));

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

test("the screen shows the Arabic name, the app title, the tagline and a start button", () => {
  const html = welcomeHtml();
  for (const key of ["welcome_title_ar", "app_title", "welcome_tagline", "welcome_start"]) {
    assert.ok(html.includes(en[key]), `missing ${key}`);
  }
  assert.ok(html.includes('id="welcome-start"'));
});

test("all three reassurance points come from en.json", () => {
  const html = welcomeHtml();
  for (const key of ["welcome_point_camera", "welcome_point_private", "welcome_point_free"]) {
    assert.ok(en[key], `en.json has no ${key}`);
    assert.ok(html.includes(en[key]), `missing ${key}`);
  }
});

test("pressing Start calls onStart", () => {
  let started = 0;
  const button = { onclick: null };
  const root = { innerHTML: "", querySelector: (sel) => (sel === "#welcome-start" ? button : null) };
  renderWelcome(root, { onStart: () => started++ });
  button.onclick();
  assert.equal(started, 1);
});

test("the screen records nothing and sends nothing", () => {
  const src = read("../src/ui/welcome.js");
  const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["../i18n/index.js"], `unexpected imports: ${imports.join(", ")}`);
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/recordAttempt|localStorage|fetch\(|XMLHttpRequest/.test(code));
});

test("the stage labels exist in en.json", () => {
  assert.ok(en.stage_ok && en.stage_adjust);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
