// رسم الشكل التوضيحي للصلاة وتحريكه بين الوضعيات.
// الرسم كله SVG مكتوب بالكود: ما فيه أي ملف صورة ولا خطوط خارجية.
// الألوان من متغيرات CSS في style.css (--figure و --figure-far و --mat و --highlight).
import { t, has } from "../i18n/index.js";
import { VIDEO_SPEEDS } from "../config.js";
import { HEAD_R, VIEW, FRAME, jointsFor, lerpAngles } from "./kinematics.js";
import { POSES, ALL_POSES, POSE_FOR_STEP, pathBetween, durationFor,
  SUJOOD_FRONT, frontPoints, CROSSFADE_MS,
  TASLIM_BACK, TASLIM_MS, taslimTurnAt } from "./poses.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---- سماكة الأعضاء (بكسل) ----
// الفخذ أسمك من الساق، والعضد أسمك من الساعد.
const W = {
  thigh: 24,
  shin: 17,
  upperArm: 16,
  forearm: 13,
  hand: 12,
  foot: 11,
  neck: 15,
  // الجسم: كبسولتان ناعمتان تتبعان خط الكتف→الورك (بدون أي زوايا حادة).
  // العرض قريب من قطر الرأس: لو زدناه يصير الجسم "كتلة" تبلع الذراعين ويختفي خط الظهر.
  torso: 28,
  skirt: 32, // طرف الثوب الفضفاض على أعلى الفخذين
};

// سماكة الحدّ بلون اللوحة حول الأعضاء القريبة، عشان تنفصل بصرياً عن الجسم
// (بدونها الذراع تختفي داخل الجسم لأن لونهما واحد).
const OUTLINE = 6;

// إزاحة الجهة البعيدة: تُرسم خلف الجسم وبانحراف بسيط عشان تبيّن الجهتين.
const FAR_DX = -8;
const FAR_DY = -3;

const n2 = (v) => Math.round(v * 100) / 100;
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// عضو سميك بأطراف دائرية (كبسولة) من a إلى b
function cap(a, b, width, cls) {
  return `<line class="${cls}" x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}" stroke-width="${width}" stroke-linecap="round" />`;
}
const shift = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });

// عضو قريب مع حدّ بلون اللوحة حوله: نرسم كبسولة أعرض بلون اللوحة ثم العضو فوقها.
function limb(a, b, width) {
  return cap(a, b, width + OUTLINE, "fig-outline") + cap(a, b, width, "fig-limb");
}

// الثوب: كبسولتان ناعمتان فقط.
// (قبل كذا كان مضلّعاً فيه زوايا حادة تطلع "أشواك" عند الورك وتخفي خط الظهر.)
function garment(j) {
  const kneeMid = { x: (j.kneeNear.x + j.kneeFar.x) / 2, y: (j.kneeNear.y + j.kneeFar.y) / 2 };
  const hem = { x: lerp(j.hip.x, kneeMid.x, 0.38), y: lerp(j.hip.y, kneeMid.y, 0.38) };
  return cap(j.hip, hem, W.skirt, "fig-torso") + cap(j.hip, j.shoulder, W.torso, "fig-torso");
}

// سجادة الصلاة: شريط مسطّح + حدود خفيفة + قوس في المقدمة (جهة القبلة).
// ترتسم دايماً داخل الإطار الثابت.
function mat() {
  const y = VIEW.floorY;
  const x0 = FRAME.x - 10;
  const x1 = FRAME.x + FRAME.w + 10;
  const front = FRAME.x + FRAME.w - 22;
  return `
    <g class="fig-mat">
      <rect class="fig-mat-fill" x="${x0}" y="${y}" width="${x1 - x0}" height="20" />
      <line class="fig-mat-line" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" />
      <line class="fig-mat-line" x1="${x0}" y1="${y + 20}" x2="${x1}" y2="${y + 20}" />
      <path class="fig-mat-line" fill="none" d="M ${front - 14} ${y - 2} L ${front - 14} ${y - 13} A 14 14 0 0 1 ${front + 14} ${y - 13} L ${front + 14} ${y - 2}" />
    </g>`;
}

