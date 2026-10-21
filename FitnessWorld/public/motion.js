/* FitnessWorld motion library. Pure data and functions (no DOM, no three.js).
   A posture sets the body position (floor, plank, bench, bar, seat...).
   A movement pattern animates joint channels between two keyframes A and B.
   Keys: "k" absolute pair [a, b]; "dk" pair is added to the posture's base value.
   Catalog: every exercise variation in the plans library maps to a posture, a pattern and muscle groups. */
(function () {
  "use strict";
  var D = Math.PI / 180;
  var DEF = { sh: 0, shz: 9, el: 10, hip: 0, hz: 0, kn: 0, sp: 0, yaw: 0, lean: 0, roll: 0, ro: 0, ank: 0 };

  function plank(h, f) {
    h = +h || 0; f = +f || 0;
    var a = Math.asin(Math.max(-0.95, Math.min(0.95, (h + 0.55 - f) / 1.46))) / D;
    var pitch = 90 - a;
    var props = [];
    if (h > 0) props.push({ name: "bench", at: "hands", h: h });
    else if (f > 0) props.push({ name: "box", at: "feet", h: f });
    return { pitch: pitch, roll: 0, anchor: "wrists", at: h, base: { sh: pitch, el: 0, shz: 8 }, props: props };
  }

  /* Postures: pitch and roll of the body, grounding anchor, base joint angles, props */
  function posture(key) {
    var p = String(key).split(":"), k = p[0], a = p.slice(1);
    switch (k) {
      case "stand": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: {}, props: [] };
      case "plank": return plank(a[0], a[1]);
      case "quad": return { pitch: 90, roll: 0, anchor: "min", at: 0, base: { sh: 90, hip: 90, kn: 90, el: 0, shz: 8 }, props: [] };
      case "prone": return { pitch: 90, roll: 0, anchor: "min", at: 0, base: { sh: 0, el: 8, shz: 10 }, props: [] };
      case "supine": {
        var h = +a[0] || 0;
        return { pitch: -90, roll: 0, anchor: "min", at: h, base: { sh: 0, el: 8, shz: 12 }, props: h > 0 ? [{ name: "bench", at: "pelvis", h: h }] : [] };
      }
      case "table": return { pitch: -90, roll: 0, anchor: "min", at: 0, base: { sh: 85, el: 0, shz: 10 }, props: [{ name: "bar", at: "hands" }] };
      case "hang": return { pitch: 0, roll: 0, anchor: "wrists", at: 2.25, clamp: false, base: { sh: 178, el: 0, shz: 12 }, props: [{ name: "bar", at: "hands", h: 2.25 }] };
      case "seat": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: { sh: 15, el: 25, hip: 88, kn: 88, shz: 8, sp: 4 }, props: [{ name: "seat", at: "pelvis", h: 0.46 }] };
      case "legpress": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: { sh: 15, el: 25, hip: 84, kn: 88, shz: 8, sp: -28 }, props: [{ name: "seat", at: "pelvis", h: 0.46 }] };
      case "preacher": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: { sh: 55, el: 0, hip: 88, kn: 88, shz: 6, sp: 16 }, props: [{ name: "seat", at: "pelvis", h: 0.46 }] };
      case "wall": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: { sh: 0, el: 12, hip: 88, kn: 88, shz: 8 }, props: [{ name: "wall", at: "pelvis" }] };
      case "bent": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: { sp: 75, sh: 75, el: 5, hip: 15, kn: 15, shz: 8 }, props: [] };
      case "bench": return { pitch: -90, roll: 0, anchor: "min", at: 0.45, base: { sh: 0, shz: 50, el: 90 }, props: [{ name: "bench", at: "pelvis", h: 0.45 }] };
      case "inclinebench": return { pitch: -62, roll: 0, anchor: "min", at: 0.45, base: { sh: 0, shz: 45, el: 90 }, props: [{ name: "bench", at: "pelvis", h: 0.45 }] };
      case "side": return { pitch: 0, roll: 90, anchor: "min", at: 0, base: { shzR: 90, shzL: 90, el: 0, kn: 0 }, props: [] };
      case "dips": return { pitch: 0, roll: 0, anchor: "wrists", at: 1.05, base: { sh: 0, el: 0, shz: 12, hip: 12, kn: 55, sp: 8 }, props: [{ name: "bar", at: "hands" }] };
      case "chair": return { pitch: 0, roll: 0, anchor: "wrists", at: 0.46, base: { sh: 0, el: 0, shz: 10, hip: 55, kn: 75, sp: 10 }, props: [{ name: "box", at: "hands", h: 0.46 }] };
      case "kneel": return { pitch: 0, roll: 0, anchor: "min", at: 0, base: { sh: 110, el: 35, hip: 0, kn: 90, shz: 10, sp: 0 }, props: [] };
      case "pike": return { pitch: 50, roll: 0, anchor: "wrists", at: 0, base: { sh: 110, sp: 60, el: 0, shz: 8 }, props: [] };
      case "lsit": return { pitch: 0, roll: 0, anchor: "wrists", at: 1.05, base: { sh: 0, el: 0, shz: 8, hip: 88, kn: 0 }, props: [] };
      default: throw new Error("Unknown posture " + key);
    }
  }

  /* Movement patterns. T = seconds for one full repetition (A to B and back). */
  var MOVES = {
    hold: { T: 4, p: {} },
    pushup: { T: 2.6, p: { dsh: [0, -38], el: [0, 42], dlean: [0, 12] } },
    pushupSlow: { T: 5, p: { dsh: [0, -38], el: [0, 42], dlean: [0, 12] } },
    pushupWide: { T: 2.6, p: { dsh: [0, -38], el: [0, 42], dlean: [0, 12], shz: [26, 26] } },
    pushupClose: { T: 2.6, p: { dsh: [0, -28], el: [0, 55], dlean: [0, 12], shz: [0, 0] } },
    pike: { T: 2.8, p: { el: [0, 55], dsp: [0, 10], dsh: [0, 10] } },
    toPike: { T: 3, p: { dlean: [0, -17], dsp: [0, 60], dsh: [0, 43] } },
    fly: { T: 3, p: { shz: [28, 80], el: [18, 18] } },
    floorPress: { T: 2.8, p: { shz: [55, 15], el: [92, 2], sh: [0, 78] } },
    benchPress: { T: 2.8, p: { shz: [50, 10], el: [90, 0], sh: [0, 88] } },
    inclinePress: { T: 2.8, p: { shz: [45, 10], el: [90, 0], sh: [0, 80] } },
    cableX: { T: 3, p: { sh: [0, 50], shz: [48, 12], el: [18, 18] } },
    pecDeck: { T: 3, p: { shz: [70, 12], el: [70, 70], sh: [40, 40] } },
    dip: { T: 2.6, p: { el: [0, 90], dsh: [0, -20], sp: [8, 22] } },
    chairDip: { T: 2.6, p: { el: [0, 90], dsh: [0, -20], dhip: [0, 0] } },
    bentRow: { T: 2.6, p: { dsh: [0, -90], el: [0, 90] } },
    bentRowLeft: { T: 2.6, p: { dshL: [0, -90], elL: [0, 90] } },
    seatRow: { T: 2.8, p: { sh: [85, 30], el: [5, 95] } },
    pulldown: { T: 2.8, p: { sh: [165, 40], el: [5, 110], sp: [0, -10] } },
    pullup: { T: 3, p: { sh: [178, 15], el: [0, 125] } },
    invRow: { T: 2.8, p: { el: [0, 85] } },
    pullover: { T: 3, p: { sh: [90, 165], el: [5, 5] } },
    superman: { T: 3, p: { sh: [0, 170], hip: [0, -14], sp: [0, -10] } },
    yRaise: { T: 3, p: { sh: [0, 150], shz: [35, 35] } },
    snowAngel: { T: 3.4, p: { sh: [0, 175], shz: [30, 30] } },
    tableRow: { T: 3, p: { el: [0, 80] } },
    scapPull: { T: 2.4, p: { sh: [178, 170], el: [0, 18] } },
    press: { T: 2.8, p: { sh: [80, 172], el: [90, 2], shz: [28, 12] } },
    pressTight: { T: 2.8, p: { sh: [80, 172], el: [90, 2], shz: [18, 8] } },
    lateral: { T: 2.6, p: { shz: [8, 88], el: [5, 5] } },
    front: { T: 2.6, p: { sh: [0, 88], el: [5, 5], shz: [5, 5] } },
    rearFly: { T: 2.6, p: { shz: [8, 85], el: [5, 5] } },
    faceFull: { T: 2.8, p: { sh: [88, 88], el: [10, 95] } },
    curl: { T: 2.6, p: { el: [0, 130] } },
    curlSlow: { T: 5, p: { el: [0, 130] } },
    curlBack: { T: 2.6, p: { el: [0, 120] } },
    dipTri: { T: 2.6, p: { el: [0, 90], dsh: [0, -20] } },
    overhead: { T: 2.8, p: { sh: [168, 168], el: [145, 5], shz: [12, 12] } },
    kickback: { T: 2.6, p: { el: [90, 0] } },
    pushdown: { T: 2.6, p: { el: [90, 5], sh: [5, 5] } },
    skull: { T: 2.8, p: { el: [0, 80] } },
    squat: { T: 3, p: { hip: [0, 88], kn: [0, 112], sp: [0, 30], sh: [0, 80], el: [10, 10] } },
    gobletSquat: { T: 3, p: { hip: [0, 88], kn: [0, 112], sp: [0, 32], sh: [75, 75], el: [15, 15] } },
    jumpSquat: { T: 1.6, p: { hip: [0, 88], kn: [0, 112], sp: [0, 28], sh: [0, 160], ro: [0.22, 0] } },
    lunge: { T: 3, p: { hipR: [0, 72], knR: [0, 92], hipL: [0, -22], knL: [0, 95] } },
    lungeAlt: { kind: "alt", T: 3.4, p: { hipL: [0, 72], knL: [0, 92], hipR: [0, -22], knR: [0, 95] } },
    splitSquat: { T: 3, p: { hipR: [0, 62], knR: [0, 98], hipL: [-30, -30], knL: [18, 18] } },
    stepUp: { T: 2.6, p: { hipL: [0, 88], knL: [0, 98], sh: [0, 0] } },
    calf: { T: 2.2, p: { ank: [0, 36] } },
    cossack: { T: 3.2, p: { hz: [0, 26], kn: [0, 18], hip: [0, 22] } },
    legPress: { T: 2.8, p: { kn: [88, 14] } },
    legExt: { T: 2.6, p: { kn: [95, 5] } },
    legCurl: { T: 2.6, p: { kn: [0, 105] } },
    bridge: { T: 2.8, p: { sp: [0, -28], kn: [88, 88], hip: [60, 60] } },
    bridgeOne: { T: 3, p: { sp: [0, -26], hipR: [0, 0], knR: [0, 0], hipL: [60, 60], knL: [88, 88] } },
    thrust: { T: 2.8, p: { sp: [-6, -34], kn: [88, 88], hip: [62, 62] } },
    rdl: { T: 3, p: { sp: [5, 72], kn: [15, 20], sh: [0, 0] } },
    kickDonkey: { T: 2.6, p: { hipR: [90, 25], knR: [90, 40] } },
    hydrant: { T: 2.6, p: { hzR: [0, 50] } },
    abduct: { T: 2.8, p: { hz: [5, 35] } },
    cableKick: { T: 2.8, p: { hipL: [0, -40], knL: [0, 0] } },
    legRaise: { T: 3, p: { hip: [0, 88], kn: [0, 6] } },
    legRaiseHang: { T: 3, p: { hip: [0, 90], kn: [0, 5] } },
    deadbug: { T: 3, p: { shL: [90, 165], elL: [0, 0], hipR: [90, 20], knR: [90, 8] } },
    birdDog: { T: 3, p: { shL: [90, 180], hipR: [90, 0], knR: [90, 0] } },
    bicycle: { kind: "alt", T: 2.2, p: { sp: [10, 28], yaw: [-22, 22], hipL: [85, 32], knL: [80, 40], hipR: [85, 42], knR: [80, 40] } },
    crunchKneel: { T: 2.8, p: { sp: [0, 45], sh: [120, 120], el: [40, 40] } },
    rollout: { T: 3.2, p: { sh: [90, 170], el: [0, 0], dlean: [0, 18] } },
    lsitHold: { T: 4, p: {} },
    jacks: { T: 0.9, p: { sh: [0, 170], shz: [9, 35], hz: [0, 18], ro: [0, 0.1] } },
    highKnees: { kind: "alt", T: 0.9, p: { hipL: [0, 82], knL: [0, 18], shL: [45, -25], shR: [-25, 45], elL: [90, 90], elR: [90, 90] } },
    jog: { kind: "alt", T: 1.0, p: { hipL: [0, 26], knL: [0, 28], shL: [-18, 24], shR: [24, -18], elL: [80, 80], elR: [80, 80] } },
    skater: { kind: "alt", T: 1.1, p: { hzL: [4, 22], hzR: [4, 22], sp: [12, 20], ro: [0, 0.05] } },
    climbers: { kind: "alt", T: 1.0, p: { hipL: [0, 30], knL: [0, 70], hipR: [0, 30], knR: [0, 70] } },
    cardioRow: { T: 2.8, p: { kn: [90, 25], sp: [15, -10], sh: [60, 20], el: [5, 100] } },
    cardioBike: { kind: "alt", T: 1.6, p: { hipL: [65, 80], knL: [90, 30], hipR: [80, 65], knR: [30, 90] } },
    cardioCross: { kind: "alt", T: 1.2, p: { hipL: [10, 40], knL: [5, 25], hipR: [40, 10], knR: [25, 5], shL: [30, -20], shR: [-20, 30], elL: [70, 70], elR: [70, 70] } }
  };

  function tri(p) { return 1 - Math.abs(2 * p - 1); }
  function ease(w) { return 0.5 - 0.5 * Math.cos(Math.PI * w); }

  /* Resolve the channel values for one exercise at time t (seconds). Returns degrees, metres. */
  function channels(post, move, t) {
    var T = move.T || 2.6;
    var p = ((t / T) % 1 + 1) % 1;
    var P = move.p || {}, base = post.base || {};
    var out = {};
    var SIDE = ["sh", "shz", "el", "hip", "hz", "kn", "ank"];
    function baseOf(k) {
      if (base[k] !== undefined) return base[k];
      if (DEF[k] !== undefined) return DEF[k];
      return 0;
    }
    function value(K, side) {
      var key = side ? K + side : K;
      var bv = base[key] !== undefined ? base[key] : baseOf(K);
      var pr = P[key] || P[K];
      var dpr = P["d" + key] || P["d" + K];
      if (!pr && !dpr) return bv;
      var a, b;
      if (pr) { a = pr[0]; b = pr[1]; }
      else { a = bv + dpr[0]; b = bv + dpr[1]; }
      var phase = p;
      if (move.kind === "alt" && side === "R") phase = (p + 0.5) % 1;
      var w = ease(tri(phase));
      return a + (b - a) * w;
    }
    /* channel set: side keys for limbs, generic for trunk and root */
    SIDE.forEach(function (K) {
      if (K === "ank") { out.ankL = value(K, "L"); out.ankR = value(K, "R"); return; }
      out[K + "L"] = value(K, "L");
      out[K + "R"] = value(K, "R");
    });
    ["sp", "yaw", "lean", "roll", "ro"].forEach(function (K) { out[K] = value(K, ""); });
    /* breathing: a slow chest rise on every posture */
    var t2 = t || 0;
    out.sp += 0.9 * Math.sin((2 * Math.PI * t2) / 3.8);
    return out;
  }

  /* ---------- catalog: every variation in the plans library ----------
     [name, posture, pattern, muscle groups, extra (optional): {T, base, dir}] */
  var CATALOG = [
    /* chest */
    ["Push-up", "plank:0:0", "pushup", ["chest", "triceps", "shoulders"]],
    ["Incline push-up", "plank:0.5:0", "pushup", ["chest", "triceps", "shoulders"]],
    ["Decline push-up", "plank:0:0.4", "pushup", ["chest", "shoulders", "triceps"]],
    ["Wide push-up", "plank:0:0", "pushupWide", ["chest", "shoulders"]],
    ["Close-grip push-up", "plank:0:0", "pushupClose", ["triceps", "chest"]],
    ["Dumbbell floor press", "supine", "floorPress", ["chest", "triceps"]],
    ["Dumbbell fly (floor)", "supine", "fly", ["chest"]],
    ["Slow push-up", "plank:0:0", "pushupSlow", ["chest", "triceps"]],
    ["Barbell bench press", "bench", "benchPress", ["chest", "triceps", "shoulders"]],
    ["Incline dumbbell press", "inclinebench", "inclinePress", ["chest", "shoulders"]],
    ["Machine chest press", "seat", "press", ["chest", "triceps"]],
    ["Cable crossover", "stand", "cableX", ["chest"]],
    ["Pec deck fly", "seat", "pecDeck", ["chest"]],
    ["Parallel bar dips", "dips", "dip", ["chest", "triceps"]],
    /* back */
    ["Bent-over row", "bent", "bentRow", ["back", "biceps"]],
    ["Single-arm row", "bent", "bentRowLeft", ["back", "biceps"]],
    ["Table row", "table", "tableRow", ["back", "biceps"]],
    ["Superman", "prone", "superman", ["back", "glutes"]],
    ["Reverse snow angel", "prone", "snowAngel", ["back", "shoulders"]],
    ["Dumbbell pullover", "supine", "pullover", ["back", "chest"]],
    ["Prone Y raise", "prone", "yRaise", ["back", "shoulders"]],
    ["Lat pulldown", "seat", "pulldown", ["back", "biceps"]],
    ["Seated cable row", "seat", "seatRow", ["back", "biceps"]],
    ["Barbell row", "bent", "bentRow", ["back", "biceps"]],
    ["Machine row", "seat", "seatRow", ["back", "biceps"]],
    ["Pull-up", "hang", "pullup", ["back", "biceps"]],
    ["Chin-up", "hang", "pullup", ["biceps", "back"]],
    ["Inverted row", "table", "invRow", ["back", "biceps"]],
    ["Scapular pull-up", "hang", "scapPull", ["back"]],
    ["Door row", "bent", "seatRow", ["back", "biceps"], { base: { sp: -22, sh: 60 } }],
    /* shoulders */
    ["Pike push-up", "pike", "pike", ["shoulders", "triceps"]],
    ["Dumbbell shoulder press", "stand", "press", ["shoulders", "triceps"]],
    ["Lateral raise", "stand", "lateral", ["shoulders"]],
    ["Front raise", "stand", "front", ["shoulders"]],
    ["Rear-delt fly", "bent", "rearFly", ["shoulders", "back"]],
    ["Arnold press", "stand", "press", ["shoulders", "triceps"]],
    ["Barbell overhead press", "stand", "pressTight", ["shoulders", "triceps"]],
    ["Machine shoulder press", "seat", "press", ["shoulders", "triceps"]],
    ["Cable lateral raise", "stand", "lateral", ["shoulders"]],
    ["Face pull", "stand", "faceFull", ["shoulders", "back"]],
    ["Elevated pike push-up", "pike", "pike", ["shoulders", "triceps"]],
    ["Plank to pike", "plank:0:0", "toPike", ["shoulders", "core"]],
    /* biceps */
    ["Dumbbell curl", "stand", "curl", ["biceps"]],
    ["Hammer curl", "stand", "curl", ["biceps"]],
    ["Concentration curl", "seat", "curl", ["biceps"], { base: { sp: 20, sh: 8 } }],
    ["Backpack curl", "stand", "curlBack", ["biceps"]],
    ["Slow curl", "stand", "curlSlow", ["biceps"]],
    ["Barbell curl", "stand", "curl", ["biceps"]],
    ["Cable curl", "stand", "curl", ["biceps"]],
    ["Preacher curl machine", "preacher", "curl", ["biceps"]],
    ["Underhand inverted row", "table", "invRow", ["biceps", "back"]],
    ["Towel curl (resisted)", "stand", "curlBack", ["biceps"]],
    ["Backpack hammer curl", "stand", "curl", ["biceps"]],
    /* triceps */
    ["Chair dips", "chair", "chairDip", ["triceps", "chest"]],
    ["Overhead extension", "stand", "overhead", ["triceps"]],
    ["Kickback", "bent", "kickback", ["triceps"], { base: { sh: -15 } }],
    ["Bench dip, feet up", "chair", "chairDip", ["triceps"], { base: { kn: 20 } }],
    ["Triangle push-up", "plank:0:0", "pushupClose", ["triceps"]],
    ["Cable pushdown", "stand", "pushdown", ["triceps"]],
    ["Skull crusher", "supine", "skull", ["triceps"], { base: { sh: 90, el: 0 } }],
    ["Close-grip bench press", "bench", "benchPress", ["triceps", "chest"], { base: { shz: 14 } }],
    ["Bar dips (triceps focus)", "dips", "dipTri", ["triceps"]],
    /* legs */
    ["Bodyweight squat", "stand", "squat", ["quads", "glutes", "hams"]],
    ["Goblet squat", "stand", "gobletSquat", ["quads", "glutes", "hams"]],
    ["Reverse lunge", "stand", "lunge", ["quads", "glutes"]],
    ["Walking lunge", "stand", "lungeAlt", ["quads", "glutes"]],
    ["Bulgarian split squat", "stand", "splitSquat", ["quads", "glutes"]],
    ["Step-up", "stand", "stepUp", ["quads", "glutes"], { props: [{ name: "box", at: "feet", h: 0.4 }] }],
    ["Wall sit", "wall", "hold", ["quads"]],
    ["Calf raise", "stand", "calf", ["calves"]],
    ["Barbell back squat", "stand", "squat", ["quads", "glutes", "hams"]],
    ["Leg press", "legpress", "legPress", ["quads", "glutes"]],
    ["Leg extension", "seat", "legExt", ["quads"]],
    ["Leg curl", "prone", "legCurl", ["hams"]],
    ["Jump squat", "stand", "jumpSquat", ["quads", "glutes", "calves"]],
    ["Cossack squat", "stand", "cossack", ["quads", "glutes"]],
    ["Pistol squat (assisted)", "stand", "squat", ["quads", "glutes"]],
    /* glutes */
    ["Glute bridge", "supine", "bridge", ["glutes", "hams"]],
    ["Single-leg bridge", "supine", "bridgeOne", ["glutes", "hams"]],
    ["Romanian deadlift", "stand", "rdl", ["hams", "glutes", "back"]],
    ["Hip thrust", "supine:0.42", "thrust", ["glutes", "hams"]],
    ["Donkey kick", "quad", "kickDonkey", ["glutes"]],
    ["Fire hydrant", "quad", "hydrant", ["glutes"]],
    ["Barbell hip thrust", "supine:0.42", "thrust", ["glutes", "hams"]],
    ["Cable kickback", "stand", "cableKick", ["glutes"]],
    ["Hip abduction machine", "seat", "abduct", ["glutes"]],
    /* core */
    ["Plank", "plank:0:0", "hold", ["core", "shoulders"]],
    ["Side plank", "side", "hold", ["core"]],
    ["Dead bug", "supine", "deadbug", ["core"]],
    ["Bird dog", "quad", "birdDog", ["core", "glutes", "back"]],
    ["Bicycle crunch", "supine", "bicycle", ["core"]],
    ["Leg raise", "supine", "legRaise", ["core"]],
    ["Hanging leg raise", "hang", "legRaiseHang", ["core"]],
    ["L-sit hold", "lsit", "lsitHold", ["core", "triceps"]],
    ["Cable crunch", "kneel", "crunchKneel", ["core"]],
    ["Ab wheel rollout", "quad", "rollout", ["core", "shoulders"]],
    /* cardio */
    ["Jumping jacks", "stand", "jacks", ["quads", "calves", "shoulders"]],
    ["High knees", "stand", "highKnees", ["quads", "core", "calves"]],
    ["Brisk walk or jog", "stand", "jog", ["quads", "calves", "core"]],
    ["Skater jumps", "stand", "skater", ["quads", "glutes", "calves"]],
    ["Mountain climbers", "plank:0:0", "climbers", ["core", "shoulders", "quads"]],
    ["Treadmill intervals", "stand", "jog", ["quads", "calves"]],
    ["Rowing machine", "seat", "cardioRow", ["back", "quads", "biceps"]],
    ["Stationary bike", "seat", "cardioBike", ["quads", "calves"], { base: { sh: 40, el: 20, sp: 10 } }],
    ["Cross-trainer", "stand", "cardioCross", ["quads", "shoulders", "glutes"]]
  ];

  var BY_NAME = {};
  CATALOG.forEach(function (c) { BY_NAME[c[0]] = c; });

  /* Build the complete pose for an exercise at time t. Returns { post, ch, move, muscles, props } */
  function pose(name, t) {
    var c = BY_NAME[name];
    if (!c) return null;
    var extra = c[4] || {};
    var post = posture(c[1]);
    if (extra.base) {
      var nb = {};
      Object.keys(post.base).forEach(function (k) { nb[k] = post.base[k]; });
      Object.keys(extra.base).forEach(function (k) { nb[k] = extra.base[k]; });
      post = { pitch: post.pitch, roll: post.roll, anchor: post.anchor, at: post.at, base: nb, props: extra.props || post.props };
    } else if (extra.props) {
      post = { pitch: post.pitch, roll: post.roll, anchor: post.anchor, at: post.at, base: post.base, props: extra.props };
    }
    var move = MOVES[c[2]];
    if (!move) throw new Error("Unknown pattern " + c[2]);
    return { post: post, ch: channels(post, move, t), move: c[2], muscles: c[3], props: post.props };
  }

  window.FWMotion = {
    CATALOG: CATALOG,
    MOVES: MOVES,
    posture: posture,
    channels: channels,
    pose: pose,
    names: function () { return CATALOG.map(function (c) { return c[0]; }); },
    muscles: function (name) { return (BY_NAME[name] || [])[3] || []; },
    has: function (name) { return !!BY_NAME[name]; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = window.FWMotion;
})();
