// وضعيات الشكل التوضيحي: زوايا المفاصل + نقاط التوضيح (highlights) لكل خطوة.
//
// ⚠️ هذي الأرقام **في انتظار مراجعة المختصة الشرعية**. هي تقريب هندسي للوضعيات،
// وليست فتوى ولا مرجعاً فقهياً. بعد المراجعة عدّلوا الأرقام من صفحة المراجعة:
//   npm run dev  ثم افتحوا  /labs/figure.html
// فيها مسرّعات (sliders) لكل زاوية وزر "نسخ بيانات الوضعية" يطبع الأرقام جاهزة للصق هنا.
//
// الزوايا مطلقة بالدرجات: 0° = للأمام (يمين)، 90° = لأعلى، -90° = لأسفل، 180° = للخلف.
// Near = الجهة القريبة من الكاميرا، Far = الجهة البعيدة (تُرسم خلف الجسم وأبهت).
// الأرجل متماثلة في كل الوضعيات، والعمق يجي من إزاحة بسيطة وقت الرسم.
//
// armScale = معامل إسقاط الذراعين (شوفوا kinematics.js):
//   في السجود الذراعان تتجهان للجنب، فطولهما **الظاهر** في المنظر الجانبي أقصر.
//   هذا إسقاط هندسي لوضعية ثلاثية الأبعاد على رسمة مسطّحة، وليس تغييراً في الجسم.
//   يساوي 1 في القيام والتكبير والركوع.
//
// التوضيحات (highlights):
//   { type: "dot",  at: "مفصل" }                      → نقطة واحدة
//   { type: "pair", near: "...", far: "...", badge }   → نقطتان (قريبة وبعيدة) + شارة ×2
//   { type: "line", from, to, level: true }            → خط متقطع + علامة "مستوي"

const LEGS_STANDING = {
  thighNear: -90, shinNear: -90, footNear: 0,
  thighFar: -90, shinFar: -90, footFar: 0,
};

// أرجل الجلوس على الركبتين: الركبة على الأرض، الساق للخلف،
// **والعقب مرفوع وأصابع القدم مثنية ومركوزة على الأرض** (مو القدم مفرودة كأنه جالس).
// بهذي الأرقام: الكاحل (العقب) يرتفع ١٧.٨ بكسل عن الأرض، وأصابع القدم تلامس الأرض تماماً.
// الترتيب من الخلف للأمام: أصابع ← كاحل ← ركبة.
// ⚠️ المسافة بين العقبين (وهل يتلاصقان أو يتباعدان) في انتظار مراجعة المختصة الشرعية.
const LEGS_KNEELING = {
  thighNear: -101.6, shinNear: 160, footNear: -126.1,
  thighFar: -101.6, shinFar: 160, footFar: -126.1,
};

export const POSES = {
  // تكبيرة الإحرام: قائم، اليدان مرفوعتان والكفان للأمام بمستوى الكتفين/الأذنين.
  takbir: {
    angles: {
      torso: 90, neck: 90,
      upperArmNear: -39.4, forearmNear: 100.5, handNear: 90,
      upperArmFar: -58.2, forearmFar: 91.7, handFar: 90,
      ...LEGS_STANDING,
    },
    armScale: 1,
    highlights: [{ type: "pair", near: "palmNear", far: "palmFar", badge: true }],
  },

  // القيام: الجذع عمودي، اليد اليمنى على اليسرى على الصدر.
  // ملاحظة: في المنظر الجانبي وضع اليدين على الصدر يبيّن تقريبياً،
  // لأن الساعدين في الحقيقة يتقاطعان في عمق الصورة.
  standing: {
    angles: {
      torso: 90, neck: 90,
      upperArmNear: -102.9, forearmNear: 30, handNear: 25,
      upperArmFar: -111.9, forearmFar: 15.7, handFar: 18,
      ...LEGS_STANDING,
    },
    armScale: 1,
    highlights: [{ type: "pair", near: "palmNear", far: "palmFar", badge: true }],
  },

  // الركوع: الظهر مستوٍ مع الأرض، الرأس امتداد للظهر، الركبتان مستقيمتان، الكفان على الركبتين.
  // ⚠️ لا تغيّروا أرقام الركوع: تمت مراجعتها بصرياً وهي مقبولة.
  ruku: {
    angles: {
      torso: -0.2, neck: 0,
      upperArmNear: -136.9, forearmNear: -136.5, handNear: -90,
      upperArmFar: -136.9, forearmFar: -136.5, handFar: -90,
      thighNear: -89.1, shinNear: -90, footNear: 0,
      thighFar: -89.1, shinFar: -90, footFar: 0,
    },
    armScale: 1,
    highlights: [
      { type: "line", from: "hip", to: "shoulder", level: true },
      { type: "pair", near: "palmNear", far: "palmFar", badge: true },
    ],
  },

  // السجود: الجبهة والأنف على الأرض، الكفان على الأرض **خلف الجبهة** (مو تحتها)،
  // المرفقان مرفوعان عن الأرض، الركبتان وأصابع القدمين على الأرض، والوركان أعلى نقطة.
  // أعضاء السجود السبعة تطلع في أربع مواضع أفقية مختلفة عشان تُعدّ بالعين:
  //   أصابع القدمين ← الركبتان ← الكفان ← الجبهة
  sujood: {
    angles: {
      torso: -30, neck: -15.3,
      upperArmNear: -156.1, forearmNear: -147.1, handNear: 0,
      upperArmFar: -156.1, forearmFar: -147.1, handFar: 0,
      ...LEGS_KNEELING,
    },
    armScale: 0.62,
    highlights: [
      { type: "dot", at: "forehead" }, // الجبهة والأنف = عضو واحد
      { type: "pair", near: "palmNear", far: "palmFar", badge: true },
      { type: "pair", near: "kneeNear", far: "kneeFar", badge: true },
      { type: "pair", near: "toeNear", far: "toeFar", badge: true },
    ],
    caption: "figure_seven_points",
  },
};

