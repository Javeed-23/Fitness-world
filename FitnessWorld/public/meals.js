/* FitnessWorld meal plan, its own tab. Targets come from your body numbers (sex, age, height, weight, body fat %) and your goal,
   with 4 progressive weeks like the workout plan. Loads after plans.js and before progress.js. */
(() => {
  const P = window.FWP; if (!P) return;
  const E = P.E, goal = P.goal, GN = P.GN;
  const MENU = {"veg":[["Vegetable poha, curd and a fruit","2 rotis, dal, mixed sabzi and salad","Roasted chana and an apple","Paneer bhurji, 2 rotis and vegetables"],["Oats with milk, nuts and a banana","Rice, rajma or chole, cucumber salad","Sprouts chaat","Tofu or soya chunk curry, 2 rotis and salad"],["2 besan chillas with mint chutney and curd","Vegetable pulao, raita and dal","A handful of nuts with a fruit","Palak paneer, 2 rotis and a bowl of soup"],["Vegetable upma with curd and a fruit","2 rotis, moong dal, bhindi sabzi and salad","Curd or Greek yogurt with seeds","Mixed dal khichdi with vegetables and curd"]],"non":[["2–3 egg omelette, toast and a fruit","Rice or 2 rotis, chicken curry and salad","2 boiled eggs and a fruit","Grilled chicken, vegetables and 1–2 rotis"],["Oats with milk, nuts and a boiled egg","Rice, fish curry and vegetables","Greek yogurt with nuts","Egg bhurji, 2 rotis and salad"],["Vegetable egg scramble with toast","Chicken pulao, raita and salad","Roasted chana or nuts with a fruit","Fish or chicken tikka, vegetables and 1 roti"],["1 egg paratha with curd","2 rotis, dal, egg or chicken curry and salad","Sprouts or boiled eggs","Chicken stew with vegetables and a small portion of rice"]]};
  const ACT = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
  const ACT_LABEL = { sedentary: "Mostly sitting", light: "Light (1–3 days a week)", moderate: "Moderate (3–5 days a week)", high: "Very active (6–7 days a week)" };
  const SLOTS = [["Breakfast", 0.25], ["Lunch", 0.3], ["Snack", 0.15], ["Dinner", 0.3]];
  /* per goal: calorie change vs maintenance, protein per kg, weekly calorie step, notes for weeks 1–4 */
  const GOAL = {
    lose:   { delta: -500, prot: 2.0, step: [0, 0, 0, 150], notes: ["Steady deficit to lose fat while keeping muscle.", "Steady deficit, same plan.", "Steady deficit, same plan.", "Diet break: a few extra calories so the plan stays sustainable."] },
    build:  { delta: 300, prot: 1.8, step: [0, 50, 100, -100], notes: ["Surplus to build muscle.", "Calories rise a little for progression.", "Calories rise again with the training load.", "Lighter week (−100 kcal) to recover."] },
    fit:    { delta: 0, prot: 1.4, step: [0, 0, 0, 0], notes: ["Maintenance to stay fit.", "Maintenance, same plan.", "Maintenance, same plan.", "Maintenance, same plan."] },
    endure: { delta: 100, prot: 1.5, step: [0, 50, 100, 0], notes: ["Fuel for endurance training.", "Fuel rises with the training load.", "Fuel rises again for the hardest weeks.", "Recovery week at your base intake."] }
  };
  const TARGET_KG_WEEK = { lose: -0.5, build: 0.25, fit: 0, endure: 0 };

  /* ---------- body numbers ---------- */
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const meas = () => data.measurements.slice().sort(byDate);
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const CAT = { male: [[6, "Essential fat"], [14, "Athletic"], [18, "Fit"], [25, "Average"], [100, "Above average"]], female: [[14, "Essential fat"], [21, "Athletic"], [25, "Fit"], [32, "Average"], [100, "Above average"]] };
  const category = (sex, pct) => CAT[sex === "female" ? "female" : "male"].find(x => pct < x[0])[1];
  /* US Navy method, metric. Uses waist and neck (and hips for women) from your latest measurement. */
  function navy(sex, h, waist, neck, hip) {
    const L = Math.log10; let d;
    if (sex === "female") { if (!hip || waist + hip <= neck) return null; d = 1.29579 - 0.35004 * L(waist + hip - neck) + 0.221 * L(h); }
    else { if (waist <= neck) return null; d = 1.0324 - 0.19077 * L(waist - neck) + 0.15456 * L(h); }
    const v = 495 / d - 450; return v >= 2 && v <= 60 ? v : null;
  }
  function weightNow(b) {
    const w = meas().filter(m => m.weight);
    return w.length ? +w[w.length - 1].weight : (b && b.w ? +b.w : null);
  }
  /* body fat: a value you entered wins; otherwise the Navy estimate from your latest waist and neck measurement */
  function fatInfo(b) {
    if (b && b.fat) return { pct: +b.fat, src: "entered by you" };
    const m = meas().filter(x => x.neck && x.waist).pop();
    if (!m || !b || !b.h || !b.sex) return null;
    const v = navy(b.sex, +b.h, +m.waist, +m.neck, m.hip ? +m.hip : 0);
    return v == null ? null : { pct: +v.toFixed(1), src: "measured " + m.date };
  }

  /* ---------- targets ---------- */
  function targets(b, g, week) {
    const wt = weightNow(b), fi = fatInfo(b), lbm = fi ? wt * (1 - fi.pct / 100) : null;
    const hm = b.h / 100, bmi = wt / (hm * hm);
    /* Katch-McArdle when body fat is known (uses lean mass), otherwise Mifflin-St Jeor */
    const bmr = lbm ? 370 + 21.6 * lbm : 10 * wt + 6.25 * b.h - 5 * b.age + (b.sex === "female" ? -161 : 5);
    const tdee = bmr * (ACT[b.act] || ACT.light);
    const notes = [];
    let delta = GOAL[g].delta;
    const lowFat = !!fi && (b.sex === "female" ? fi.pct < 18 : fi.pct < 10);
    if (g === "lose" && lowFat) { delta = -250; notes.push("Body fat is already low, so the deficit is gentler."); }
    if (g === "lose" && bmi < 18.5) { delta = 0; notes.push("Your BMI is under 18.5, so weight loss is not advised. The plan holds maintenance."); }
    const floor = b.sex === "female" ? 1200 : 1500;
    let base = tdee + delta + (+b.adj || 0);
    if (base < floor) { base = floor; notes.push("Calories were raised to the minimum safe level."); }
    const k = Math.max(floor, Math.round((base + GOAL[g].step[week - 1]) / 10) * 10);
    const p = Math.round(GOAL[g].prot * (g === "lose" && lbm ? lbm : wt));
    const f = Math.round(Math.max(0.6 * wt, k * 0.27 / 9));
    const c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
    return {
      wt, fi, lbm, bmr, tdee, bmi, k, p, f, c, notes, lowFat,
      weekly: (k - tdee) * 7 / 7700,
      formula: lbm ? "Katch-McArdle (uses your body fat %)" : "Mifflin-St Jeor (add body fat % for a sharper estimate)"
    };
  }

  /* ---------- trend check: real weight change against the goal ---------- */
  function trend(g) {
    const M = meas().filter(m => m.weight);
    if (M.length < 2) return null;
    const last = M[M.length - 1];
    const old = M.filter(m => days(m.date, last.date) >= 7).pop();
    if (!old) return null;
    const span = days(old.date, last.date), perWeek = (+last.weight - +old.weight) / (span / 7);
    let change = 0;
    if (g === "lose") { if (perWeek > -0.2) change = -100; else if (perWeek < -1) change = 100; }
    if (g === "build") { if (perWeek < 0.1) change = 100; else if (perWeek > 0.5) change = -100; }
    if (g === "fit") { if (perWeek > 0.5) change = -100; else if (perWeek < -0.5) change = 100; }
    return { perWeek, span, last: last.date, change };
  }

  /* ---------- markup ---------- */
  const wkBtns = (k, cur) => `<div class="fw-btns">${[1, 2, 3, 4].map(n => `<button type="button" class="btn ${n === cur ? "btn-primary" : "btn-secondary"}" data-fwwk="${k}:${n}">Week ${n}</button>`).join("")}</div>`;
  const row = (a, b) => `<div class="fw-row"><span class="muted">${a}</span><strong>${b}</strong></div>`;
  const d1 = n => (Math.round(n * 10) / 10).toFixed(1);
  const num = (n, l, mn, mx, v, extra) => `<label>${l}<input name="${n}" type="number" min="${mn}" max="${mx}" step="any" value="${v == null ? "" : v}" ${extra || ""}></label>`;
  const sel = (n, l, opts, cur) => `<label>${l}<select name="${n}">${opts.map(([v, t]) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;

  function formHTML(b) {
    const wt = weightNow(b);
    return `<form class="card form-card fw-card" id="fwBody"><h2>Your details</h2>
      <p class="muted small">Your meal plan uses these with your measurements. Weight and body fat come from your latest measurement when you have one.</p>
      <div class="form-grid">${sel("sex", "Sex", [["male", "Male"], ["female", "Female"]], b.sex || "male")}${num("age", "Age", 18, 80, b.age, "required")}</div>
      <div class="form-grid">${num("h", "Height (cm)", 120, 230, b.h, "required")}${num("w", "Weight (kg)", 30, 250, wt, "required")}</div>
      <div class="form-grid">${num("fat", "Body fat % (optional)", 3, 60, b.fat || "", 'placeholder="Leave blank to use your measurements"')}${num("waist", "Waist (cm, optional)", 40, 200, b.waist || "")}</div>
      <div class="form-grid">${sel("act", "Daily activity", Object.entries(ACT_LABEL), b.act || "light")}${sel("diet", "Food preference", [["veg", "Vegetarian"], ["non", "Non-vegetarian"]], b.diet || "veg")}</div>
      <p class="notice meal-err" id="fwBodyErr" hidden style="color:var(--danger)"></p>
      <button class="btn btn-primary btn-full" type="submit">Save and update my meal plan</button></form>`;
  }
  function mountForm() {
    const host = $("#fwBodyHost");
    if (!host || host.dataset.ready) return;
    host.dataset.ready = "1";
    host.innerHTML = formHTML(E().body || {});
  }
  document.addEventListener("submit", e => {
    if (e.target.id !== "fwBody") return;
    e.preventDefault();
    const f = e.target.elements, err = $("#fwBodyErr");
    const v = { sex: f.sex.value, age: Number(f.age.value), h: Number(f.h.value), w: Number(f.w.value), act: f.act.value, diet: f.diet.value,
      fat: f.fat.value ? Number(f.fat.value) : null, waist: f.waist.value ? Number(f.waist.value) : null };
    const bad = !(v.age >= 18 && v.age <= 80) ? "Age must be between 18 and 80." :
      !(v.h >= 120 && v.h <= 230) ? "Height must be between 120 and 230 cm." :
      !(v.w >= 30 && v.w <= 250) ? "Weight must be between 30 and 250 kg." :
      (v.fat !== null && !(v.fat >= 3 && v.fat <= 60)) ? "Body fat must be between 3% and 60%." : null;
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    E().body = Object.assign({}, E().body || {}, v);
    save(); toast("Meal plan updated.");
  });
  document.addEventListener("click", e => {
    const t = e.target, b = t.closest && t.closest("[data-fwmealgo],[data-fwtrend]");
    if (!b) return;
    if (b.dataset.fwmealgo) { go("training"); $("[data-tab=fwMeal]").click(); return; }
    const body = Object.assign({}, E().body || {}), tr = trend(goal() || "fit");
    if (b.dataset.fwtrend === "apply" && tr) { body.adj = (+body.adj || 0) + tr.change; body.adjAt = tr.last; E().body = body; save(); toast("Calories updated for your trend."); }
    if (b.dataset.fwtrend === "keep" && tr) { body.adjAt = tr.last; E().body = body; save(); }
  });

  function mealPlan() {
    const out = $("#fwMealOut"); if (!out) return;
    mountForm();
    const g = goal(), b = E().body || {};
    if (!g) { out.innerHTML = `<div class="card form-card fw-card"><h2>Meal plan</h2><p class="muted small">Choose the goal that fits you. You can change it later.</p>${P.goalChooser()}</div>`; return; }
    if (!b.sex || !b.age || !b.h || !weightNow(b)) { out.innerHTML = `<div class="card form-card fw-card"><h2>Meal plan</h2><p class="muted small">Fill in your details above. We use your sex, age, height, weight and body fat to set calories and protein for your goal.</p></div>`; return; }
    const w = P.WK("meal"), t = targets(b, g, w), tr = trend(g);
    const ad = tr && tr.change && (!b.adjAt || b.adjAt < tr.last) ? tr : null;
    out.innerHTML =
      `<div class="card form-card fw-card"><h2>Your 4-week meal plan</h2><p class="muted small">Goal: ${GN[g]}. Calories move with the goal each week, like your workout plan.</p>${wkBtns("meal", w)}<p class="fw-note">Week ${w}: ${GOAL[g].notes[w - 1]}</p></div>` +
      `<div class="card form-card fw-card"><h2>Week ${w} targets</h2>` +
        row("Calories", `${t.k} kcal`) +
        row("Protein / Carbs / Fat", `${t.p} g / ${t.c} g / ${t.f} g`) +
        row("Expected change per week", `${t.weekly > 0 ? "+" : ""}${d1(t.weekly)} kg`) +
        row("Body weight used", `${d1(t.wt)} kg`) +
        row("BMI", d1(t.bmi)) +
        (t.fi ? row("Body fat", `${d1(t.fi.pct)}% (${t.fi.src})`) + row("Category", category(b.sex, t.fi.pct)) : row("Body fat", "Not measured yet")) +
        row("Maintenance (TDEE)", `${Math.round(t.tdee)} kcal`) +
        row("Formula", t.formula) +
        (t.notes.length ? `<p class="fw-note">${t.notes.join(" ")}</p>` : "") +
      `</div>` +
      (ad ? `<div class="card form-card fw-card"><h2>Trend check</h2><p class="muted small">Over ${ad.span} days your weight changed ${ad.perWeek > 0 ? "+" : ""}${d1(ad.perWeek)} kg a week. For your goal, ${ad.change < 0 ? "reduce" : "add"} about ${Math.abs(ad.change)} kcal a day.</p>` +
        `<div class="fw-btns"><button class="btn btn-primary" type="button" data-fwtrend="apply">${ad.change < 0 ? "Reduce" : "Add"} ${Math.abs(ad.change)} kcal</button><button class="btn btn-secondary" type="button" data-fwtrend="keep">Keep as is</button></div></div>` : "") +
      `<div class="card form-card fw-card"><h2>Week ${w} menu (every day)</h2>${SLOTS.map(([n, s], i) =>
        `<div class="exercise-item"><span><strong>${n}</strong><br>${MENU[b.diet || "veg"][w - 1][i]}</span><small>≈ ${Math.round(t.k * s / 10) * 10} kcal · ${Math.round(t.p * s)} g protein</small></div>`).join("")}
        <p class="fw-note">General guidance from standard estimates, not medical advice. Check with a doctor or dietitian if you have a health condition. For adults only.</p></div>`;
  }

  /* exported for progress.js (body fat card) */
  window.FWBody = { fatInfo, weightNow, navy, category, CAT, targets, trend };

  const tabs = $("#page-training .tabs");
  const tb = document.createElement("button");
  tb.className = "tab"; tb.dataset.tab = "fwMeal"; tb.textContent = "Meal plan";
  tabs.appendChild(tb);
  /* tabs created after startup need their own switch (app.js only wires the tabs it finds at load) */
  tb.addEventListener("click", () => {
    $$("#page-training .tab").forEach(x => x.classList.toggle("active", x === tb));
    $$("#page-training .tab-panel").forEach(x => x.classList.toggle("active", x.id === "fwMeal"));
  });
  const pn = document.createElement("div");
  pn.className = "tab-panel"; pn.id = "fwMeal";
  pn.innerHTML = '<div id="fwBodyHost"></div><div id="fwMealOut"></div>';
  $("#page-training").appendChild(pn);
  const _r = renderAll; renderAll = function () { _r(); mealPlan() };
  renderAll();
})();