// نقطة توضيح واحدة
function dot(p, cls = "fig-dot") {
  return `<circle class="${cls}" cx="${n2(p.x)}" cy="${n2(p.y)}" r="6.5" />`;
}

// التوضيحات. الأعضاء المزدوجة (كفّين/ركبتين/أصابع) تُرسم نقطتين مفصولتين + شارة ×2،
// عشان الأعضاء السبعة تُعدّ بالعين ولا تندمج في المنظر الجانبي.
function highlights(pose, j) {
  const parts = (pose.highlights ?? []).map((h) => {
    if (h.type === "dot") return dot(j[h.at]);
    if (h.type === "pair") {
      const near = j[h.near];
      const far = shift(j[h.far], FAR_DX - 5, FAR_DY - 4); // نفرّقهم أكثر عشان يبيّنون نقطتين
      let out = dot(far, "fig-dot fig-dot-far") + dot(near);
      if (h.badge) {
        out += `<text class="fig-badge" x="${n2(near.x + 13)}" y="${n2(Math.min(near.y, far.y) - 12)}">${esc(t("figure_pair_badge"))}</text>`;
      }
      return out;
    }
    // خط على امتداد الظهر + علامة ميزان
    const a = j[h.from], b = j[h.to];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ext = 18;
    const a2 = { x: a.x - (dx / len) * ext, y: a.y - (dy / len) * ext };
    const b2 = { x: b.x + (dx / len) * ext, y: b.y + (dy / len) * ext };
    let out = `<line class="fig-guide" x1="${n2(a2.x)}" y1="${n2(a2.y)}" x2="${n2(b2.x)}" y2="${n2(b2.y)}" />`;
    if (h.level) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const nx = -dy / len, ny = dx / len;
      const c = shift(mid, -nx * 30, -ny * 30);
      out += `<g class="fig-level" transform="translate(${n2(c.x)} ${n2(c.y)}) rotate(${n2(ang)})">
        <rect x="-16" y="-7.5" width="32" height="15" rx="7.5" />
        <circle cx="0" cy="0" r="3.5" />
      </g>`;
    }
    return out;
  });
  return `<g class="fig-highlights">${parts.join("")}</g>`;
}

// رسم وضعية كاملة. الإطار ثابت لكل الوضعيات (ما يتغيّر حجم الشكل بين الخطوات).
function drawPose(poseName, angles, armScale) {
  const pose = ALL_POSES[poseName] ?? POSES[poseName];
  const j = jointsFor(angles, armScale ?? pose?.armScale ?? 1);
  const f = (p) => shift(p, FAR_DX, FAR_DY);

  // الجهة البعيدة أول (خلف الجسم)
  const far = [
    cap(f(j.hip), f(j.kneeFar), W.thigh, "fig-far"),
    cap(f(j.kneeFar), f(j.ankleFar), W.shin, "fig-far"),
    cap(f(j.ankleFar), f(j.toeFar), W.foot, "fig-far"),
    cap(f(j.shoulder), f(j.elbowFar), W.upperArm, "fig-far"),
    cap(f(j.elbowFar), f(j.wristFar), W.forearm, "fig-far"),
    cap(f(j.wristFar), f(j.palmFar), W.hand, "fig-far"),
  ].join("");

  const nearLegs = [
    limb(j.hip, j.kneeNear, W.thigh),
    limb(j.kneeNear, j.ankleNear, W.shin),
    limb(j.ankleNear, j.toeNear, W.foot),
  ].join("");

  // الذراع القريبة فوق الجسم وبحدّ واضح، عشان الساعد والمرفق يبيّنون كشكل مستقل
  const nearArm = [
    limb(j.shoulder, j.elbowNear, W.upperArm),
    limb(j.elbowNear, j.wristNear, W.forearm),
    limb(j.wristNear, j.palmNear, W.hand),
  ].join("");

  // الرقبة ثم الرأس في الآخر، والرأس له حدّ بلون اللوحة عشان يبيّن منفصلاً
  // عن الذراع أو الجسم اللي خلفه (كانوا يندمجون في السجود).
  const headGroup =
    cap(j.shoulder, j.head, W.neck, "fig-limb") +
    `<circle class="fig-head" cx="${n2(j.head.x)}" cy="${n2(j.head.y)}" r="${HEAD_R}" />`;

  return {
    viewBox: `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`,
    svg: `${mat()}<g class="fig-far-group">${far}</g>${nearLegs}${garment(j)}${nearArm}${headGroup}${highlights(pose, j)}`,
  };
}

