/* FitnessWorld progress layer: progress summary, body fat (from the shared body numbers in meals.js), log out buttons. Loads last. */
(() => {
  const E = () => data.extra = data.extra || {};
  const st = document.createElement("style");
  st.textContent = ".fw-pn{margin-bottom:16px}";
  document.head.appendChild(st);

  /* Neck (and hips for women) for the Navy method */
  const form = $("#measurementForm"), grid = form.querySelector(".form-grid");
  grid.insertAdjacentHTML("afterend", '<div class="form-grid"><label>Neck (cm)<input name="neck" type="number" min="10" max="100" step="0.1" placeholder="For body fat %"></label><label id="fwHipL">Hips (cm)<input name="hip" type="number" min="30" max="250" step="0.1" placeholder="Women only"></label></div>');
  let pend = null, len = 0;
  window.addEventListener("submit", e => { if (e.target.id !== "measurementForm") return; const f = e.target.elements; pend = { neck: f.neck.value, hip: f.hip.value }; len = data.measurements.length }, true);
  window.addEventListener("submit", e => {
    if (e.target.id !== "measurementForm" || !pend) return;
    if (data.measurements.length > len) { const m = data.measurements[data.measurements.length - 1]; m.neck = pend.neck; m.hip = pend.hip; save() }
    pend = null;
  });

  const pg = $("#page-progress"), two = pg.querySelector(".two-col");
  const host = document.createElement("div"); host.id = "fwProg";
  two.insertAdjacentElement("beforebegin", host);
  const row = (a, b) => `<div class="fw-row"><span class="muted">${a}</span><strong>${b}</strong></div>`;
  const d1 = n => Math.round(n * 10) / 10, sg = n => (n > 0 ? "+" : "") + d1(n);
  const toMeal = `<button class="btn btn-secondary" type="button" data-fwmealgo="1" style="margin-top:12px">Open Meal plan details</button>`;

  function progress() {
    const b = E().body || {}, M = data.measurements.slice().sort((x, y) => x.date < y.date ? -1 : 1);
    const W = M.filter(m => m.weight), Z = M.filter(m => m.waist);
    $("#fwHipL").hidden = b.sex !== "female";
    const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 6 + i); return d.toISOString().slice(0, 10) });
    const wk7 = data.workouts.filter(w => last7.includes(w.date)).length;

    let bf;
    if (!b.sex || !b.h) bf = '<p class="muted small">Add your sex and height in Meal plan → Your details to see your body fat.</p>' + toMeal;
    else {
      const fi = window.FWBody.fatInfo(b), wt = window.FWBody.weightNow(b);
      if (!fi) bf = '<p class="muted small">Log your waist and neck (hips for women) in the measurement form, or enter your body fat % in Meal plan → Your details.</p>' + toMeal;
      else bf = row("Body fat", `${d1(fi.pct)}%`) + row("Source", fi.src) + row("Category", window.FWBody.category(b.sex, fi.pct)) +
        (wt ? row("Fat mass / lean mass", `${d1(wt * fi.pct / 100)} kg / ${d1(wt - wt * fi.pct / 100)} kg`) : "") +
        `<p class="fw-note">Estimate for information only, not medical advice.</p>`;
    }

    host.innerHTML = `<div class="card form-card fw-pn"><h2>Your progress</h2>` +
      (W.length > 1 ? row("Weight change", `${sg(W[W.length - 1].weight - W[0].weight)} kg (${W[0].weight} → ${W[W.length - 1].weight})`) : row("Weight change", "Log 2 weights to see change")) +
      (Z.length > 1 ? row("Waist change", `${sg(Z[Z.length - 1].waist - Z[0].waist)} cm`) : row("Waist change", "Log 2 waist measurements")) +
      row("Workouts (last 7 days)", wk7) + row("Current streak", esc($("#streakStat").textContent)) + `</div>` +
      `<div class="card form-card fw-pn"><h2>Body fat</h2>${bf}</div>`;
  }

  /* Log out */
  const out = async () => {
    if (window.FW_USER) { try { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) } catch (e) { /* ignore */ } location.replace("/login") }
    else if (window.FW_DEMO_LOGIN) location.href = window.FW_DEMO_LOGIN;
    else toast("There is no login in this standalone page.");
  };
  const sb = $(".sidebar-bottom");
  if (sb && !$("#logoutBtn")) { const b = document.createElement("button"); b.className = "btn btn-quiet btn-full"; b.id = "logoutBtn"; b.textContent = "Log out"; b.addEventListener("click", out); sb.appendChild(b) }
  const set = $("#page-settings .page-intro");
  if (set) {
    const c = document.createElement("div"); c.className = "card form-card fw-pn";
    c.innerHTML = '<h2>Account</h2><p class="muted small">End your session on this device.</p><button class="btn btn-secondary" type="button" id="fwLogout2">Log out</button>';
    set.insertAdjacentElement("afterend", c);
    $("#fwLogout2").addEventListener("click", out);
  }
  const _r = renderAll; renderAll = function () { _r(); progress() }; renderAll();
})();
