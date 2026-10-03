// حساب مواضع المفاصل من الزوايا (forward kinematics) للشكل التوضيحي للصلاة.
// هذا الملف رياضيات صافية: ما فيه أي DOM، عشان نقدر نختبره في Node (tests/figure.test.mjs).
//
// النظام: منظر جانبي، الشكل يواجه اليمين.
// الزوايا مطلقة بالدرجات: 0° = للأمام (يمين)، 90° = لأعلى، -90° = لأسفل، 180° = للخلف.
// في SVG محور y يزيد لأسفل، فعشان كذا نطرح sin: y = y - L*sin(angle).

// أطوال الأعضاء بالبكسل. لا تتغير بين الوضعيات أبداً (الاختبار يتأكد من هذا).
// النسب قريبة من نسب الإنسان الحقيقية، وهذا مهم: لازم الذراع توصل الركبة في الركوع
// والسواعد عمودية تقريباً. (المسافة المطلوبة = جذر(الجذع² + الفخذ²) ≈ 79 والذراع 78.)
export const LIMBS = {
  torso: 58, // الورك → الكتف
  // طوّلنا الرقبة من 26 إلى 30: في السجود لازم الرأس يلمس الأرض ويكون متقدّم عن الكتف
  // في نفس الوقت، عشان الكفوف تنزل خلف الجبهة والمرفق يبقى مرفوع. بـ26 الثلاثة ما تجتمع.
  neck: 30, // الكتف → مركز الرأس
  upperArm: 40,
  forearm: 38,
  hand: 14, // الرسغ → الكف (نقطة التلامس)
  thigh: 54,
  shin: 52,
  foot: 22, // الكاحل → أصابع القدم
};

export const HEAD_R = 16; // نصف قطر الرأس

// خط الأرض، وموضع أصابع القدم الثابت (جذر الشكل).
export const VIEW = { floorY: 196 };
export const ANCHOR_X = 96;

// **إطار ثابت واحد لكل الوضعيات.** قبل كذا كان كل وضعية لها إطار يضبط نفسه عليها،
// فيتغيّر حجم الشكل بين الخطوات ويشوّش العين أثناء الحركة. الآن الإطار ثابت،
// محسوب عشان أوسع وضعية (السجود) تدخل فيه بهامش، والسجادة والقوس يبينون دايماً.
// الاختبار يتأكد إن كل وضعية (وكل لقطة من الحركة) تدخل داخل هذا الإطار.
export const FRAME = { x: 25, y: -44, w: 285, h: 285 };

const RAD = Math.PI / 180;

// نقطة جديدة على بعد len من p باتجاه الزاوية a
function step(p, len, a) {
  return { x: p.x + len * Math.cos(a * RAD), y: p.y - len * Math.sin(a * RAD) };
}

// الزوايا المطلوبة في كل وضعية (الاختبار يتأكد إن كل وضعية فيها نفس المفاتيح).
export const ANGLE_KEYS = [
  "torso",
  "neck",
  "upperArmNear",
  "forearmNear",
  "handNear",
  "upperArmFar",
  "forearmFar",
  "handFar",
  "thighNear",
  "shinNear",
  "footNear",
  "thighFar",
  "shinFar",
  "footFar",
];

// سلسلة الذراع: الكتف → الكوع → الرسغ → الكف
// armScale = معامل "الإسقاط": في السجود الذراعان تتجهان للجنب (خارج مستوى الرسمة)،
// فطولهما الظاهر في المنظر الجانبي أقصر من طولهما الحقيقي. هذا إسقاط هندسي صحيح،
// وليس تغييراً في جسم الشكل. يساوي 1 في كل الوضعيات الواقفة والركوع.
function arm(shoulder, a, side, armScale) {
  const elbow = step(shoulder, LIMBS.upperArm * armScale, a[`upperArm${side}`]);
  const wrist = step(elbow, LIMBS.forearm * armScale, a[`forearm${side}`]);
  const palm = step(wrist, LIMBS.hand, a[`hand${side}`]);
  return { elbow, wrist, palm };
}

// سلسلة الرجل: الورك → الركبة → الكاحل → أصابع القدم
function leg(hip, a, side) {
  const knee = step(hip, LIMBS.thigh, a[`thigh${side}`]);
  const ankle = step(knee, LIMBS.shin, a[`shin${side}`]);
  const toe = step(ankle, LIMBS.foot, a[`foot${side}`]);
  return { knee, ankle, toe };
}