// ---------------------------------------------------------------------------
// السجود — منظر أمامي
// ---------------------------------------------------------------------------
// الرسم متماثل حول المحور، والأعضاء البعيدة (الأرجل) بلون أبهت عشان تبيّن البُعد.
// النقاط السبعة مرقّمة ١-٧ بدل شارات ×2، لأن كل عضو يظهر منفصلاً في هذا المنظر.
function drawSujoodFront() {
  const d = SUJOOD_FRONT;
  const p = frontPoints(d);
  const m = d.mat;
  const P = (q) => `${n2(q.x)} ${n2(q.y)}`;

  // السجادة: شبه منحرف (قريبة = أعرض) + قوس في المقدمة قدّام الرأس
  const mat = `
    <g class="fig-mat">
      <path class="fig-mat-fill" d="M ${d.cx - m.farHalf} ${m.farY} L ${d.cx + m.farHalf} ${m.farY}
        L ${d.cx + m.nearHalf} ${m.nearY} L ${d.cx - m.nearHalf} ${m.nearY} Z" />
      <path class="fig-mat-line" fill="none" d="M ${d.cx - m.farHalf} ${m.farY} L ${d.cx - m.nearHalf} ${m.nearY}" />
      <path class="fig-mat-line" fill="none" d="M ${d.cx + m.farHalf} ${m.farY} L ${d.cx + m.nearHalf} ${m.nearY}" />
      <path class="fig-mat-line" fill="none" d="M ${d.cx - m.archHalf} ${m.archY + 16}
        L ${d.cx - m.archHalf} ${m.archY} A ${m.archHalf} ${m.archHalf} 0 0 1 ${d.cx + m.archHalf} ${m.archY}
        L ${d.cx + m.archHalf} ${m.archY + 16}" />
    </g>`;

  // الأرجل (الأبعد) بلون أبهت
  // الفخذ مجرد وصلة قصيرة (شبه عمودي فيظهر مختصراً)، والظاهر فعلاً هو الساق
  // من الركبة إلى العقب، ثم أصابع القدم المثنية على الأرض.
  const legs = [
    limb(p.hipL, p.kneeL, d.w.thigh),
    limb(p.hipR, p.kneeR, d.w.thigh),
    limb(p.kneeL, p.heelL, d.w.shin),
    limb(p.kneeR, p.heelR, d.w.shin),
    limb(p.heelL, p.toeL, d.w.foot),
    limb(p.heelR, p.toeR, d.w.foot),
  ].join("");

  // الجذع: شكل ناعم مستدق من الكتفين (قريب وأعرض) إلى الوركين (بعيد وأضيق)
  const body = `<path class="fig-body" d="M ${P(p.shoulderL)} L ${P(p.hipL)}
    Q ${d.cx} ${d.hip.y - 12} ${P(p.hipR)} L ${P(p.shoulderR)}
    Q ${d.cx} ${d.shoulder.y + 20} ${P(p.shoulderL)} Z" />
    <line class="fig-spine" x1="${d.cx}" y1="${n2(d.shoulder.y + 10)}" x2="${d.cx}" y2="${n2(d.hip.y + 2)}" />`;

  // الذراعان: من الكتف للخارج إلى المرفق المرفوع، ثم للداخل إلى الكف على الأرض
  const arms = [
    limb(p.shoulderL, p.elbowL, d.w.upperArm),
    limb(p.elbowL, p.palmL, d.w.forearm),
    limb(p.shoulderR, p.elbowR, d.w.upperArm),
    limb(p.elbowR, p.palmR, d.w.forearm),
    // الكفان مبسوطتان على الأرض
    limb(p.palmL, { x: p.palmL.x, y: p.palmL.y + 11 }, d.w.hand),
    limb(p.palmR, { x: p.palmR.x, y: p.palmR.y + 11 }, d.w.hand),
  ].join("");

  const neck = cap({ x: d.cx, y: d.shoulder.y + 6 }, { x: d.cx, y: d.head.y - 10 }, d.w.neck, "fig-limb");
  const head = `<circle class="fig-head" cx="${d.cx}" cy="${d.head.y}" r="${d.head.r}" />`;

  // النقاط السبعة مرقّمة
  const dots = d.contacts
    .map(({ n, at }) => {
      const q = p[at];
      return `<g class="fig-num"><circle cx="${n2(q.x)}" cy="${n2(q.y)}" r="11" />
        <text x="${n2(q.x)}" y="${n2(q.y)}" text-anchor="middle" dominant-baseline="central">${n}</text></g>`;
    })
    .join("");

  return {
    viewBox: `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`,
    svg: `${mat}${legs}${body}${arms}${neck}${head}<g class="fig-highlights">${dots}</g>`,
  };
}

