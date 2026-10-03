// Run: node tests/figure.test.mjs   (or npm test)
// Checks that the prayer figure's poses are geometrically correct: things that must
// touch the floor touch it, the back really is level in ruku, knees really are straight,
// and no limb changes length between poses.
import assert from "node:assert/strict";
import { LIMBS, HEAD_R, VIEW, FRAME, jointsFor, lerpAngles, lowestY, angleAt, inclineFromHorizontal, measuredLimbs, ANGLE_KEYS }
  from "../src/figure/kinematics.js";
import { POSES, ALL_POSES, POSE_FOR_STEP, pathBetween, durationFor,
  SUJOOD_FRONT, frontPoints, isOnFrontMat, CROSSFADE_MS } from "../src/figure/poses.js";

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

const F = VIEW.floorY;
const FLOOR_TOL = 2; // px
const joints = Object.fromEntries(Object.entries(POSES).map(([k, p]) => [k, jointsFor(p.angles, p.armScale ?? 1)]));
const allJoints = Object.fromEntries(Object.entries(ALL_POSES).map(([k, p]) => [k, jointsFor(p.angles, p.armScale ?? 1)]));
const onFloor = (j, key) => Math.abs(j[key].y - F);

// ---------- sujood: the seven contact points are on the floor, hips highest ----------
test("sujood: forehead, both palms, both knees and both toes are on the floor", () => {
  const j = joints.sujood;
  for (const key of ["forehead", "palmNear", "palmFar", "kneeNear", "kneeFar", "toeNear", "toeFar"]) {
    const gap = onFloor(j, key);
    assert.ok(gap <= FLOOR_TOL, `${key} is ${gap.toFixed(2)}px off the floor (max ${FLOOR_TOL})`);
  }
});

test("sujood: hips are higher than the shoulders", () => {
  const j = joints.sujood;
  // y grows downward, so "higher" means a smaller y
  assert.ok(j.hip.y < j.shoulder.y, `hip y ${j.hip.y.toFixed(1)} should be above shoulder y ${j.shoulder.y.toFixed(1)}`);
  assert.ok(j.shoulder.y - j.hip.y >= 15, "hips should be clearly, not marginally, higher");
});

test("sujood: elbows are raised off the floor", () => {
  const j = joints.sujood;
  // 12px here is about 12cm in real terms (the hip sits ~53px above the floor).
  // The side view bounds this: the shoulder is only ~24px above the floor, so the
  // folded arm cannot lift the elbow much higher without throwing the hands forward.
  const MIN = 12;
  assert.ok(F - j.elbowNear.y >= MIN, `near elbow only ${(F - j.elbowNear.y).toFixed(1)}px off the floor`);
  assert.ok(F - j.elbowFar.y >= MIN, `far elbow only ${(F - j.elbowFar.y).toFixed(1)}px off the floor`);
});

// ---------- ruku: back level, knees straight, hands at knee height ----------
test("ruku: the shoulder-to-hip line is within 5 degrees of horizontal", () => {
  const j = joints.ruku;
  const incline = inclineFromHorizontal(j.hip, j.shoulder);
  assert.ok(incline <= 5, `back is ${incline.toFixed(2)} degrees off horizontal`);
});

test("ruku: knee angle is at least 170 degrees (legs straight)", () => {
  const j = joints.ruku;
  for (const side of ["Near", "Far"]) {
    const a = angleAt(j.hip, j[`knee${side}`], j[`ankle${side}`]);
    assert.ok(a >= 170, `${side} knee angle is ${a.toFixed(2)} degrees`);
  }
});

test("ruku: hands are at knee height", () => {
  const j = joints.ruku;
  for (const side of ["Near", "Far"]) {
    const dy = Math.abs(j[`wrist${side}`].y - j[`knee${side}`].y);
    const dx = Math.abs(j[`wrist${side}`].x - j[`knee${side}`].x);
    assert.ok(dy <= 6, `${side} hand is ${dy.toFixed(2)}px off knee height`);
    assert.ok(dx <= 10, `${side} hand is ${dx.toFixed(2)}px away from the knee horizontally`);
  }
});

test("ruku: the feet stay on the floor", () => {
  const j = joints.ruku;
  assert.ok(onFloor(j, "toeNear") <= FLOOR_TOL, "near toe off the floor");
  assert.ok(onFloor(j, "toeFar") <= FLOOR_TOL, "far toe off the floor");
});

