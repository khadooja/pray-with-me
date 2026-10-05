// Run: node tests/results.test.mjs   (or npm test)
//
// src/progress/results.js has no DOM and no localStorage, so every test here uses
// made-up journeys and attempts — it never touches src/content/fajr.json.
import assert from "node:assert/strict";
import { summarizeAttempts, compareRakahs, attemptsToCSV, attemptsToJSON, CHECKED_STEPS }
  from "../src/progress/results.js";

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

// ---------- summarizeAttempts ----------

test("a key with mixed attempts reports attempts/first/last/rate correctly", () => {
  const steps = [{ id: "ruku" }];
  const keys = ["ruku#1"];
  const attempts = { "ruku#1": [{ ok: false, at: "t1" }, { ok: false, at: "t2" }, { ok: true, at: "t3" }] };
  const [row] = summarizeAttempts(attempts, steps, keys);
  assert.equal(row.key, "ruku#1");
  assert.equal(row.stepId, "ruku");
  assert.equal(row.attempts, 3);
  assert.equal(row.firstOk, false);
  assert.equal(row.lastOk, true);
  assert.equal(row.successRate, 1 / 3);
});

test("a key with zero attempts reports nulls, not 0/false", () => {
  const steps = [{ id: "sujood" }];
  const keys = ["sujood#1"];
  const [row] = summarizeAttempts({}, steps, keys);
  assert.equal(row.attempts, 0);
  assert.equal(row.firstOk, null);
  assert.equal(row.lastOk, null);
  assert.equal(row.successRate, null);
});

test("rows stay in journey order, one per attempt key", () => {
  const steps = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const keys = ["a#1", "b#1", "c#1"];
  const rows = summarizeAttempts({ "c#1": [{ ok: true, at: "t" }] }, steps, keys);
  assert.deepEqual(rows.map((r) => r.key), keys);
  assert.equal(rows[2].attempts, 1);
});

// ---------- compareRakahs ----------

// a made-up 6-step journey: standing/ruku/sujood in rakah 1, same again in rakah 2,
// plus "fatiha" which is NOT a checked step and must be excluded entirely
const JOURNEY = [
  { id: "standing" }, { id: "fatiha" }, { id: "ruku" }, { id: "sujood" },
  { id: "standing" }, { id: "ruku" }, { id: "sujood" },
];
const KEYS = ["standing#1", "fatiha#1", "ruku#1", "sujood#1", "standing#2", "ruku#2", "sujood#2"];
const RAKAHS = [1, 1, 1, 1, 2, 2, 2];

test("checked steps are aggregated per rakah, correctly", () => {
  const attempts = {
    "standing#1": [{ ok: true, at: "t" }],
    "ruku#1": [{ ok: false, at: "t" }, { ok: true, at: "t" }],
    "sujood#1": [{ ok: true, at: "t" }],
    "standing#2": [{ ok: false, at: "t" }],
    "ruku#2": [{ ok: true, at: "t" }],
    // sujood#2: no attempts at all
    "fatiha#1": [{ ok: false, at: "t" }], // must be ignored: fatiha is not a checked step
  };
  const cmp = compareRakahs(attempts, JOURNEY, KEYS, RAKAHS);

  assert.deepEqual(Object.keys(cmp).sort(), [...CHECKED_STEPS].sort());
  assert.ok(!("fatiha" in cmp), "fatiha must not appear in the comparison at all");

  assert.equal(cmp.standing["1"].attempts, 1);
  assert.equal(cmp.standing["1"].successRate, 1);
  assert.equal(cmp.standing["2"].attempts, 1);
  assert.equal(cmp.standing["2"].successRate, 0);

  assert.equal(cmp.ruku["1"].attempts, 2);
  assert.equal(cmp.ruku["1"].successRate, 0.5);
  assert.equal(cmp.ruku["2"].attempts, 1);
  assert.equal(cmp.ruku["2"].successRate, 1);

  assert.equal(cmp.sujood["1"].attempts, 1);
  assert.equal(cmp.sujood["1"].successRate, 1);
  assert.equal(cmp.sujood["2"].attempts, 0);
  assert.equal(cmp.sujood["2"].successRate, null, "zero attempts must report a null rate, not 0");
});

test("a step occurring twice in one rakah (e.g. two sujoods) is combined, not overwritten", () => {
  const journey = [{ id: "sujood" }, { id: "sujood" }];
  const keys = ["sujood#1", "sujood#2"];
  const rakahs = [1, 1];
  const attempts = {
    "sujood#1": [{ ok: true, at: "t" }],
    "sujood#2": [{ ok: false, at: "t" }, { ok: false, at: "t" }],
  };
  const cmp = compareRakahs(attempts, journey, keys, rakahs);
  assert.equal(cmp.sujood["1"].attempts, 3, "both occurrences must be summed");
  assert.equal(cmp.sujood["1"].successRate, 1 / 3);
});

// ---------- attemptsToCSV ----------

test("CSV has the exact header and one row per individual attempt", () => {
  const attempts = { "ruku#1": [{ ok: true, at: "2024-01-01T00:00:00.000Z" }, { ok: false, at: "2024-01-01T00:00:05.000Z" }] };
  const csv = attemptsToCSV("T1", attempts, ["ruku#1"]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "tester_id,attempt_key,attempt_number,ok,timestamp");
  assert.equal(lines[1], "T1,ruku#1,1,1,2024-01-01T00:00:00.000Z");
  assert.equal(lines[2], "T1,ruku#1,2,0,2024-01-01T00:00:05.000Z");
  assert.equal(lines.length, 3);
});

test("CSV quotes a tester id that contains a comma", () => {
  const csv = attemptsToCSV("T1,extra", { "ruku#1": [{ ok: true, at: "t" }] }, ["ruku#1"]);
  assert.ok(csv.includes('"T1,extra",ruku#1,1,1,t'), csv);
});

test("CSV skips keys with no attempts, and keeps journey order for keys that have some", () => {
  const attempts = { "b#1": [{ ok: true, at: "t" }] };
  const csv = attemptsToCSV("T1", attempts, ["a#1", "b#1", "c#1"]);
  assert.equal(csv.split("\r\n").length, 2, "only the header plus the one real attempt");
});

// ---------- attemptsToJSON ----------

test("JSON export round-trips the tester id and the attempts, byte-identical", () => {
  const attempts = { "ruku#1": [{ ok: true, at: "2024-01-01T00:00:00.000Z" }] };
  const parsed = JSON.parse(attemptsToJSON("T2", attempts));
  assert.equal(parsed.testerId, "T2");
  assert.deepEqual(parsed.attempts, attempts);
  assert.ok(typeof parsed.exportedAt === "string" && !Number.isNaN(Date.parse(parsed.exportedAt)));
});

// ---------- getTesterId / setTesterId round-trip (store.js) ----------

test("the tester id persists through a localStorage round-trip", async () => {
  const data = {};
  globalThis.localStorage = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
  const { getTesterId, setTesterId } = await import("../src/progress/store.js");
  assert.equal(getTesterId(), "", "nothing saved yet");
  setTesterId("T3");
  assert.equal(getTesterId(), "T3");
  setTesterId("");
  assert.equal(getTesterId(), "", "clearing it must remove the key, not store an empty string");
  delete globalThis.localStorage;
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