// ---------------------------------------------------------------------------
// التسليم — منظر من الخلف، الرأس يلتفت يميناً ثم يساراً
// ---------------------------------------------------------------------------
// الجسم كله يُرسم بدون أي علاقة بقيمة turn: الكتفان والظهر والذراعان ثابتون تماماً،
// والحركة في الرأس فقط. (الاختبار يتأكد إن شفرة الجسم ما تتغيّر مع الالتفات.)
function taslimBody() {
  const d = TASLIM_BACK;
  const cx = d.cx;
  const P = (x, y) => `${n2(x)} ${n2(y)}`;
  const m = d.mat;

  const mat = `
    <g class="fig-mat">
      <path class="fig-mat-fill" d="M ${cx - m.farHalf} ${m.farY} L ${cx + m.farHalf} ${m.farY}
        L ${cx + m.nearHalf} ${m.nearY} L ${cx - m.nearHalf} ${m.nearY} Z" />
      <path class="fig-mat-line" fill="none" d="M ${cx - m.farHalf} ${m.farY} L ${cx - m.nearHalf} ${m.nearY}" />
      <path class="fig-mat-line" fill="none" d="M ${cx + m.farHalf} ${m.farY} L ${cx + m.nearHalf} ${m.nearY}" />
    </g>`;

  // القدمان تحت الجسم (تبينان من الخلف)
  const feet =
    cap({ x: cx - d.foot.dx, y: d.foot.y }, { x: cx - d.foot.dx + 10, y: d.foot.y }, d.w.foot, "fig-far") +
    cap({ x: cx + d.foot.dx - 10, y: d.foot.y }, { x: cx + d.foot.dx, y: d.foot.y }, d.w.foot, "fig-far");

  // الجذع: من الكتفين (أعرض) إلى الوركين ثم قاعدة الجلوس، بزوايا ناعمة
  const body = `<path class="fig-body" d="M ${P(cx - d.shoulder.dx, d.shoulder.y)}
    Q ${P(cx, d.shoulder.y - 20)} ${P(cx + d.shoulder.dx, d.shoulder.y)}
    L ${P(cx + d.hip.dx, d.hip.y)}
    Q ${P(cx + d.seat.dx, d.seat.y)} ${P(cx + d.seat.dx - 14, d.seat.y)}
    L ${P(cx - d.seat.dx + 14, d.seat.y)}
    Q ${P(cx - d.seat.dx, d.seat.y)} ${P(cx - d.hip.dx, d.hip.y)} Z" />`;

  // الذراعان على الجنبين والكفان على الفخذين
  const arms =
    limb({ x: cx - d.shoulder.dx + 6, y: d.shoulder.y + 6 }, { x: cx - d.hand.dx, y: d.hand.y }, d.w.arm) +
    limb({ x: cx + d.shoulder.dx - 6, y: d.shoulder.y + 6 }, { x: cx + d.hand.dx, y: d.hand.y }, d.w.arm);

  // الرقبة ما هي هنا: صارت مع الرأس لأنها تتبع الالتفات (شوفوا taslimHead)
  return `${mat}${feet}${body}${arms}`;
}