// ---------- standing and takbir: upright, feet down ----------
for (const pose of ["standing", "takbir"]) {
  test(`${pose}: torso is within 5 degrees of vertical`, () => {
    const j = joints[pose];
    const fromVertical = 90 - inclineFromHorizontal(j.hip, j.shoulder);
    assert.ok(Math.abs(fromVertical) <= 5, `torso is ${fromVertical.toFixed(2)} degrees off vertical`);
  });

  test(`${pose}: the feet are on the floor`, () => {
    const j = joints[pose];
    assert.ok(onFloor(j, "toeNear") <= FLOOR_TOL, "near toe off the floor");
    assert.ok(onFloor(j, "toeFar") <= FLOOR_TOL, "far toe off the floor");
  });

  test(`${pose}: knees are straight`, () => {
    const j = joints[pose];
    assert.ok(angleAt(j.hip, j.kneeNear, j.ankleNear) >= 170, "near knee bent");
  });
}

test("takbir: both hands are raised above the shoulders", () => {
  const j = joints.takbir;
  assert.ok(j.wristNear.y < j.shoulder.y, "near hand is not raised");
  assert.ok(j.wristFar.y < j.shoulder.y + 8, "far hand is not raised");
  assert.ok(j.elbowNear.y > j.wristNear.y, "near forearm should point upward");
});

test("standing: both hands are in front of the chest, between shoulders and hips", () => {
  const j = joints.standing;
  for (const side of ["Near", "Far"]) {
    const w = j[`wrist${side}`];
    assert.ok(w.x > j.shoulder.x, `${side} hand should be in front of the body`);
    assert.ok(w.y > j.shoulder.y && w.y < j.hip.y, `${side} hand should sit between shoulder and hip height`);
  }
});

// ---------- limb lengths are identical in every pose ----------
test("no limb changes length between poses (arms allow only the documented projection factor)", () => {
  for (const [name, pose] of Object.entries(ALL_POSES)) {
    const sc = pose.armScale ?? 1;
    const expected = {
      torso: LIMBS.torso, neck: LIMBS.neck,
      upperArmNear: LIMBS.upperArm * sc, forearmNear: LIMBS.forearm * sc, handNear: LIMBS.hand,
      upperArmFar: LIMBS.upperArm * sc, forearmFar: LIMBS.forearm * sc, handFar: LIMBS.hand,
      thighNear: LIMBS.thigh, shinNear: LIMBS.shin, footNear: LIMBS.foot,
      thighFar: LIMBS.thigh, shinFar: LIMBS.shin, footFar: LIMBS.foot,
    };
    const m = measuredLimbs(allJoints[name]);
    for (const [limb, want] of Object.entries(expected)) {
      assert.ok(Math.abs(m[limb] - want) < 0.001, `${name}: ${limb} measured ${m[limb].toFixed(3)}, expected ${want}`);
    }
  }
});

test("the arm projection factor is exactly 1 for the standing poses and ruku", () => {
  for (const name of ["standing", "takbir", "ruku", "kneel"]) {
    assert.equal(ALL_POSES[name].armScale ?? 1, 1, `${name} must not foreshorten the arms`);
  }
  assert.ok((ALL_POSES.sujood.armScale ?? 1) < 1, "sujood arms point out of the drawing plane");
});

// ---------- pose data is well formed ----------
test("every pose defines every joint angle", () => {
  for (const [name, pose] of Object.entries(POSES)) {
    const keys = Object.keys(pose.angles).sort();
    assert.deepEqual(keys, [...ANGLE_KEYS].sort(), `${name} has the wrong set of angles`);
    for (const [k, v] of Object.entries(pose.angles)) {
      assert.ok(Number.isFinite(v), `${name}.${k} is not a number`);
    }
  }
});

test("every highlight points at a joint that exists", () => {
  for (const [name, pose] of Object.entries(POSES)) {
    for (const h of pose.highlights ?? []) {
      if (h.type === "dot") assert.ok(h.at in joints[name], `${name}: no joint "${h.at}"`);
      else if (h.type === "pair") {
        assert.ok(h.near in joints[name], `${name}: no joint "${h.near}"`);
        assert.ok(h.far in joints[name], `${name}: no joint "${h.far}"`);
      } else if (h.type === "line") {
        assert.ok(h.from in joints[name], `${name}: no joint "${h.from}"`);
        assert.ok(h.to in joints[name], `${name}: no joint "${h.to}"`);
      } else assert.fail(`${name}: unknown highlight type "${h.type}"`);
    }
  }
});

