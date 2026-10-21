/* FitnessWorld Today tab: today's workout (start, tick, finish), recovery check-in with recent history,
   and the exercise video library below. Loads after groups.js and video.js. */
(() => {
  const P = window.FWP; if (!P) return;
  const E = P.E, tabs = $("#page-training .tabs");
  const mm = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const id = "fwToday", tb = document.createElement("button");
  tb.className = "tab"; tb.dataset.tab = id; tb.textContent = "Today";
  tabs.insertAdjacentElement("afterbegin", tb);
  const pn = document.createElement("div");
  pn.className = "tab-panel"; pn.id = id;
  $("#page-training .tab-panel").insertAdjacentElement("beforebegin", pn);
  tb.addEventListener("click", () => {
    $$("#page-training .tab").forEach(x => x.classList.toggle("active", x === tb));
    $$("#page-training .tab-panel").forEach(x => x.classList.toggle("active", x.id === id));
  });
  pn.innerHTML = '<div id="fwTW"></div><div id="fwRec"></div><div id="fwVid"></div>';

  /* recovery check-in: the form is handled by a delegated listener in app.js, so it can live here */
  $("#fwRec").innerHTML =
    '<form class="card form-card fw-card" id="recoveryForm"><h2>Recovery check-in</h2>' +
    '<p class="muted">This is a wellness log, not a diagnosis. Stop an exercise that causes pain.</p>' +
    '<div class="form-grid"><label>How do you feel?<select name="feeling"><option>Normal</option><option>Muscle soreness</option><option>Fatigued</option><option>Joint pain</option><option>Injury concern</option></select></label>' +
    '<label>Severity<select name="severity"><option>Mild</option><option>Moderate</option><option>Severe</option></select></label></div>' +
    '<label>Notes<textarea name="notes" rows="3" placeholder="What happened and where?"></textarea></label>' +
    '<button class="btn btn-primary" type="submit">Save check-in</button><div id="recoveryNotice" class="notice hidden"></div></form>' +
    '<div class="card form-card fw-card" id="fwRecHist"></div>';

  const bar = (a, b) => `<div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round(a / Math.max(1, b) * 100))}%"></div></div>`;
  const sess = () => { const s = E().session; return s && s.date === today() ? s : null };

  function recHist() {
    const L = (data.recovery || []).slice(-3).reverse();
    $("#fwRecHist").innerHTML = '<h2>Recent check-ins</h2>' + (L.length
      ? L.map(r => `<div class="exercise-item"><span><strong>${esc(r.feeling)}</strong><br><small class="muted">${esc(r.date)} · ${esc(r.severity)}${r.notes ? " · " + esc(r.notes) : ""}</small></span></div>`).join("")
      : '<p class="muted small">No check-ins yet. Log how you feel after a session.</p>');
  }

  function work() {
    const g = P.goal(), o = $("#fwTW");
    if (!g) {
      o.innerHTML = '<div class="card form-card fw-card"><h2>Today\'s workout</h2><p class="muted small">Choose the goal that fits you to get your plan.</p>' + P.goalChooser() + '</div>';
      return;
    }
    if (!P.env()) {
      o.innerHTML = '<div class="card form-card fw-card"><h2>Today\'s workout</h2><p class="muted small">Choose where you train to see today\'s exercises.</p><button class="btn btn-primary" type="button" data-fwgo="fwPlan">Choose where I train</button></div>';
      return;
    }
    const sc = P.SCH[g], dn = DAYS[new Date().getDay()], i = sc.findIndex(x => x[0] === dn);
    if (i < 0) {
      const nx = sc.find(x => DAYS.indexOf(x[0]) > new Date().getDay()) || sc[0];
      o.innerHTML = `<div class="card form-card fw-card"><h2>Today's workout</h2><p class="muted small">Rest day. Recovery is part of the plan. Next workout: ${nx[0]} · ${nx[1].map(m => P.MN[m]).join(" + ")}.</p></div>`;
      return;
    }
    const ms = sc[i][1], w = P.WK("work"), s = sess();
    const ex = ms.flatMap(m => P.picks(m).map(n => [m, P.EX[m].find(e => e[0] === n)]));
    const rows = ex.map(([m, e]) => {
      const tick = s ? `<input type="checkbox" data-fwdone="${e[0]}" ${s.done.includes(e[0]) ? "checked" : ""}> ` : "";
      return `<div class="fw-row"><label>${tick}<strong>${e[0]}</strong></label><span class="muted">${e[2] ? P.TX[w - 1] : P.RX[g][w - 1]}</span><button class="btn btn-quiet" type="button" data-fwvgo="${esc(e[0])}">▶ 3D</button></div>` +
        `<details class="fw-ex"><summary class="muted small">How to + video</summary><ol>${e[1].split(" · ").map(t => `<li>${t}</li>`).join("")}</ol>` +
        `<p class="muted small" style="margin:8px 0 0"><a href="${P.vid(e[0])}" target="_blank" rel="noopener noreferrer">Search form video ↗</a></p></details>`;
    }).join("") || '<p class="muted small">No exercises selected. Pick variations in the Workout plan tab.</p>';
    const head = `<h2>Today's workout · ${ms.map(m => P.MN[m]).join(" + ")}</h2><p class="muted small">Week ${w} · ${P.ENV[P.env()]}</p>`;
    const live = s ? `<div class="fw-timer" id="fwElapsed">${mm(Math.floor((Date.now() - s.start) / 1000))}</div>${bar(s.done.length, ex.length)}<p class="muted small">${s.done.length} of ${ex.length} exercises ticked</p>` : "";
    const action = s
      ? `<button class="btn btn-primary" type="button" data-fwfinish="1" style="margin-top:12px">Finish workout (${s.done.length}/${ex.length} done)</button>`
      : `<button class="btn btn-primary" type="button" data-fwstart="1" style="margin-top:12px">Start workout</button>`;
    o.innerHTML = `<div class="card form-card fw-card">${head}${live}${rows}${action}</div>`;
  }

  setInterval(() => { const s = sess(), el = $("#fwElapsed"); if (s && el) el.textContent = mm(Math.floor((Date.now() - s.start) / 1000)) }, 1000);

  document.addEventListener("click", e => {
    const t = e.target; let b;
    if (b = t.closest("[data-fwvgo]")) { if (window.FWVideo) FWVideo.select(b.dataset.fwvgo); }
    else if (b = t.closest("[data-fwgo]")) { $("[data-tab=" + b.dataset.fwgo + "]").click(); }
    else if (t.closest("[data-fwstart]")) { E().session = { date: today(), start: Date.now(), done: [] }; save(); toast("Workout started. Tick each exercise as you finish it.") }
    else if (t.closest("[data-fwfinish]")) {
      const s = sess(), g = P.goal(), ms = P.SCH[g].find(x => x[0] === DAYS[new Date().getDay()])[1], tot = ms.reduce((a, m) => a + P.picks(m).length, 0);
      data.workouts.push({ name: `${DAYS[new Date().getDay()]} · ${ms.map(m => P.MN[m]).join(" + ")}`, duration: Math.max(1, Math.round((Date.now() - s.start) / 60000)), difficulty: "Moderate", notes: `Completed ${s.done.length} of ${tot} exercises`, date: today() });
      E().session = null; save(); toast("Workout saved to My workouts.");
    }
  });
  document.addEventListener("change", e => {
    const c = e.target.closest("[data-fwdone]"); if (!c) return;
    const s = sess(), n = c.dataset.fwdone;
    s.done = c.checked ? s.done.concat(n) : s.done.filter(x => x !== n);
    save();
  });

  const _r = renderAll; renderAll = function () { _r(); work(); recHist() };
  renderAll();
  if (window.FWVideo) FWVideo.mount($("#fwVid"));
  tb.click();
})();