// الرقبة + الرأس: هذا الجزء وحده اللي يتحرك مع الالتفات (الجسم والكتفان ثابتان).
// - الرأس يزيح نحو جهة الالتفات ويضيق (منظور).
// - الرقبة تميل مع الرأس وطرفها العلوي **داخل** الرأس، عشان ما تبين "درجة" عند الرقبة.
// - ظل خفيف على الجهة البعيدة من الرأس (قفا الرأس) عشان الدوران يبيّن كأنه ثلاثي الأبعاد.
//   بدون أي ملامح وجه ولا أذنين.
function taslimHead(turn) {
  const d = TASLIM_BACK;
  const cx = d.cx + turn * d.headShift;
  const rx = d.head.r * (1 - d.headNarrow * Math.abs(turn));
  const ry = d.head.r;

  // الرقبة تتبع الرأس: أعلاها يميل معه، وأسفلها ثابت عند الكتفين
  const neckTop = { x: d.cx + turn * d.headShift * 0.75, y: d.head.y + 8 };
  const neck = cap(neckTop, { x: d.cx, y: d.neck.y + 6 }, d.w.neck, "fig-limb");

  const head = `<ellipse class="fig-head" cx="${n2(cx)}" cy="${d.head.y}" rx="${n2(rx)}" ry="${ry}" />`;

  // الظل: قطعة هلالية على الجهة المعاكسة لاتجاه الالتفات، مقصوصة بحدود الرأس
  const shade =
    Math.abs(turn) < 0.08
      ? ""
      : `<clipPath id="taslim-head-clip"><ellipse cx="${n2(cx)}" cy="${d.head.y}" rx="${n2(rx)}" ry="${ry}" /></clipPath>` +
        `<g clip-path="url(#taslim-head-clip)"><ellipse class="fig-head-shade" cx="${n2(cx - turn * rx * 0.72)}" cy="${d.head.y}" rx="${n2(rx)}" ry="${ry}" opacity="${n2(Math.min(1, Math.abs(turn) * 1.3))}" /></g>`;

  return neck + head + shade;
}

// سهم منحني فوق الرأس يوضّح جهة الالتفات + كلمة من en.json
function taslimArrow(turn, label) {
  const d = TASLIM_BACK;
  if (!label || Math.abs(turn) < 0.02) return "";
  const dir = Math.sign(turn);
  const a = { x: d.cx - dir * 6, y: d.arrow.y };
  const b = { x: d.cx + dir * d.arrow.dx, y: d.arrow.y + 8 };
  const head = `${b.x - dir * 9} ${b.y - 7} L ${b.x} ${b.y} L ${b.x - dir * 9} ${b.y + 6}`;
  return `
    <g class="fig-turn" opacity="${n2(Math.min(1, Math.abs(turn) * 1.6))}">
      <path class="fig-turn-arrow" fill="none" d="M ${n2(a.x)} ${n2(a.y)} Q ${n2((a.x + b.x) / 2)} ${n2(a.y - 16)} ${n2(b.x)} ${n2(b.y)}" />
      <path class="fig-turn-arrow" fill="none" d="M ${n2(head)}" />
      <text class="fig-turn-label" x="${n2(d.cx + dir * (d.arrow.dx + 16))}" y="${d.arrow.y + 4}"
        text-anchor="${dir > 0 ? "start" : "end"}">${esc(t(label))}</text>
    </g>`;
}