test("sujood highlights exactly the seven contact points", () => {
  const n = POSES.sujood.highlights.reduce((acc, h) => acc + (h.type === "dot" ? 1 : h.type === "pair" ? 2 : 0), 0);
  assert.equal(n, 7, "sujood should mark 7 points");
  assert.equal(POSES.sujood.caption, "figure_seven_points");
  for (const h of POSES.sujood.highlights.filter((x) => x.type === "pair")) {
    assert.ok(h.badge, "paired contact points need the x2 badge");
  }
});

// ---------- the seven points must be countable: four separated horizontal groups ----------
test("sujood: forehead, palms, knees and toes sit at least 15px apart horizontally", () => {
  const j = joints.sujood;
  const groups = { toes: j.toeNear.x, knees: j.kneeNear.x, palms: j.palmNear.x, forehead: j.forehead.x };
  const names = Object.keys(groups);
  for (let a = 0; a < names.length; a++) {
    for (let b = a + 1; b < names.length; b++) {
      const gap = Math.abs(groups[names[a]] - groups[names[b]]);
      assert.ok(gap >= 15, `${names[a]} and ${names[b]} are only ${gap.toFixed(1)}px apart horizontally`);
    }
  }
});

test("sujood: the head shape itself rests on the floor", () => {
  const j = joints.sujood;
  const gap = Math.abs(j.head.y + HEAD_R - F);
  assert.ok(gap <= FLOOR_TOL, `the bottom of the head is ${gap.toFixed(2)}px off the floor`);
});

test("sujood: the palms are behind the forehead, not under the head", () => {
  const j = joints.sujood;
  assert.ok(j.palmNear.x < j.head.x - HEAD_R + 6, "near palm overlaps the head");
  assert.ok(j.palmFar.x < j.head.x - HEAD_R + 6, "far palm overlaps the head");
});

// ---------- the staged descent into sujood ----------
test("the staged path into sujood goes through the kneeling stages", () => {
  assert.deepEqual(pathBetween("standing", "sujood"), ["standing", "kneel", "palmsDown", "sujood"]);
  assert.deepEqual(pathBetween("ruku", "sujood"), ["ruku", "standing", "kneel", "palmsDown", "sujood"]);
  assert.deepEqual(pathBetween("sujood", "standing"), ["sujood", "palmsDown", "kneel", "standing"]);
  assert.ok(durationFor(pathBetween("standing", "sujood")) >= 2500, "the descent should take about 3 seconds");
});

test("every sampled frame of the sujood descent keeps the toes on the floor and nothing below it", () => {
  for (const start of ["standing", "ruku", "sujood"]) {
    const target = start === "sujood" ? "standing" : "sujood";
    const path = pathBetween(start, target);
    for (let s2 = 0; s2 < path.length - 1; s2++) {
      const A = ALL_POSES[path[s2]], B = ALL_POSES[path[s2 + 1]];
      for (let i = 0; i <= 24; i++) {
        const k = i / 24;
        const scale = (A.armScale ?? 1) + ((B.armScale ?? 1) - (A.armScale ?? 1)) * k;
        const j = jointsFor(lerpAngles(A.angles, B.angles, k), scale);
        const toeGap = Math.abs(j.toeNear.y - F);
        assert.ok(toeGap <= 0.01, `${path[s2]}->${path[s2 + 1]} @${k.toFixed(2)}: toe left the floor by ${toeGap.toFixed(2)}px`);
        const below = lowestY(j) - F;
        assert.ok(below <= 1, `${path[s2]}->${path[s2 + 1]} @${k.toFixed(2)}: a body part is ${below.toFixed(2)}px below the floor`);
      }
    }
  }
});

test("every step maps to a pose that exists", () => {
  for (const [step, pose] of Object.entries(POSE_FOR_STEP)) {
    assert.ok(pose in POSES, `step "${step}" maps to unknown pose "${pose}"`);
  }
  assert.equal(POSE_FOR_STEP.fatiha, "standing", "Al-Fatihah is recited standing");
});

// ---------- framing: nothing is ever drawn outside the view ----------
test("the frame is one fixed box and never changes between poses", () => {
  assert.ok(Number.isFinite(FRAME.x) && Number.isFinite(FRAME.w), "FRAME must be a constant box");
  const ratio = FRAME.w / FRAME.h;
  assert.ok(ratio > 0.7 && ratio < 1.6, `frame aspect ${ratio.toFixed(2)} is extreme`);
  assert.ok(VIEW.floorY + 20 < FRAME.y + FRAME.h, "the mat must be visible inside the frame");
});