// ---------- وضعيات وسطية للحركة فقط (ما تظهر كخطوة) ----------
// الانتقال للسجود ما يكون "مزج مباشر" للزوايا، لأن الجسم يطلع طافي فوق السجادة.
// نمشي على مراحل مثل الإنسان: نقف ← الركبتان للأرض ← الكفان للأرض ← الجبهة للأرض.
export const STAGES = {
  // الجلوس على الركبتين والجذع معتدل واليدان مرسلتان
  kneel: {
    angles: {
      torso: 90, neck: 90,
      upperArmNear: -84, forearmNear: -88, handNear: -86,
      upperArmFar: -96, forearmFar: -92, handFar: -94,
      ...LEGS_KNEELING,
    },
    armScale: 1,
  },
  // الكفان وصلوا الأرض والرأس لسا مرفوع (قبل ما تنزل الجبهة)
  palmsDown: {
    angles: {
      torso: -26.2, neck: 45,
      upperArmNear: -146.3, forearmNear: -146.2, handNear: 0,
      upperArmFar: -146.3, forearmFar: -146.2, handFar: 0,
      ...LEGS_KNEELING,
    },
    armScale: 0.62,
  },
};

// كل الوضعيات (المعروضة + الوسطية) في مكان واحد، للحركة والاختبارات
export const ALL_POSES = { ...POSES, ...STAGES };

const TO_SUJOOD = ["standing", "kneel", "palmsDown", "sujood"];

// مسار الحركة بين وضعيتين: قائمة أسماء وضعيات نمر عليها بالترتيب.
// النزول للسجود (والرجوع منه) يمر بالمراحل، وأي انتقال ثاني مباشر.
export function pathBetween(from, to) {
  if (from === to) return [to];
  if (to === "sujood") {
    const head = from === "standing" ? [] : [from];
    return [...head, ...TO_SUJOOD];
  }
  if (from === "sujood") {
    const path = [...TO_SUJOOD].reverse(); // sujood → palmsDown → kneel → standing
    return to === "standing" ? path : [...path, to];
  }
  return [from, to];
}

// المدة الكاملة للحركة بالمللي ثانية. مسار السجود تقريباً 3 ثواني، وغيره ثانية.
export function durationFor(path) {
  return path.length > 2 ? 3000 : 1000;
}

