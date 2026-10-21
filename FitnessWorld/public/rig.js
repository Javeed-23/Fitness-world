/* FitnessWorld 3D figure rig. Plain script, no DOM. Needs THREE (r128) as a global.
   Units are metres. The figure faces +Z, up is +Y. Angles in degrees.
   Channels: sh/el/hip/kn/sp/shz/hz (per side with an L or R suffix), yaw, lean, roll, ro. */
(function () {
  "use strict";
  var D = Math.PI / 180;
  var LEN = { thigh: 0.43, shin: 0.42, upper: 0.29, fore: 0.26, torso: 0.48 };

  function build(THREE, opts) {
    opts = opts || {};
    var R = {};
    var root = new THREE.Group();          /* turns the whole scene (360 view) */
    var G = new THREE.Group();             /* posture pitch/roll and grounding */
    root.add(G);
    var pelvis = new THREE.Group(); G.add(pelvis);
    var spine = new THREE.Group(); pelvis.add(spine);
    var neck = new THREE.Group(); neck.position.set(0, LEN.torso, 0); spine.add(neck);
    var J = { G: G, pelvis: pelvis, spine: spine, neck: neck };

    function side(s) {
      var sx = s === "L" ? 0.19 : -0.19, hx = s === "L" ? 0.10 : -0.10;
      var sh = new THREE.Group(); sh.position.set(sx, 0.46, 0); spine.add(sh);
      var el = new THREE.Group(); el.position.set(0, -LEN.upper, 0); sh.add(el);
      var wr = new THREE.Group(); wr.position.set(0, -LEN.fore, 0); el.add(wr);
      var hip = new THREE.Group(); hip.position.set(hx, 0, 0); pelvis.add(hip);
      var kn = new THREE.Group(); kn.position.set(0, -LEN.thigh, 0); hip.add(kn);
      var an = new THREE.Group(); an.position.set(0, -LEN.shin, 0); kn.add(an);
      J["sh" + s] = sh; J["el" + s] = el; J["wr" + s] = wr;
      J["hip" + s] = hip; J["kn" + s] = kn; J["an" + s] = an;
    }
    side("L"); side("R");

    /* ---------- materials ---------- */
    var M = {
      skin: new THREE.MeshStandardMaterial({ color: 0xb98f70, roughness: 0.6, metalness: 0.0 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.9, metalness: 0.0 }),
      shoe: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.6, metalness: 0.05 }),
      flesh: new THREE.MeshStandardMaterial({ color: 0x8c4f43, roughness: 0.62, metalness: 0.0 }),
      bone: new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.45, metalness: 0.0 }),
      hl: new THREE.MeshStandardMaterial({ color: 0xff5a48, emissive: 0x9a1208, emissiveIntensity: 0.9, roughness: 0.35 }),
      prop: new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.75, metalness: 0.15 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xaab0b8, roughness: 0.3, metalness: 0.8 })
    };
    R.M = M;

    /* ---------- layer registry ---------- */
    var layers = { skin: [], cloth: [], bone: [], shoe: [], hl: {} };
    R.layers = layers;
    var matFor = { skin: "skin", cloth: "cloth", bone: "bone", hl: "hl", shoe: "shoe" };
    function put(parent, mesh, layer, key) {
      if (!mesh.material) mesh.material = M[matFor[layer]];
      parent.add(mesh);
      mesh.userData.layer = layer;
      if (layer === "hl") {
        (layers.hl[key] = layers.hl[key] || []).push(mesh);
        mesh.visible = false;
      } else {
        layers[layer].push(mesh);
      }
      return mesh;
    }
    function at(m, x, y, z) { m.position.set(x, y, z); return m; }
    function ball(r, sx, sy, sz) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), null);
      m.scale.set(sx || 1, sy || 1, sz || 1);
      return m;
    }
    function tube(len, rt, rb, mat, pad) {
      var g = new THREE.CylinderGeometry(rt + (pad || 0), rb + (pad || 0), len, 22, 1);
      return new THREE.Mesh(g, mat);
    }
    /* a limb segment hanging from a joint (joint at local origin, segment toward -Y) */
    function seg(parent, len, rt, rb, mat, layer, pad) {
      var m = tube(len, rt, rb, mat, pad);
      m.position.y = -len / 2;
      return put(parent, m, layer);
    }

    var S = J.spine, P = J.pelvis, N = J.neck;

    /* torso and pelvis (skin + cloth + bone) */
    var torsoSkin = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.13, LEN.torso, 26, 1), M.skin);
    torsoSkin.position.y = LEN.torso / 2; torsoSkin.scale.set(1.28, 1, 0.78);
    put(S, torsoSkin, "skin");
    var torsoCloth = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, LEN.torso * 0.9, 26, 1, true), M.cloth);
    torsoCloth.position.y = LEN.torso * 0.5; torsoCloth.scale.set(1.3, 1, 0.8);
    put(S, torsoCloth, "cloth");
    var pelvSkin = ball(0.14, 1.22, 0.78, 0.86); put(P, pelvSkin, "skin");
    var shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.12, 26, 1, true), M.cloth);
    shorts.position.y = -0.03; shorts.scale.set(1.2, 1, 0.82); put(P, shorts, "cloth");
    /* neck and head */
    var neckSkin = tube(0.12, 0.05, 0.055, M.skin); neckSkin.position.y = 0.06; put(N, neckSkin, "skin");
    var head = ball(0.105, 0.9, 1.1, 1.0); head.position.y = 0.2; put(N, head, "skin");

    /* skeleton: spine column, ribs, pelvis, skull, shoulder bar */
    var col = tube(LEN.torso, 0.017, 0.017, M.bone); col.position.y = LEN.torso / 2; put(S, col, "bone");
    [0.26, 0.31, 0.36, 0.41].forEach(function (y) {
      var rib = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.007, 6, 28), M.bone);
      rib.rotation.x = Math.PI / 2; rib.scale.set(1, 1, 0.62); rib.position.y = y; put(S, rib, "bone");
    });
    var bar = tube(0.38, 0.016, 0.016, M.bone); bar.rotation.z = Math.PI / 2; bar.position.y = 0.46; put(S, bar, "bone");
    var skull = ball(0.095, 0.85, 1.05, 0.95); skull.position.y = 0.2; put(N, skull, "bone");
    var pelvBone = ball(0.11, 1.2, 0.5, 0.75); put(P, pelvBone, "bone");

    /* arms and legs */
    ["L", "R"].forEach(function (s) {
      var sh = J["sh" + s], el = J["el" + s], wr = J["wr" + s], hip = J["hip" + s], kn = J["kn" + s], an = J["an" + s];
      /* arm */
      put(sh, ball(0.058), "skin"); seg(sh, LEN.upper, 0.052, 0.042, M.skin, "skin");
      put(sh, ball(0.058), "bone");
      seg(sh, LEN.upper, 0.016, 0.016, M.bone, "bone");
      put(el, ball(0.042), "skin"); put(el, ball(0.03), "bone");
      seg(el, LEN.fore, 0.042, 0.03, M.skin, "skin");
      seg(el, LEN.fore, 0.012, 0.012, M.bone, "bone");
      put(wr, ball(0.031), "skin");
      var hand = ball(0.04, 0.85, 1.85, 0.5); hand.position.y = -0.085; put(wr, hand, "skin");
      /* shoulder muscle highlights */
      put(sh, ball(0.075), "hl", "shoulders");
      put(sh, at(ball(0.056, 1, 1.75, 1), 0, -0.13, 0.054), "hl", "biceps");
      put(sh, at(ball(0.056, 1, 1.75, 1), 0, -0.13, -0.054), "hl", "triceps");
      /* leg */
      put(hip, ball(0.05), "bone");
      seg(hip, LEN.thigh, 0.085, 0.058, M.skin, "skin");
      seg(hip, 0.27, 0.095, 0.085, M.cloth, "cloth", 0.012);
      seg(hip, LEN.thigh, 0.02, 0.02, M.bone, "bone");
      put(hip, at(ball(0.075, 1, 2.0, 0.75), 0, -0.2, 0.082), "hl", "quads");
      put(hip, at(ball(0.075, 1, 2.0, 0.75), 0, -0.2, -0.082), "hl", "hams");
      put(kn, ball(0.06), "skin"); put(kn, ball(0.04), "bone");
      seg(kn, LEN.shin, 0.06, 0.04, M.skin, "skin");
      seg(kn, LEN.shin, 0.014, 0.014, M.bone, "bone");
      put(kn, at(ball(0.06, 1, 1.7, 0.9), 0, -0.2, -0.07), "hl", "calves");
      put(an, ball(0.038), "skin"); put(an, ball(0.028), "bone");
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.07, 0.25), M.shoe);
      foot.position.set(0, -0.045, 0.08); put(an, foot, "shoe");
    });

    /* glutes (pelvis back) and abdominals and back/chest highlights, all on the trunk */
    [-0.08, 0.08].forEach(function (x) { put(P, at(ball(0.09, 1, 0.9, 0.9), x, -0.04, -0.1), "hl", "glutes"); });
    [-0.085, 0.085].forEach(function (x) { put(S, at(ball(0.085, 1, 0.85, 0.6), x, 0.36, 0.1), "hl", "chest"); });
    put(S, at(ball(0.095, 0.9, 1.6, 0.45), 0, 0.22, 0.12), "hl", "core");
    put(S, at(ball(0.14, 1.2, 1.5, 0.45), 0, 0.3, -0.12), "hl", "back");
    put(S, at(ball(0.08, 1.3, 0.7, 0.45), 0, 0.46, -0.1), "hl", "back");

    /* ---------- props (world-ish, inside the spin group) ---------- */
    var props = {};
    function prop(name, mesh) { mesh.visible = false; root.add(mesh); props[name] = mesh; return mesh; }
    prop("bench", new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 1.25), M.prop));
    prop("seat", new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.42), M.prop));
    prop("box", new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.42), M.prop));
    prop("wall", new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.06), M.prop));
    var barG = new THREE.Group();
    var barBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 14), M.steel);
    barBar.rotation.z = Math.PI / 2; barG.add(barBar);
    [-0.6, 0.6].forEach(function (x) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), M.steel);
      post.position.set(x, -0.5, 0); barG.add(post);
    });
    prop("bar", barG);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.MeshBasicMaterial({
      color: opts.shadowTexture ? 0xffffff : 0x000000, transparent: true, opacity: opts.shadowTexture ? 1 : 0.32,
      map: opts.shadowTexture || null, depthWrite: false
    }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; root.add(floor); R.floor = floor;
    R.props = props;

    /* ---------- contact points used for grounding ---------- */
    var contacts = [
      [P, [0, 0, 0], 0.16], [S, [0, 0.2, 0], 0.15], [S, [0, 0.38, 0], 0.15],
      [N, [0, 0.2, 0], 0.11], [J.shL, [0, 0, 0], 0.06], [J.shR, [0, 0, 0], 0.06],
      [J.knL, [0, 0, 0], 0.07], [J.knR, [0, 0, 0], 0.07],
      [J.anL, [0, 0, 0], 0.05], [J.anR, [0, 0, 0], 0.05],
      [J.anL, [0, 0, 0.2], 0.04], [J.anR, [0, 0, 0.2], 0.04],
      [J.anL, [0, 0, -0.04], 0.04], [J.anR, [0, 0, -0.04], 0.04],
      [J.wrL, [0, 0, 0], 0.035], [J.wrR, [0, 0, 0], 0.035],
      [J.wrL, [0, -0.1, 0], 0.035], [J.wrR, [0, -0.1, 0], 0.035]
    ];
    var wristIdx = [14, 15, 16, 17];
    var tmp = new THREE.Vector3();
    function worldOf(c) {
      tmp.set(c[1][0], c[1][1], c[1][2]);
      c[0].localToWorld(tmp);
      return tmp;
    }

    /* ---------- postures ---------- */
    /* post = { pitch, roll, anchor: 'min'|'wrists', at (support height), props: [...] } */
    var lastPost = null;
    R.pose = function (post, c) {
      /* grounding and centring are done in the figure's own frame, so the spin never leaks into them */
      var spinYaw = root.rotation.y;
      root.rotation.y = 0;
      G.rotation.set((post.pitch + (c.lean || 0)) * D, 0, (post.roll + (c.roll || 0)) * D);
      spine.rotation.set((c.sp || 0) * D, (c.yaw || 0) * D, 0);
      ["L", "R"].forEach(function (s) {
        var g = s === "L" ? 1 : -1;
        var sh = J["sh" + s], el = J["el" + s], hip = J["hip" + s], kn = J["kn" + s], an = J["an" + s];
        var shA = pick(c, "sh" + s, "sh"), shz = pick(c, "shz" + s, "shz");
        var elA = pick(c, "el" + s, "el"), hipA = pick(c, "hip" + s, "hip");
        var hz = pick(c, "hz" + s, "hz"), knA = pick(c, "kn" + s, "kn");
        sh.rotation.set(-shA * D, 0, g * shz * D);
        el.rotation.set(-elA * D, 0, 0);
        hip.rotation.set(-hipA * D, 0, g * hz * D);
        kn.rotation.set(knA * D, 0, 0);
        var ankA = pick(c, "ank" + s, "ank");
        an.rotation.set((hipA - knA + ankA) * D, 0, 0);
      });
      G.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      var lift = c.ro || 0;
      var ys = [], xs = [], zs = [];
      var anchorWrists = post.anchor === "wrists";
      var list = anchorWrists ? wristIdx.map(function (i) { return contacts[i]; }) : contacts;
      var minY = Infinity;
      list.forEach(function (ct) {
        var w = worldOf(ct); minY = Math.min(minY, w.y - ct[2]);
      });
      var y = (post.at || 0) - minY;
      /* hands-supported postures must never push a foot through the floor; hanging ones are pinned to the bar */
      if (anchorWrists && post.clamp !== false) {
        var all = Infinity;
        contacts.forEach(function (ct) { var w = worldOf(ct); all = Math.min(all, w.y - ct[2]); });
        if (y + all < 0) y = -all;
      }
      G.position.y = y + lift;
      root.updateMatrixWorld(true);
      /* centre the figure on the spin axis (horizontal postures would otherwise drift) */
      var cx = 0, cz = 0, n = 0;
      contacts.forEach(function (ct) { var w = worldOf(ct); cx += w.x; cz += w.z; n++; });
      G.position.x = -cx / n; G.position.z = -cz / n;
      root.updateMatrixWorld(true);
      lastPost = post;
      placeProps(post);
      root.rotation.y = spinYaw;
      root.updateMatrixWorld(true);
    };

    function pick(c, key, fallback) {
      var v = c[key];
      if (v === undefined) v = c[fallback];
      return v === undefined ? 0 : v;
    }

    function placeProps(post) {
      Object.keys(props).forEach(function (k) { props[k].visible = false; });
      var list = post.props || [];
      list.forEach(function (p) {
        var m = props[p.name];
        if (!m) return;
        m.visible = true;
        var at = p.at || "pelvis";
        var ref = anchorPoint(at);
        if (p.name === "bench" || p.name === "seat" || p.name === "box") {
          var h = p.h || 0.45;
          m.scale.set(1, h, 1);
          m.position.set(ref.x, h / 2, ref.z);
        } else if (p.name === "bar") {
          m.position.set(ref.x, p.h !== undefined ? p.h : ref.y, ref.z);
        } else if (p.name === "wall") {
          m.position.set(0, 0.9, ref.z - 0.16);
        }
        m.updateMatrixWorld(true);
      });
    }
    function anchorPoint(name) {
      var p = new THREE.Vector3();
      var map = { pelvis: [P, [0, 0, 0]], hands: [J.wrL, [0, 0, 0]], feet: [J.anL, [0, 0, 0]], spine: [S, [0, 0.2, 0]], handsR: [J.wrR, [0, 0, 0]], feetR: [J.anR, [0, 0, 0]] };
      var e = map[name] || map.pelvis;
      p.set(e[1][0], e[1][1], e[1][2]); e[0].localToWorld(p);
      return p;
    }

    /* ---------- views ---------- */
    R.setView = function (view) {
      var showSkin = view === "mannequin" || view === "muscle";
      var showCloth = view === "mannequin";
      var showBone = view === "skeleton";
      layers.skin.forEach(function (m) {
        m.visible = showSkin;
        m.material = view === "muscle" ? M.flesh : M.skin;
      });
      layers.cloth.forEach(function (m) { m.visible = showCloth; });
      layers.shoe.forEach(function (m) { m.visible = true; });
      layers.bone.forEach(function (m) { m.visible = showBone; });
      floor.visible = true;
      Object.keys(layers.hl).forEach(function (k) {
        layers.hl[k].forEach(function (m) { if (view !== "muscle") m.visible = false; });
      });
      R.view = view;
      if (R.targets) R.setTargets(R.targets);
    };
    R.setTargets = function (keys) {
      R.targets = keys || [];
      Object.keys(layers.hl).forEach(function (k) {
        var on = R.view === "muscle" && R.targets.indexOf(k) >= 0;
        layers.hl[k].forEach(function (m) { m.visible = on; });
      });
    };
    R.root = root;
    R.G = G;
    R.joints = J;
    R.contacts = contacts;
    return R;
  }

  window.FWRig = { build: build, D: D, LEN: LEN };
})();
