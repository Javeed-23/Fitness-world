/* FitnessWorld exercise video library: one shared 3D viewer for every variation.
   Three views (Mannequin, Skeleton, Muscle), 360 degree turn by drag, slider or auto-spin.
   three.js is loaded only when the viewer is first shown. Loads after plans.js and before today.js. */
(function () {
  "use strict";
  var P = window.FWP, MO = window.FWMotion, RG = window.FWRig;
  if (!P || !MO || !RG) return;
  var D = Math.PI / 180;
  var EX = P.EX, MN = P.MN;
  var LAB = { chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", quads: "Quads", hams: "Hamstrings", glutes: "Glutes", core: "Core", calves: "Calves" };
  var EQ = { b: "Bodyweight", d: "Dumbbells", g: "Gym equipment", c: "Bars" };
  var VIEWS = [["mannequin", "Mannequin"], ["skeleton", "Skeleton"], ["muscle", "Muscle"]];
  var VIEW_HELP = {
    mannequin: "Realistic mannequin in training clothes. Use it to see the full movement and the body position.",
    skeleton: "Bones only. Use it to see joint angles and how the skeleton moves.",
    muscle: "Muscles this exercise works are highlighted in red."
  };

  /* every variation, grouped by the plans library muscle group */
  var ITEMS = [];
  Object.keys(EX).forEach(function (g) {
    EX[g].forEach(function (e) {
      ITEMS.push({ name: e[0], group: g, steps: e[1], timed: !!e[2], tag: e[3] });
    });
  });
  var byName = {};
  ITEMS.forEach(function (it) { byName[it.name] = it; });

  var state = { name: ITEMS[0].name, view: "mannequin", t: 0, speed: 1, playing: true, spin: true, yaw: 0, filter: "all", q: "" };
  try { state.playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* no matchMedia */ }
  state.spin = state.playing;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- styles (injected, same pattern as the other feature layers) ---------- */
  var css = document.createElement("style");
  css.textContent = [
    ".fwv-stage{position:relative;margin:14px 0 12px;border-radius:14px;overflow:hidden;background:radial-gradient(120% 90% at 50% 18%,#2b2f36 0%,#16181c 62%,#0e0f12 100%);height:340px;border:1px solid #1d2026}",
    "@media(min-width:760px){.fwv-stage{height:420px}}",
    ".fwv-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab}",
    ".fwv-stage canvas:active{cursor:grabbing}",
    ".fwv-badge{position:absolute;inset:0;display:grid;place-items:center;color:#c9ced6;font-size:13px;text-align:center;padding:20px;pointer-events:none}",
    ".fwv-badge[hidden]{display:none}",
    ".fwv-title{position:absolute;left:14px;right:14px;bottom:12px;color:#fff;pointer-events:none;display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}",
    ".fwv-title strong{font-size:16px;letter-spacing:-.2px}",
    ".fwv-title span{font-size:11px;color:#aeb5bf;background:rgba(0,0,0,.35);padding:4px 8px;border-radius:20px;white-space:nowrap}",
    ".fwv-hint{position:absolute;top:10px;right:12px;font-size:10px;color:#aeb5bf;background:rgba(0,0,0,.35);padding:4px 8px;border-radius:20px;pointer-events:none}",
    ".fwv-views{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}",
    ".fwv-views button{flex:1;min-width:0}",
    ".fwv-views button[aria-pressed=true]{background:#111;color:#fff;border-color:#111}",
    ".fwv-help{font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5}",
    ".fwv-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;align-items:end}",
    ".fwv-controls label{font-size:12px;font-weight:700}",
    ".fwv-controls select{width:100%}",
    ".fwv-turn{display:flex;align-items:center;gap:10px;margin:12px 0 4px;font-size:12px;font-weight:700}",
    ".fwv-turn input{flex:1}",
    ".fwv-turn output{min-width:44px;text-align:right;color:var(--muted)}",
    ".fwv-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 2px}",
    ".fwv-chip{font-size:11px;font-weight:800;border:1px solid var(--line);border-radius:20px;padding:5px 10px;background:#fff}",
    ".fwv-chip.on{background:#ff5a48;border-color:#ff5a48;color:#fff}",
    ".fwv-filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}",
    ".fwv-filters input{flex:1;min-width:160px}",
    ".fwv-list{display:grid;gap:8px;margin-top:8px}",
    ".fwv-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;font-size:13px}",
    ".fwv-row.on{border-color:#111;box-shadow:inset 0 0 0 1px #111}",
    ".fwv-row small{display:block;color:var(--muted);font-size:11px;margin-top:2px}",
    ".fwv-row button{flex-shrink:0}",
    ".fwv-count{font-size:12px;color:var(--muted);margin:4px 0 0}",
    ".fwv-steps{font-size:13px;line-height:1.55;margin:8px 0 0;padding-left:20px}",
    ".fwv-note{font-size:11px;color:var(--muted);margin:10px 0 0}"
  ].join("");
  document.head.appendChild(css);

  /* ---------- markup ---------- */
  var root = null, els = {};
  function markup() {
    var groups = Object.keys(EX).map(function (g) { return '<option value="' + g + '">' + esc(MN[g]) + " (" + EX[g].length + ")</option>"; }).join("");
    return '' +
      '<div class="card form-card fw-card" id="fwvCard">' +
        '<p class="eyebrow">EXERCISE VIDEO LIBRARY</p>' +
        '<h2>Watch any exercise in 360°</h2>' +
        '<p class="muted small">Every variation in the library. Drag the figure to turn it all the way round, or use the slider. Choose a view to see the movement.</p>' +
        '<div class="fwv-stage" id="fwvStage">' +
          '<canvas id="fwvCanvas" role="img" aria-label="Animated 3D demonstration of the selected exercise"></canvas>' +
          '<div class="fwv-badge" id="fwvBadge">Loading 3D viewer…</div>' +
          '<span class="fwv-hint" id="fwvHint">Drag to turn 360°</span>' +
          '<div class="fwv-title"><strong id="fwvName"></strong><span id="fwvMeta"></span></div>' +
        '</div>' +
        '<div class="fwv-views" role="group" aria-label="Animation view">' +
          VIEWS.map(function (v) { return '<button class="btn btn-secondary" type="button" data-fwvview="' + v[0] + '" aria-pressed="false">' + v[1] + "</button>"; }).join("") +
        '</div>' +
        '<p class="fwv-help" id="fwvHelp"></p>' +
        '<div class="fwv-controls">' +
          '<button class="btn btn-primary" type="button" id="fwvPlay">Pause</button>' +
          '<button class="btn btn-secondary" type="button" id="fwvRestart">Restart</button>' +
          '<label>Speed<select id="fwvSpeed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label>' +
          '<button class="btn btn-secondary" type="button" id="fwvSpin" aria-pressed="true">Auto-turn: On</button>' +
        '</div>' +
        '<div class="fwv-turn"><span>Turn</span><input type="range" id="fwvTurn" min="0" max="359" value="0" aria-label="Turn the figure"><output id="fwvTurnOut">0°</output></div>' +
        '<div class="fwv-controls" style="grid-template-columns:repeat(3,1fr)">' +
          '<button class="btn btn-quiet" type="button" data-fwvangle="0">Front</button>' +
          '<button class="btn btn-quiet" type="button" data-fwvangle="90">Side</button>' +
          '<button class="btn btn-quiet" type="button" data-fwvangle="180">Back</button>' +
        '</div>' +
        '<div class="fwv-chips" id="fwvChips"></div>' +
        '<ol class="fwv-steps" id="fwvSteps"></ol>' +
        '<p class="fwv-note" id="fwvNote"></p>' +
      '</div>' +
      '<div class="card form-card fw-card" id="fwvListCard">' +
        '<h2>All variations</h2>' +
        '<p class="muted small">Choose a variation to play it above. Each one shows the same movement on the mannequin, skeleton and muscle views.</p>' +
        '<div class="fwv-filters">' +
          '<input id="fwvSearch" type="search" placeholder="Search by name" aria-label="Search exercises">' +
          '<select id="fwvGroup" aria-label="Muscle group"><option value="all">All muscles (' + ITEMS.length + ')</option>' + groups + '</select>' +
        '</div>' +
        '<p class="fwv-count" id="fwvCount"></p>' +
        '<div class="fwv-list" id="fwvList"></div>' +
        '<p class="fwv-note">Demonstrations are simplified 3D models for learning form, not real footage or medical advice. Stop if anything hurts.</p>' +
      '</div>';
  }

  function mount(host) {
    if (!host) return;
    host.innerHTML = markup();
    root = host;
    els.canvas = $("#fwvCanvas", host);
    els.stage = $("#fwvStage", host);
    els.badge = $("#fwvBadge", host);
    els.name = $("#fwvName", host);
    els.meta = $("#fwvMeta", host);
    els.help = $("#fwvHelp", host);
    els.play = $("#fwvPlay", host);
    els.spin = $("#fwvSpin", host);
    els.turn = $("#fwvTurn", host);
    els.turnOut = $("#fwvTurnOut", host);
    els.chips = $("#fwvChips", host);
    els.steps = $("#fwvSteps", host);
    els.note = $("#fwvNote", host);
    els.list = $("#fwvList", host);
    els.count = $("#fwvCount", host);

    host.addEventListener("click", onClick);
    $("#fwvSpeed", host).addEventListener("change", function (e) { state.speed = Number(e.target.value) || 1; });
    $("#fwvSearch", host).addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); renderList(); });
    $("#fwvGroup", host).addEventListener("change", function (e) { state.filter = e.target.value; renderList(); });
    els.turn.addEventListener("input", function (e) { state.yaw = Number(e.target.value); state.spin = false; syncSpin(); });
    bindDrag();

    renderList();
    syncSpin();
    select(state.name, false);
    setupStageObserver();
  }

  function onClick(e) {
    var b = e.target.closest("[data-fwvview],[data-fwvangle],[data-fwvpick],#fwvPlay,#fwvRestart,#fwvSpin");
    if (!b) return;
    if (b.dataset.fwvview) { setView(b.dataset.fwvview); return; }
    if (b.dataset.fwvangle) { state.yaw = Number(b.dataset.fwvangle); state.spin = false; syncSpin(); return; }
    if (b.dataset.fwvpick) { select(b.dataset.fwvpick, true); return; }
    if (b.id === "fwvPlay") { state.playing = !state.playing; els.play.textContent = state.playing ? "Pause" : "Play"; return; }
    if (b.id === "fwvRestart") { state.t = 0; state.playing = true; els.play.textContent = "Pause"; return; }
    if (b.id === "fwvSpin") { state.spin = !state.spin; syncSpin(); }
  }

  function syncSpin() {
    if (!els.spin) return;
    els.spin.textContent = "Auto-turn: " + (state.spin ? "On" : "Off");
    els.spin.setAttribute("aria-pressed", state.spin ? "true" : "false");
  }

  function setView(v) {
    state.view = v;
    $$("[data-fwvview]", root).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.fwvview === v ? "true" : "false"); });
    els.help.textContent = VIEW_HELP[v];
    if (rig) rig.setView(v);
  }

  function select(name, scroll) {
    var it = byName[name];
    if (!it) return;
    state.name = name; state.t = 0; els.play.textContent = state.playing ? "Pause" : "Play";
    els.name.textContent = it.name;
    els.meta.textContent = MN[it.group] + " · " + EQ[it.tag] + " · " + (it.timed ? "Timed hold" : "Repetitions");
    var steps = it.steps.split(" · ");
    els.steps.innerHTML = steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var muscles = MO.muscles(name);
    els.chips.innerHTML = '<span class="muted small" style="align-self:center;font-size:11px;font-weight:700">Works</span>' +
      muscles.map(function (m) { return '<span class="fwv-chip on">' + esc(LAB[m] || m) + "</span>"; }).join("");
    els.note.innerHTML = 'Watch a live video search: <a href="' + P.vid(it.name) + '" target="_blank" rel="noopener noreferrer">' + esc(it.name) + " form tutorial ↗</a>";
    setView(state.view);
    renderList();
    if (scroll && els.stage) els.stage.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderList() {
    if (!els.list) return;
    var rows = ITEMS.filter(function (it) {
      if (state.filter !== "all" && it.group !== state.filter) return false;
      if (state.q && it.name.toLowerCase().indexOf(state.q) < 0) return false;
      return true;
    });
    els.count.textContent = rows.length + " of " + ITEMS.length + " variations";
    els.list.innerHTML = rows.map(function (it) {
      var on = it.name === state.name;
      return '<div class="fwv-row' + (on ? " on" : "") + '"><span><strong>' + esc(it.name) + "</strong><small>" +
        esc(MN[it.group]) + " · " + esc(EQ[it.tag]) + (it.timed ? " · timed" : "") + "</small></span>" +
        '<button class="btn ' + (on ? "btn-primary" : "btn-secondary") + '" type="button" data-fwvpick="' + esc(it.name) + '"' + (on ? ' aria-current="true"' : "") + ">" + (on ? "Playing" : "▶ Play") + "</button></div>";
    }).join("") || '<p class="muted small">No variations match. Try another search or muscle group.</p>';
  }

  /* ---------- drag to turn ---------- */
  function bindDrag() {
    var drag = null;
    els.canvas.addEventListener("pointerdown", function (e) {
      drag = { x: e.clientX, yaw: state.yaw };
      state.spin = false; syncSpin();
      try { els.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    els.canvas.addEventListener("pointermove", function (e) {
      if (!drag) return;
      state.yaw = (drag.yaw + (e.clientX - drag.x) * 0.6) % 360;
    });
    var end = function () { drag = null; };
    els.canvas.addEventListener("pointerup", end);
    els.canvas.addEventListener("pointercancel", end);
  }

  /* ---------- lazy three.js + renderer ---------- */
  var THREE = null, rig = null, renderer = null, scene = null, cam = null, loadPromise = null;
  var frameTarget = null, frameDist = 3.4, camTarget = null, camDist = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "/vendor/three.min.js";
      s.onload = function () { window.THREE ? resolve(window.THREE) : reject(new Error("three")); };
      s.onerror = function () { reject(new Error("three")); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }
  function spotTexture() {
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,0.30)"); gr.addColorStop(0.55, "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  function init() {
    if (renderer || !els.canvas) return;
    loadThree().then(function (T) {
      THREE = T;
      renderer = new T.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputEncoding = T.sRGBEncoding;
      scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xffffff, 0x2a2d33, 0.6));
      var key = new T.DirectionalLight(0xffffff, 0.95); key.position.set(2.2, 4, 3); scene.add(key);
      var fill = new T.DirectionalLight(0xdfe6ff, 0.45); fill.position.set(-3, 2, 1.5); scene.add(fill);
      var rim = new T.DirectionalLight(0xffffff, 0.7); rim.position.set(0, 3, -3.5); scene.add(rim);
      rig = RG.build(T, { shadowTexture: spotTexture() });
      scene.add(rig.root);
      cam = new T.PerspectiveCamera(32, 1, 0.05, 60);
      camTarget = new T.Vector3(0, 0.9, 0);
      rig.setView(state.view);
      sizeRenderer();
      if (window.ResizeObserver) new ResizeObserver(sizeRenderer).observe(els.stage);
      els.badge.hidden = true;
      requestAnimationFrame(frame);
    }).catch(function () {
      els.badge.textContent = "The 3D viewer could not load. Check your connection, then reload the page. The list still works.";
    });
  }
  function sizeRenderer() {
    if (!renderer) return;
    var w = els.stage.clientWidth, h = els.stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  function setupStageObserver() {
    if (!window.IntersectionObserver) { init(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: "300px 0px" });
    io.observe(els.stage);
  }

  /* camera: fit the whole figure (rotation-invariant bounding sphere), smoothly */
  var _v = null;
  function frameCamera() {
    if (!_v) _v = new THREE.Vector3();
    var mean = new THREE.Vector3(), n = 0, pts = [], lo = Infinity, hi = -Infinity;
    rig.contacts.forEach(function (ct) {
      _v.set(ct[1][0], ct[1][1], ct[1][2]); ct[0].localToWorld(_v);
      pts.push(_v.clone()); mean.add(_v); n++;
      lo = Math.min(lo, _v.y); hi = Math.max(hi, _v.y);
    });
    /* aim at the vertical middle of the figure (not the mean, which the legs pull down) */
    var c = new THREE.Vector3(mean.x / n, (lo + hi) / 2, mean.z / n);
    var r = 0;
    pts.forEach(function (p) { r = Math.max(r, p.distanceTo(c)); });
    r = Math.max(0.75, r);
    var wantTarget = new THREE.Vector3(c.x, Math.max(0.5, c.y), c.z);
    var wantDist = r * 2.75 + 1.4;
    camTarget.lerp(wantTarget, 0.12);
    frameDist += (wantDist - frameDist) * 0.12;
    var dir = new THREE.Vector3(0.62, 0.36, 1).normalize();
    cam.position.copy(camTarget).addScaledVector(dir, frameDist);
    cam.lookAt(camTarget);
  }

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!rig) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (state.playing) state.t += dt * state.speed;
    if (state.spin) state.yaw = (state.yaw + dt * 24) % 360;
    if (els.turn && document.activeElement !== els.turn) els.turn.value = String(Math.round(((state.yaw % 360) + 360) % 360) % 360);
    if (els.turnOut) els.turnOut.textContent = Math.round(((state.yaw % 360) + 360) % 360) + "°";
    if (!els.canvas.offsetParent) return;
    var p = MO.pose(state.name, state.t);
    if (!p) return;
    rig.pose(p.post, p.ch);
    rig.setTargets(p.muscles);
    rig.root.rotation.y = state.yaw * D;
    frameCamera();
    renderer.render(scene, cam);
  }

  window.FWVideo = {
    mount: mount,
    select: function (name) { select(name, true); }
  };
  /* today.js mounts the library into its own panel */
})();