// ============================================================================
// السجود — منظر أمامي (المصلي ساجد باتجاه الناظر)
// ============================================================================
// ⚠️ في انتظار مراجعة المختصة الشرعية، مثل بقية الوضعيات.
//
// ليش منظر أمامي بس للسجود؟ لأن المنظر الجانبي يكدّس الذراع والرجل والجسم فوق
// بعض فيطلع كتلة ما تنقرأ. من الأمام تنفصل أعضاء السجود السبعة ونقدر نرقّمها ١-٧.
//
// الكاميرا: الناظر عند جهة الرأس وفوق شوي. الأقرب للناظر (أسفل الصورة):
// قوس السجادة، ثم الرأس والجبهة على الأرض والكفان على جنبيه.
// والأبعد (أعلى الصورة): الوركان ثم الركبتان ثم أصابع القدمين.
// يعني: **y أصغر = أبعد عن الناظر**. والأبعد يكون أصغر (منظور).
// الشكل متماثل تماماً يمين/يسار: نعرّف نصف العرض (dx) وننعكس حوله.
//
// الإحداثيات داخل نفس الإطار الثابت FRAME عشان التلاشي بين المنظرين ما فيه قفزة.
export const SUJOOD_FRONT = {
  cx: 167.5, // محور التماثل

  // أجزاء الجسم: dx = المسافة عن المحور، y = البُعد (أصغر = أبعد)
  head: { y: 155, r: 20 }, // الرأس أقرب شيء بعد القوس، فهو أكبر شيء
  palm: { dx: 62, y: 138 }, // الكفان على الأرض على جنبي الرأس (بعرض الكتفين)
  elbow: { dx: 85, y: 120 }, // المرفقان مرفوعان ومتجهان للخارج، فهما أوسع نقطة
  shoulder: { dx: 36, y: 112 }, // الظهر أعرض شيء عند الكتفين
  // في السجود الركبتان تحت الوركين تقريباً، فالفخذ شبه عمودي:
  // من هذي الزاوية يظهر **مختصراً جداً** (مجرد وصلة قصيرة)، مو عمودين طويلين.
  hip: { dx: 24, y: 62 }, // الوركان فوق الركبتين مباشرة، وأضيق من الكتفين
  knee: { dx: 26, y: 52 }, // الركبتان متباعدتان على الأرض
  heel: { dx: 22, y: 18 }, // العقب مرفوع عن الأرض
  toe: { dx: 19, y: 0 }, // أصابع القدمين مركوزة على الأرض، وهي أبعد شيء

  // النِسَب: المسافة من الجبهة للركبتين ≈ ضعف المسافة من الركبتين للأصابع
  // (155-52 = 103 مقابل 52-0 = 52)

  // سماكة الأعضاء
  w: { upperArm: 15, forearm: 12, hand: 13, thigh: 30, shin: 20, foot: 13, neck: 16 },

  // السجادة: شبه منحرف (قريبة = أعرض) عشان تبيّن أرضية ممتدة، والقوس في المقدمة
  mat: { nearY: 212, farY: -25, nearHalf: 150, farHalf: 95, archY: 186, archHalf: 22 },

  // أعضاء السجود السبعة، مرقّمة بالترتيب
  contacts: [
    { n: 1, at: "forehead" }, // الجبهة مع الأنف = عضو واحد
    { n: 2, at: "palmL" },
    { n: 3, at: "palmR" },
    { n: 4, at: "kneeL" },
    { n: 5, at: "kneeR" },
    { n: 6, at: "toeL" },
    { n: 7, at: "toeR" },
  ],
  caption: "figure_seven_points",
};

// يحوّل التعريف المختصر فوق إلى نقاط مطلقة (يسار/يمين) جاهزة للرسم والاختبار.
export function frontPoints(def = SUJOOD_FRONT) {
  const { cx } = def;
  const pair = (p) => ({ L: { x: cx - p.dx, y: p.y }, R: { x: cx + p.dx, y: p.y } });
  const palm = pair(def.palm), elbow = pair(def.elbow), shoulder = pair(def.shoulder);
  const hip = pair(def.hip), knee = pair(def.knee), toe = pair(def.toe), heel = pair(def.heel);
  return {
    head: { x: cx, y: def.head.y, r: def.head.r },
    forehead: { x: cx, y: def.head.y }, // نقطة تلامس الجبهة تحت الرأس مباشرة
    palmL: palm.L, palmR: palm.R,
    elbowL: elbow.L, elbowR: elbow.R,
    shoulderL: shoulder.L, shoulderR: shoulder.R,
    hipL: hip.L, hipR: hip.R,
    kneeL: knee.L, kneeR: knee.R,
    heelL: heel.L, heelR: heel.R,
    toeL: toe.L, toeR: toe.R,
  };
}

// نصف عرض السجادة عند بُعد معيّن (للتأكد إن نقاط التلامس كلها واقعة على السجادة)
export function matHalfWidthAt(y, def = SUJOOD_FRONT) {
  const { nearY, farY, nearHalf, farHalf } = def.mat;
  const t = Math.max(0, Math.min(1, (y - farY) / (nearY - farY)));
  return farHalf + (nearHalf - farHalf) * t;
}

// هل النقطة واقعة على السجادة؟
export function isOnFrontMat(p, def = SUJOOD_FRONT) {
  return p.y >= def.mat.farY && p.y <= def.mat.nearY && Math.abs(p.x - def.cx) <= matHalfWidthAt(p.y, def);
}

// مدة التلاشي بين المنظر الجانبي والأمامي (مللي ثانية)
export const CROSSFADE_MS = 500;

// أي خطوة في fajr.json تستخدم أي وضعية. الفاتحة تُقرأ قائماً.
export const POSE_FOR_STEP = {
  takbir: "takbir",
  standing: "standing",
  fatiha: "standing",
  ruku: "ruku",
  sujood: "sujood",
};