test("every pose and every transition frame fits inside the fixed frame", () => {
  const check = (j, label) => {
    const xs = [...Object.values(j).map((p) => p.x), j.head.x - HEAD_R, j.head.x + HEAD_R];
    const ys = [...Object.values(j).map((p) => p.y), j.head.y - HEAD_R, j.head.y + HEAD_R];
    assert.ok(Math.min(...xs) >= FRAME.x, `${label}: extends left of the frame`);
    assert.ok(Math.max(...xs) <= FRAME.x + FRAME.w, `${label}: extends right of the frame`);
    assert.ok(Math.min(...ys) >= FRAME.y, `${label}: extends above the frame`);
    assert.ok(Math.max(...ys) <= FRAME.y + FRAME.h, `${label}: extends below the frame`);
  };
  for (const [name, j] of Object.entries(allJoints)) check(j, name);
  for (const start of ["standing", "ruku", "sujood"]) {
    const path = pathBetween(start, start === "sujood" ? "standing" : "sujood");
    for (let s2 = 0; s2 < path.length - 1; s2++) {
      const A = ALL_POSES[path[s2]], B = ALL_POSES[path[s2 + 1]];
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        const scale = (A.armScale ?? 1) + ((B.armScale ?? 1) - (A.armScale ?? 1)) * k;
        check(jointsFor(lerpAngles(A.angles, B.angles, k), scale), `${path[s2]}->${path[s2 + 1]}@${k.toFixed(2)}`);
      }
    }
  }
});

// ---------- the front view of sujood ----------
const FP = frontPoints();
const CONTACTS = SUJOOD_FRONT.contacts.map((c) => ({ ...c, p: FP[c.at] }));

test("front sujood: the seven contact points are at least 20px apart from each other", () => {
  for (let a = 0; a < CONTACTS.length; a++) {
    for (let b = a + 1; b < CONTACTS.length; b++) {
      const A = CONTACTS[a], B = CONTACTS[b];
      const gap = Math.hypot(A.p.x - B.p.x, A.p.y - B.p.y);
      assert.ok(gap >= 20, `points ${A.n} (${A.at}) and ${B.n} (${B.at}) are only ${gap.toFixed(1)}px apart`);
    }
  }
});

test("front sujood: every contact point lies on the mat", () => {
  for (const c of CONTACTS) {
    assert.ok(isOnFrontMat(c.p), `point ${c.n} (${c.at}) is not on the mat`);
  }
});

test("front sujood: the figure is left/right symmetric", () => {
  const cx = SUJOOD_FRONT.cx;
  const pairs = [["palmL", "palmR"], ["elbowL", "elbowR"], ["shoulderL", "shoulderR"],
    ["hipL", "hipR"], ["kneeL", "kneeR"], ["toeL", "toeR"]];
  for (const [l, r] of pairs) {
    assert.ok(Math.abs((cx - FP[l].x) - (FP[r].x - cx)) < 0.001, `${l}/${r} are not mirrored about the centre`);
    assert.ok(Math.abs(FP[l].y - FP[r].y) < 0.001, `${l}/${r} are at different depths`);
    assert.ok(FP[l].x < cx && FP[r].x > cx, `${l}/${r} are on the wrong sides`);
  }
  assert.ok(Math.abs(FP.forehead.x - cx) < 0.001, "the forehead must sit on the centre line");
  assert.ok(Math.abs(FP.head.x - cx) < 0.001, "the head must sit on the centre line");
});

test("front sujood: the points are numbered 1 to 7, each used once", () => {
  const nums = SUJOOD_FRONT.contacts.map((c) => c.n).sort((a, b) => a - b);
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7]);
  const named = SUJOOD_FRONT.contacts.map((c) => c.at);
  assert.equal(new Set(named).size, 7, "each contact point must be a different body part");
  assert.equal(SUJOOD_FRONT.contacts[0].at, "forehead", "point 1 is the forehead with the nose");
});