// كل المفاصل قبل المحاذاة، والورك في نقطة الأصل.
function rawJoints(angles, armScale = 1) {
  const hip = { x: 0, y: 0 };
  const shoulder = step(hip, LIMBS.torso, angles.torso);
  const head = step(shoulder, LIMBS.neck, angles.neck);
  // نقطة تلامس الرأس مع الأرض = أوطى نقطة في دائرة الرأس.
  // في السجود هذي منطقة الجبهة والأنف.
  const forehead = { x: head.x, y: head.y + HEAD_R };
  const near = arm(shoulder, angles, "Near", armScale);
  const far = arm(shoulder, angles, "Far", armScale);
  const legNear = leg(hip, angles, "Near");
  const legFar = leg(hip, angles, "Far");
  return {
    hip,
    shoulder,
    head,
    forehead,
    elbowNear: near.elbow,
    wristNear: near.wrist,
    palmNear: near.palm,
    elbowFar: far.elbow,
    wristFar: far.wrist,
    palmFar: far.palm,
    kneeNear: legNear.knee,
    ankleNear: legNear.ankle,
    toeNear: legNear.toe,
    kneeFar: legFar.knee,
    ankleFar: legFar.ankle,
    toeFar: legFar.toe,
  };
}

// النقاط اللي ممكن تلمس الأرض (نحدد منها أوطى نقطة).
const GROUND_POINTS = [
  "forehead",
  "palmNear",
  "palmFar",
  "kneeNear",
  "kneeFar",
  "toeNear",
  "toeFar",
  "ankleNear",
  "ankleFar",
  "elbowNear",
  "elbowFar",
  "wristNear",
  "wristFar",
];

// مواضع المفاصل النهائية.
// **الجذر عند أصابع القدم**: ننقل الشكل عشان أصابع القدم تبقى ثابتة على خط الأرض
// في كل الوضعيات وفي كل لحظة من الحركة. هذا يمنع "طفو" الجسم فوق السجادة أثناء
// الانتقال (كانت المشكلة إننا نحاذي على أوطى نقطة، فترتفع الأقدام لما تنزل اليد).
export function jointsFor(angles, armScale = 1) {
  const raw = rawJoints(angles, armScale);
  const dx = ANCHOR_X - raw.toeNear.x;
  const dy = VIEW.floorY - raw.toeNear.y;
  const out = {};
  for (const [k, p] of Object.entries(raw)) out[k] = { x: p.x + dx, y: p.y + dy };
  return out;
}

// فرق زاويتين بأقصر طريق (−180، 180]. مهم جداً للحركة:
// الساق تلف للخلف وهي تنزل، مو تلف لفة كاملة للأمام.
export function angleDelta(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

// زاوية بين وضعيتين عند النسبة k (0..1) بأقصر طريق
export function lerpAngle(from, to, k) {
  return from + angleDelta(from, to) * k;
}

// مزج مجموعة زوايا كاملة
export function lerpAngles(from, to, k) {
  const out = {};
  for (const key of ANGLE_KEYS) out[key] = lerpAngle(from[key], to[key], k);
  return out;
}

// أقصى نقطة لأسفل في الشكل (للتأكد إن ما فيه عضو ينزل تحت الأرض)
export function lowestY(j) {
  return Math.max(...GROUND_POINTS.map((k) => j[k].y), j.head.y + HEAD_R);
}

// زاوية عند النقطة b بين b→a و b→c، بالدرجات (180 = مستقيم تماماً)
export function angleAt(a, b, c) {
  const u = Math.atan2(-(a.y - b.y), a.x - b.x);
  const v = Math.atan2(-(c.y - b.y), c.x - b.x);
  const d = Math.abs(u - v) * (180 / Math.PI);
  return d > 180 ? 360 - d : d;
}

// ميلان المستقيم a→b عن الأفق: 0 = أفقي تماماً، 90 = عمودي تماماً
export function inclineFromHorizontal(a, b) {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

// طول كل عضو كما هو محسوب فعلياً (الاختبار يقارنه بـ LIMBS)
export function measuredLimbs(j) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return {
    torso: d(j.hip, j.shoulder),
    neck: d(j.shoulder, j.head),
    upperArmNear: d(j.shoulder, j.elbowNear),
    forearmNear: d(j.elbowNear, j.wristNear),
    handNear: d(j.wristNear, j.palmNear),
    upperArmFar: d(j.shoulder, j.elbowFar),
    forearmFar: d(j.elbowFar, j.wristFar),
    handFar: d(j.wristFar, j.palmFar),
    thighNear: d(j.hip, j.kneeNear),
    shinNear: d(j.kneeNear, j.ankleNear),
    footNear: d(j.ankleNear, j.toeNear),
    thighFar: d(j.hip, j.kneeFar),
    shinFar: d(j.kneeFar, j.ankleFar),
    footFar: d(j.ankleFar, j.toeFar),
  };
}