// رسمة التسليم كاملة عند لحظة معيّنة من الحركة
function drawTaslimBack(turn = 0, label = null) {
  return {
    viewBox: `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`,
    svg: `${taslimBody()}${taslimHead(turn)}${taslimArrow(turn, label)}`,
  };
}

// بديل بدون حركة (prefers-reduced-motion): لوحتان جنب بعض، يمين ويسار، مع الكلمات.
function drawTaslimPanels() {
  const half = FRAME.w / 2;
  const panel = (turn, label, shiftX) => `
    <g transform="translate(${n2(shiftX)} ${n2(FRAME.y + FRAME.h * 0.12)}) scale(0.5)">
      <g transform="translate(${n2(-FRAME.x - FRAME.w / 2)} ${n2(-FRAME.y)})">
        ${taslimBody()}${taslimHead(turn)}${taslimArrow(turn, label)}
      </g>
    </g>`;
  return {
    viewBox: `${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}`,
    svg: panel(1, "taslim_right", FRAME.x + half * 0.5) + panel(-1, "taslim_left", FRAME.x + half * 1.5),
  };
}

function poseNameFor(step) {
  const name = POSE_FOR_STEP[step.id];
  return name && POSES[name] ? name : null;
}

// آخر وضعية ظهرت للمستخدم، عشان الخطوة الجديدة تتحرك منها.
// null = الخطوة السابقة ما فيها شكل أصلاً، فالخطوة الجديدة تبدأ من وضعيتها مباشرة بدون حركة.
let lastPoseName = "standing";

// تحذير واحد فقط لكل اسم ناقص، عشان ما نغرق الـ console داخل حلقة الحركة.
const warned = new Set();
function poseOr(name, fallbackName) {
  const pose = ALL_POSES[name];
  if (pose) return pose;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`[figure] unknown pose "${name}", falling back to "${fallbackName}"`);
  }
  return ALL_POSES[fallbackName] ?? POSES.standing;
}

// هل هذي الخطوة لها مخطط "أعضاء السجود السبعة" (المنظر الأمامي)؟
const hasDiagram = (name) => name === "sujood";

export function figureCard(step) {
  const name = poseNameFor(step);
  if (!name) return "";
  const pose = POSES[name];
  const altKey = `figure_alt_${name}`;
  const alt = has(altKey) ? t(altKey) : t("figure_label");
  return `
    <section class="figure-card${step.dhikr ? " attached" : ""}" data-pose="${esc(name)}" data-from="${esc(lastPoseName ?? "")}">
      ${hasDiagram(name) ? `<p class="figure-diagram-label">${esc(t("figure_diagram_title"))}</p>` : ""}
      <svg class="fig-svg" viewBox="${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid meet">
        <g class="fig-layer fig-side"></g>
        <g class="fig-layer fig-front"></g>
        <g class="fig-layer fig-back"></g>
      </svg>
      ${pose.caption && has(pose.caption) ? `<p class="figure-caption">${esc(t(pose.caption))}</p>` : ""}
      <div class="video-controls">
        <button type="button" class="vbtn" data-act="replay">${esc(t("figure_replay"))}</button>
        <button type="button" class="vbtn" data-act="speed" aria-label="${esc(t("figure_speed_label"))}">${esc(t("figure_speed", { x: VIDEO_SPEEDS[0] }))}</button>
      </div>
    </section>`;
}