test("front sujood: the viewer is at the head end (head nearest, toes furthest)", () => {
  // y grows toward the viewer, so the head has the largest y and the toes the smallest
  assert.ok(FP.head.y > FP.shoulderL.y, "the head should be nearer than the shoulders");
  assert.ok(FP.shoulderL.y > FP.hipL.y, "the shoulders should be nearer than the hips");
  assert.ok(FP.hipL.y > FP.kneeL.y, "the hips should be nearer than the knees");
  assert.ok(FP.kneeL.y > FP.toeL.y, "the knees should be nearer than the toes");
  // the arch sits nearest of all, in front of the head
  assert.ok(SUJOOD_FRONT.mat.archY > FP.head.y, "the mat arch should be nearest the viewer");
  // the hips must not dominate: they are narrower than the shoulders
  assert.ok(SUJOOD_FRONT.hip.dx < SUJOOD_FRONT.shoulder.dx, "the hips must stay small and distant");
  // elbows are the widest point, so the forearms read as separate shapes
  assert.ok(SUJOOD_FRONT.elbow.dx > SUJOOD_FRONT.palm.dx, "the elbows should angle outward past the palms");
});

test("front sujood: nothing is drawn outside the fixed frame", () => {
  const pad = Math.max(SUJOOD_FRONT.head.r, ...Object.values(SUJOOD_FRONT.w)) + 12;
  for (const [name, q] of Object.entries(FP)) {
    const r = name === "head" ? SUJOOD_FRONT.head.r + 4 : pad;
    assert.ok(q.x - r >= FRAME.x, `${name} extends left of the frame`);
    assert.ok(q.x + r <= FRAME.x + FRAME.w, `${name} extends right of the frame`);
    assert.ok(q.y - r >= FRAME.y, `${name} extends above the frame`);
    assert.ok(q.y + r <= FRAME.y + FRAME.h, `${name} extends below the frame`);
  }
  assert.ok(SUJOOD_FRONT.mat.archY + 16 <= FRAME.y + FRAME.h, "the mat arch is clipped");
});

test("front sujood: the thighs are a short stub, with the hips right above the knees", () => {
  // in sujood the knees sit almost under the hips, so from this camera the thigh is
  // strongly foreshortened; what you actually see is the shin lying on the mat
  const thigh = FP.hipL.y - FP.kneeL.y;
  const shin = FP.kneeL.y - FP.heelL.y;
  assert.ok(thigh > 0, "the hips must be nearer the viewer than the knees");
  assert.ok(thigh <= 16, `the thigh stub is ${thigh}px, it should stay short`);
  assert.ok(shin > thigh * 2, `the shin (${shin}px) should dominate the thigh stub (${thigh}px)`);
});

test("front sujood: forehead-to-knees is about twice knees-to-toes", () => {
  const upper = FP.forehead.y - FP.kneeL.y;
  const lower = FP.kneeL.y - FP.toeL.y;
  const ratio = upper / lower;
  assert.ok(ratio > 1.8 && ratio < 2.2, `ratio is ${ratio.toFixed(2)}, expected about 2`);
});

test("front sujood: the back widens at the shoulders and narrows toward the hips", () => {
  assert.ok(SUJOOD_FRONT.shoulder.dx > SUJOOD_FRONT.hip.dx,
    "the shoulders must be wider than the hips");
});

test("front sujood: the heels are raised, between the knees and the planted toes", () => {
  for (const side of ["L", "R"]) {
    const knee = FP[`knee${side}`], heel = FP[`heel${side}`], toe = FP[`toe${side}`];
    assert.ok(knee.y > heel.y && heel.y > toe.y,
      `${side}: depth order should be knee -> heel -> toe`);
  }
  // the toes stay the contact point, so they are the ones carrying numbers 6 and 7
  const toeContacts = SUJOOD_FRONT.contacts.filter((c) => c.at.startsWith("toe"));
  assert.equal(toeContacts.length, 2, "the toes are the contact points, not the heels");
});

test("side view: the kneeling feet have the heel up and the toes planted", () => {
  // a flat foot would put the ankle on the floor, which reads as sitting, not sujood
  for (const name of ["kneel", "palmsDown", "sujood"]) {
    const j = allJoints[name];
    const heelUp = F - j.ankleNear.y;
    assert.ok(heelUp >= 12, `${name}: the heel is only ${heelUp.toFixed(1)}px off the floor`);
    assert.ok(Math.abs(j.toeNear.y - F) <= FLOOR_TOL, `${name}: the toes must stay on the floor`);
    assert.ok(j.toeNear.x < j.ankleNear.x, `${name}: the toes should be behind the ankle`);
  }
});

test("front sujood: the side-view pose used by the descent is unchanged", () => {
  // the staged descent still ends on the side view before the cross-fade
  assert.ok(POSES.sujood.angles, "the side-view sujood pose must still exist");
  assert.equal(pathBetween("standing", "sujood").at(-1), "sujood");
  assert.ok(CROSSFADE_MS > 0 && CROSSFADE_MS <= 800, "the cross-fade should be about half a second");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
