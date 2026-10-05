// Local-only progress: attempts per step, stored in this browser's localStorage.
// Every access is wrapped in try/catch: storage may be blocked (private mode, etc.).
const KEY = "pwm-progress-v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignore: progress is a convenience, the app must work without it.
  }
}

// Appends { ok, at } to the step's attempt list.
export function recordAttempt(stepId, ok) {
  const data = load();
  (data[stepId] ||= []).push({ ok: Boolean(ok), at: new Date().toISOString() });
  save(data);
}

// Returns { [stepId]: [{ ok, at }, ...] }.
export function getAttempts() {
  return load();
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// هوية المختبر (مثل "T1")، لصفحة النتائج فقط. ما فيها أي بيانات شخصية أو اسم.
const TESTER_KEY = "pwm-tester-id";

export function getTesterId() {
  try {
    return localStorage.getItem(TESTER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setTesterId(id) {
  try {
    if (id) localStorage.setItem(TESTER_KEY, id);
    else localStorage.removeItem(TESTER_KEY);
  } catch {
    // ignore
  }
}