// بطاقة المخطط فقط (بدون حركة ولا أزرار): تُعرض تحت الفيديو لما تكون الخطوة فيها فيديو،
// لأن أعضاء السجود السبعة مرجع لازم يبقى ظاهر حتى لو فيه مقطع توضيحي.
export function diagramCard(step) {
  const name = poseNameFor(step);
  if (!name || !hasDiagram(name)) return "";
  const pose = POSES[name];
  const altKey = `figure_alt_${name}`;
  const alt = has(altKey) ? t(altKey) : t("figure_label");
  return `
    <section class="figure-card diagram-only${step.dhikr ? " attached" : ""}" data-diagram="1">
      <p class="figure-diagram-label">${esc(t("figure_diagram_title"))}</p>
      <svg class="fig-svg" viewBox="${FRAME.x} ${FRAME.y} ${FRAME.w} ${FRAME.h}" role="img" aria-label="${esc(alt)}" preserveAspectRatio="xMidYMid meet">
        <g class="fig-layer fig-front" style="opacity:1"></g>
      </svg>
      ${pose.caption && has(pose.caption) ? `<p class="figure-caption">${esc(t(pose.caption))}</p>` : ""}
    </section>`;
}

export function setupFigure(root) {
  const card = root.querySelector(".figure-card");
  if (!card) {
    // الخطوة الحالية ما فيها شكل: الخطوة الجاية تبدأ من وضعيتها مباشرة بدون حركة
    lastPoseName = null;
    return { replay() {}, dispose() {} };
  }

  // بطاقة مخطط ساكنة (تحت الفيديو): نرسم المنظر الأمامي مرة وحدة بدون حركة
  if (card.dataset.diagram) {
    const layer = card.querySelector(".fig-front");
    layer.innerHTML = drawSujoodFront().svg;
    layer.querySelector(".fig-highlights")?.classList.add("show");
    card.classList.add("front-shown");
    lastPoseName = "sujood";
    return { replay() {}, dispose() {} };
  }

  const svg = card.querySelector(".fig-svg");
  const replayBtn = card.querySelector('[data-act="replay"]');
  const speedBtn = card.querySelector('[data-act="speed"]');
  const toName = card.dataset.pose;
  const fromName = ALL_POSES[card.dataset.from] ? card.dataset.from : toName;

  const sideLayer = svg.querySelector(".fig-side");
  const frontLayer = svg.querySelector(".fig-front");
  const backLayer = svg.querySelector(".fig-back");
  // السجود له منظر أمامي، والتسليم له منظر من الخلف، والباقي جانبي.
  const endsInFront = toName === "sujood";
  const startsInFront = fromName === "sujood" && toName !== "sujood";
  const endsInBack = toName === "taslim";
  // جسم التسليم هو نفسه جلسة التشهد، فنرسم الهيكل الجانبي على أنه "sitting"
  const skeletonName = toName === "taslim" ? "sitting" : toName;

  let speedIdx = 0;
  let raf = 0;
  let disposed = false;
  // كل المؤقتات المعلّقة، عشان نلغيها كلها عند الخروج من الخطوة (مو آخر واحد بس)
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!disposed) fn();
    }, ms);
    timers.add(id);
    return id;
  };
  // يوقف كل شيء معلّق: إطار الرسم القادم وكل المؤقتات
  function stopAll() {
    cancelAnimationFrame(raf);
    raf = 0;
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  function render(angles, armScale) {
    sideLayer.innerHTML = drawPose(skeletonName, angles, armScale).svg;
  }
  function renderFront() {
    if (!frontLayer.innerHTML) frontLayer.innerHTML = drawSujoodFront().svg;
  }
  // أي طبقة تبين الآن (التلاشي نفسه في CSS)
  function showLayer(which) {
    sideLayer.style.opacity = which === "side" ? "1" : "0";
    frontLayer.style.opacity = which === "front" ? "1" : "0";
    backLayer.style.opacity = which === "back" ? "1" : "0";
    // عنوان المخطط يبيّن مع المنظر الأمامي فقط
    card.classList.toggle("front-shown", which === "front");
  }
  function revealDots(layer) {
    layer.querySelector(".fig-highlights")?.classList.add("show");
  }

  // الوضع النهائي للخطوة
  // حلقة التفات الرأس في التسليم: الجسم ثابت والرأس فقط يتحرك.
  function runTaslim() {
    const p = POSES.sitting;
    render(p.angles, p.armScale ?? 1); // الجسم الجانبي يبقى تحت، للتلاشي
    backLayer.innerHTML = drawTaslimBack(0, null).svg;
    showLayer("back");

    if (reducedMotion()) {
      backLayer.innerHTML = drawTaslimPanels().svg; // لوحتان ساكنتان بدل الحركة
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      if (disposed) return;
      const elapsed = Math.max(0, (now - t0) * VIDEO_SPEEDS[speedIdx]);
      const { turn, label } = taslimTurnAt(elapsed);
      backLayer.innerHTML = drawTaslimBack(turn, label).svg;
      if (elapsed < TASLIM_MS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function finish() {
    if (endsInBack) return runTaslim();
    if (endsInFront) {
      renderFront();
      const p = POSES.sujood;
      render(p.angles, p.armScale ?? 1); // تبقى تحت الطبقة الأمامية
      showLayer("front");
      revealDots(frontLayer);
      return;
    }
    const p = POSES[toName];
    render(p.angles, p.armScale ?? 1);
    showLayer("side");
    revealDots(sideLayer);
  }

  // النزول على مراحل في المنظر الجانبي، ثم تلاشٍ للمنظر الأمامي عند وصول الجبهة للأرض.
  function runPath(onDone) {
    const path = pathBetween(fromName, toName);
    if (path.length < 2) return onDone();
    const total = durationFor(path);
    const segMs = total / (path.length - 1);
    const t0 = performance.now();

    const frame = (now) => {
      if (disposed) return;
      // مهم: الوقت اللي يعطينا إياه requestAnimationFrame هو وقت **بداية الإطار**،
      // وممكن يكون أقدم من performance.now() اللي أخذناه قبل شوي، فيطلع elapsed سالب.
      // بدون هذا التصفير تطلع seg = -1 و path[-1] = undefined ويرمي الكود خطأ.
      const elapsed = Math.max(0, (now - t0) * VIDEO_SPEEDS[speedIdx]);
      if (elapsed >= total) return onDone();
      const seg = Math.min(path.length - 2, Math.max(0, Math.floor(elapsed / segMs)));
      const local = easeInOut(Math.min(1, Math.max(0, (elapsed - seg * segMs) / segMs)));
      const A = poseOr(path[seg], toName), B = poseOr(path[seg + 1], toName);
      render(lerpAngles(A.angles, B.angles, local), lerp(A.armScale ?? 1, B.armScale ?? 1, local));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function animate() {
    stopAll();
    const path = pathBetween(fromName, toName);
    if (path.length < 2 || reducedMotion()) return finish();

    if (startsInFront) {
      // نرجع من السجود: نبدأ بالمنظر الأمامي، نتلاشى للجانبي، ثم نقوم على مراحل.
      renderFront();
      const sj = POSES.sujood;
      render(sj.angles, sj.armScale ?? 1);
      showLayer("front");
      later(() => {
        showLayer("side");
        later(() => runPath(finish), CROSSFADE_MS);
      }, 60);
      return;
    }

    showLayer("side");
    runPath(finish);
  }

  replayBtn.onclick = animate;
  speedBtn.onclick = () => {
    speedIdx = (speedIdx + 1) % VIDEO_SPEEDS.length;
    speedBtn.textContent = t("figure_speed", { x: VIDEO_SPEEDS[speedIdx] });
  };

  animate();
  // جسم التسليم هو نفسه جلسة التشهد، فنسجّل "sitting" عشان الرجوع للتشهد
  // ما يصير فيه حركة وهمية بين وضعيتين متطابقتين.
  lastPoseName = toName === "taslim" ? "sitting" : toName;

  return {
    // نفس اللي يسويه زر الإعادة، عشان لوح المساعدة يقدر يعيد الحركة
    replay: animate,
    dispose() {
      disposed = true;
      stopAll();
    },
  };
}

export { drawPose, drawSujoodFront, drawTaslimBack, drawTaslimPanels, taslimBody, poseNameFor };
