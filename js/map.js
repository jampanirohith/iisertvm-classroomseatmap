// Interactive map: the Lecture Hall Complex, the Physics Block and the Maths Block in 3D, placed as on the satellite view.
// Drag to turn, pinch or Ctrl + scroll to zoom, tap a building to pull its floors apart, tap a floor, then tap a classroom.
// The buildings are drawn by this file on a canvas (orthographic view, no libraries); their shapes are in campus-data.js.
(function () {
  'use strict';
  const rooms = window.LHC_ROOMS || [];
  document.querySelectorAll('[data-room-cap]').forEach(el => {
    const room = rooms.find(r => r.id === el.dataset.roomCap);
    if (room) el.textContent = `${room.capacity} seater`;
  });

  const D = window.LHC_CAMPUS;
  const canvas = document.getElementById('campus-canvas');
  const stage = canvas && canvas.closest('.map-card');
  const ctx = canvas && canvas.getContext && canvas.getContext('2d');
  if (!D || !stage || !ctx) return;

  const $ = id => document.getElementById(id);
  const ui = { buildings: $('map-buildings'), tools: $('map-tools'), tip: $('map-tip'), floors: $('map-floors'), detail: $('map-detail'),
    hint: $('map-hint'), title: $('detail-title'), note: $('detail-note'), pick: $('map-pick'), planLhc: $('plan-lhc'), planGen: $('plan-gen') };
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- numbers and colours ----------
  const FH = D.floorHeight, GAP = 3.6, SLAB = 3;          // height of a floor; how far floors move apart; thickness of a pulled-out floor
  const TAU = Math.PI * 2;
  const rad = d => d * Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);
  const css = getComputedStyle(stage);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
  const C = {
    ink: token('--m-ink', '#1d2540'), sheet: token('--m-sheet', '#f5f6f7'), hover: token('--m-hover', '#dbe6ff'), focus: token('--m-focus', '#1d4ed8'),
    mauve: token('--m-mauve', '#c9b8c1'), tan: token('--m-tan', '#d5c5b4'), blue: token('--m-blue', '#a9c3d7'), wash: token('--m-wash', '#a9c8b4'),
    lobby: token('--m-lobby', '#d3dad8'), ground: '#eaeee7', lawn: '#d9e6d2', road: '#ffffff', casing: '#d3d9d3', shadow: 'rgba(29, 37, 64, .11)'
  };
  const font = (weight, size) => `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;

  // ---------- the buildings ----------
  const area = ring => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;
  const LIGHT = [-0.55, 0.83];                           // the sun, in plan: from the south-west
  const B = D.buildings.map(b => {
    const rings = [{ pts: b.outline, hole: false }].concat((b.holes || []).map(h => ({ pts: h, hole: true })));
    const edges = [];
    rings.forEach(r => {
      const sign = area(r.pts) > 0 ? 1 : -1;
      r.pts.forEach((a, i) => {
        const c = r.pts[(i + 1) % r.pts.length];
        const ex = c[0] - a[0], ey = c[1] - a[1], len = Math.hypot(ex, ey);
        if (len < 0.01) return;
        let n = sign > 0 ? [ey / len, -ex / len] : [-ey / len, ex / len];
        if (r.hole) n = [-n[0], -n[1]];
        const shade = clamp((0.55 + 0.45 * (n[0] * LIGHT[0] + n[1] * LIGHT[1]) - 0.1) / 0.9, 0, 1);
        const pieces = Math.max(1, Math.ceil(len / 12));     // long walls are cut up so that they sort correctly when the view turns
        for (let j = 0; j < pieces; j++) {
          const t0 = j / pieces, t1 = (j + 1) / pieces;
          const ax = a[0] + ex * t0, ay = a[1] + ey * t0, bx = a[0] + ex * t1, by = a[1] + ey * t1;
          edges.push({ ax, ay, bx, by, nx: n[0], ny: n[1], mx: (ax + bx) / 2, my: (ay + by) / 2, first: j === 0, last: j === pieces - 1, shade });
        }
      });
    });
    return Object.assign({}, b, { rings, edges, n: b.floors.length });
  });
  const byId = id => B.find(b => b.id === id);
  const floorIndex = (b, id) => b.floors.findIndex(f => f.id === id);
  const toneColor = t => C[t] || C.lobby;
  const plateColor = b => b.id === 'lhc' ? mix('#d3dad8', '#ffffff', 0.62) : toneColor(b.tone);

  // ---------- state ----------
  const state = { building: null, floor: 'all', room: null, hover: null };
  const cam = { yaw: 0, pitch: rad(50), zoom: 1, tx: 0, ty: 0, tz: 0 };
  const goal = Object.assign({}, cam);
  const anim = {};
  B.forEach(b => { anim[b.id] = { e: 0, eGoal: 0, dim: 1, dimGoal: 1, fa: b.floors.map(() => 1), faGoal: b.floors.map(() => 1) }; });
  let W = 0, H = 0, dpr = 1, minZoom = 0.3, maxZoom = 12;
  let sinY = 0, cosY = 1, sinP = 1, cosP = 0;
  let hits = [];

  const spacing = e => FH * (1 + GAP * e);
  const slabHeight = e => FH + (SLAB - FH) * e;
  const floorTop = (k, e) => k * spacing(e) + slabHeight(e);

  // ---------- fitting the view ----------
  const narrow = () => W < 560;
  function fitTo(points, yaw, pitch, padX, padY) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]), zs = points.map(p => p[2]);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2, oy = (Math.min(...ys) + Math.max(...ys)) / 2, oz = (Math.min(...zs) + Math.max(...zs)) / 2;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    points.forEach(p => {
      const a = p[0] - ox, b = p[1] - oy, c = p[2] - oz;
      const u = a * cy - b * sy, v = (a * sy + b * cy) * sp - c * cp;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    });
    const dx = (u0 + u1) / 2, dy = (v0 + v1) / 2 / sp;     // move the view along the ground so that the box is centred
    return {
      zoom: Math.min((W - 2 * padX) / Math.max(1, u1 - u0), (H - 2 * padY) / Math.max(1, v1 - v0)),
      tx: ox + dx * cy + dy * sy, ty: oy - dx * sy + dy * cy, tz: oz
    };
  }
  const levels = (b, zs) => b.outline.flatMap(p => zs.map(z => [p[0], p[1], z]));
  function overviewPoints() { return B.flatMap(b => levels(b, [0, b.n * FH])); }

  function viewGoals() {
    const b = state.building && byId(state.building);
    const side = narrow() ? Math.round(W * 0.17) : 135;       // room for the floor labels beside the building
    let pts, pitch, padX = 36, padY = 34;
    if (!b) { pts = overviewPoints(); pitch = rad(50); }
    else if (state.floor === 'all') { pts = levels(b, [0, floorTop(b.n - 1, 1)]); pitch = rad(33); padX = side; padY = 36; }
    else { pts = levels(b, [floorTop(floorIndex(b, state.floor), 1)]); pitch = rad(56); padX = side; padY = 50; }
    return Object.assign({ pitch }, fitTo(pts, goal.yaw, pitch, padX, padY));
  }

  function applyState(instant, resetTurn) {
    B.forEach(b => {
      const a = anim[b.id], chosen = state.building === b.id, k = chosen ? floorIndex(b, state.floor) : -1;
      a.eGoal = chosen ? 1 : 0;
      a.dimGoal = state.building && !chosen ? 0 : 1;
      a.faGoal = b.floors.map((f, j) => !chosen || state.floor === 'all' || j === k ? 1 : j < k ? 0.5 : 0);
    });
    if (W) {
      if (resetTurn) goal.yaw = Math.round(cam.yaw / TAU) * TAU;
      Object.assign(goal, viewGoals());
      const home = fitTo(overviewPoints(), 0, rad(50), 36, 34);
      minZoom = home.zoom * 0.45; maxZoom = home.zoom * 14;
    }
    if (instant || calm) { snap(); }
    syncUi();
    request();
  }
  function snap() {
    Object.assign(cam, goal);
    B.forEach(b => { const a = anim[b.id]; a.e = a.eGoal; a.dim = a.dimGoal; a.fa = a.faGoal.slice(); });
  }

  // ---------- drawing ----------
  function setView() { sinY = Math.sin(cam.yaw); cosY = Math.cos(cam.yaw); sinP = Math.sin(cam.pitch); cosP = Math.cos(cam.pitch); }
  function P(x, y, z) {
    const a = x - cam.tx, b = y - cam.ty, c = z - cam.tz;
    return [W / 2 + (a * cosY - b * sinY) * cam.zoom, H / 2 + ((a * sinY + b * cosY) * sinP - c * cosP) * cam.zoom];
  }
  const depthOf = (x, y) => (x - cam.tx) * sinY + (y - cam.ty) * cosY;

  function trace(poly, z) { const out = poly.map(p => P(p[0], p[1], z)); out.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); return out; }
  function fillPoly(poly, z, fill, stroke, width) {
    ctx.beginPath(); const out = trace(poly, z);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.lineJoin = 'round'; ctx.stroke(); }
    return out;
  }

  // a road is drawn as a strip on the ground, so that it narrows when seen from the side
  function stripRings(pts, closed, w) {
    const n = pts.length, left = [], right = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[closed ? (i + n - 1) % n : Math.max(0, i - 1)], c = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      left.push([p[0] - ty * w / 2, p[1] + tx * w / 2]); right.push([p[0] + ty * w / 2, p[1] - tx * w / 2]);
    }
    return closed ? [left, right] : [left.concat(right.reverse())];
  }
  function drawRoads() {
    [[D.roadWidth + 3, C.casing], [D.roadWidth, C.road]].forEach(([w, color]) => {
      ctx.fillStyle = color;
      D.roads.forEach(r => {
        ctx.beginPath(); stripRings(r.pts, r.closed, w).forEach(ring => trace(ring, 0));
        ctx.fill('evenodd');
      });
    });
  }

  function wallColor(shade) { return mix('#c9c3b6', '#f6f3ec', shade); }
  function drawWalls(b, z0, z1, hitInfo) {
    const seen = [];
    b.edges.forEach(s => { if (s.nx * sinY + s.ny * cosY > 0.02) seen.push(s); });
    seen.sort((p, q) => depthOf(p.mx, p.my) - depthOf(q.mx, q.my));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    seen.forEach(s => {
      const A = P(s.ax, s.ay, z0), Bq = P(s.bx, s.by, z0), Bt = P(s.bx, s.by, z1), At = P(s.ax, s.ay, z1);
      const color = wallColor(s.shade);
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(Bq[0], Bq[1]); ctx.lineTo(Bt[0], Bt[1]); ctx.lineTo(At[0], At[1]); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]); ctx.lineTo(Bq[0], Bq[1]); ctx.moveTo(At[0], At[1]); ctx.lineTo(Bt[0], Bt[1]);
      if (s.first) { ctx.moveTo(A[0], A[1]); ctx.lineTo(At[0], At[1]); }
      if (s.last) { ctx.moveTo(Bq[0], Bq[1]); ctx.lineTo(Bt[0], Bt[1]); }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
      if (hitInfo) hitInfo.polys.push([A, Bq, Bt, At]);
    });
  }
  function topPath(b, z) { ctx.beginPath(); return b.rings.map(r => trace(r.pts, z)); }

  const roomColor = (r, hot) => hot ? C.hover : toneColor(r.tone);
  const sameRoom = (a, b) => a && b && a.bid === b.bid && a.floor === b.floor && a.i === b.i;

  function drawBuilding(b) {
    const a = anim[b.id], e = a.e, plan = smooth(clamp((e - 0.2) / 0.8, 0, 1));
    const chosen = state.building === b.id, hovering = state.hover && state.hover.kind === 'b' && state.hover.bid === b.id;
    for (let k = 0; k < b.n; k++) {
      const alpha = a.fa[k] * a.dim;
      if (alpha < 0.01) continue;
      const z0 = k * spacing(e), z1 = z0 + slabHeight(e), fl = b.floors[k], top = k === b.n - 1;
      // what a tap on this floor (or, while the building is closed, on the building) lands on; it is listed before the rooms, so a room wins
      const hitInfo = alpha >= 0.45 ? { kind: chosen ? 'floor' : 'b', bid: b.id, floor: fl.id, polys: [] } : null;
      if (hitInfo) hits.push(hitInfo);
      ctx.globalAlpha = alpha;
      drawWalls(b, z0, z1, hitInfo);
      // top face: the roof of the top floor while the building is closed, otherwise the plate of the floor
      if (top && plan < 0.999) {
        const faces = topPath(b, z1);
        ctx.fillStyle = toneColor(b.tone); ctx.fill('evenodd');
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
        (b.roof || []).forEach(r => fillPoly(r.poly, z1, toneColor(r.tone), C.ink, 1.1));
        if (hitInfo) faces.forEach(f => hitInfo.polys.push(f));
      }
      if (plan > 0.001) {
        ctx.globalAlpha = alpha * (top ? plan : 1);
        const faces = topPath(b, z1);
        ctx.fillStyle = plateColor(b); ctx.fill('evenodd');
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
        if (hitInfo) faces.forEach(f => hitInfo.polys.push(f));
        const set = b.rooms[fl.id] || { features: [], rooms: [] };
        ctx.globalAlpha = alpha * plan;
        set.features.forEach(f => fillPoly(f.poly, z1, toneColor(f.tone), C.ink, 0.8));
        const live = alpha >= 0.9 && plan > 0.6 && chosen && (state.floor === 'all' || state.floor === fl.id);
        set.rooms.forEach((r, i) => {
          const ref = { bid: b.id, floor: fl.id, i };
          const hot = live && (sameRoom(state.hover, Object.assign({ kind: 'room' }, ref)) || sameRoom(state.room, ref));
          const shape = fillPoly(r.poly, z1, roomColor(r, hot), hot ? C.focus : C.ink, hot ? 2.4 : 1.2);
          if (live) hits.push({ kind: 'room', bid: b.id, floor: fl.id, i, polys: [shape] });
        });
        if (live) drawRoomLabels(set.rooms, z1);
      }
      ctx.globalAlpha = 1;
      if (hovering && !chosen && top) { ctx.globalAlpha = alpha; topPath(b, z1); ctx.strokeStyle = C.focus; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }

  function drawRoomLabels(list, z) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    list.forEach(r => {
      const shape = r.poly.map(p => P(p[0], p[1], z));
      const xs = shape.map(p => p[0]), ys = shape.map(p => p[1]);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      const cx = shape.reduce((s, p) => s + p[0], 0) / shape.length, cy = shape.reduce((s, p) => s + p[1], 0) / shape.length;
      const cap = roomCap(r);
      ctx.font = font(700, 13);
      if (ctx.measureText(r.name).width + 8 > w * 0.92 || h < 26) return;
      const showCap = cap && h > 44, y = cy + (showCap ? -2 : 4);
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = C.ink;
      ctx.strokeText(r.name, cx, y); ctx.fillText(r.name, cx, y);
      if (showCap) { ctx.font = font(500, 11.5); ctx.strokeText(cap, cx, y + 15); ctx.fillText(cap, cx, y + 15); }
    });
  }
  function roomCap(r) {
    if (!r.capLive) return r.cap || '';
    const live = (rooms.find(x => x.id === r.id) || {}).capacity;
    return live ? `${live} seater` : '';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // a small label that always faces the viewer: `at` is the middle of its top edge (or its left edge when `side` is set)
  function tag(lines, x, y, opts) {
    const o = opts || {}, big = narrow() ? 12.5 : 14, small = narrow() ? 11 : 12;
    const fontOf = i => i ? font(500, small) : font(700, big);
    const w = Math.max(...lines.map((t, i) => { ctx.font = fontOf(i); return ctx.measureText(t).width; })) + (narrow() ? 14 : 20);
    const h = lines.length > 1 ? big + small + 14 : big + 14;
    const x0 = clamp(o.side ? x : x - w / 2, 6, Math.max(6, W - w - 6)), y0 = y - h / 2;
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    roundRect(x0, y0, w, h, 8);
    ctx.fillStyle = o.on ? C.ink : '#ffffff'; ctx.fill();
    ctx.strokeStyle = o.hot ? C.focus : C.ink; ctx.lineWidth = o.hot ? 2.4 : 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((t, i) => {
      ctx.font = fontOf(i);
      ctx.fillStyle = i ? (o.on ? '#dfe5f3' : '#4a5268') : (o.on ? '#ffffff' : C.ink);
      ctx.fillText(t, x0 + w / 2, y0 + (lines.length > 1 ? (i ? h - 8 : big + 6) : h / 2 + big * 0.36));
    });
    ctx.globalAlpha = 1;
    return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
  }
  function drawTags() {
    B.forEach(b => {
      const a = anim[b.id], chosen = state.building === b.id;
      const hot = state.hover && state.hover.bid === b.id;
      if (!chosen) {
        if (state.building) return;
        const at = b.labelAt || b.centre, p = P(at[0], at[1], b.n * FH * (1 - a.e) + 2);
        const alpha = Math.max(a.dim, 0.5) * (1 - a.e);
        if (alpha < 0.05) return;
        const r = tag(narrow() ? [b.name] : [b.name, `${b.n} floors`], p[0], p[1], { alpha, hot: hot && state.hover.kind === 'b' });
        hits.push({ kind: 'b', bid: b.id, floor: null, polys: [r] });
      } else if (a.e > 0.5) {
        const maxX = Math.max(...b.outline.map(p => P(p[0], p[1], 0)[0]));
        b.floors.forEach((fl, k) => {
          const z = floorTop(k, a.e), p = P(b.centre[0], b.centre[1], z);
          const on = state.floor === fl.id;
          const r = tag([narrow() ? fl.short : fl.label], Math.max(maxX, p[0]) + 10, p[1], { side: true, on, alpha: Math.max(a.fa[k], 0.45), hot: state.hover && state.hover.kind === 'floor' && state.hover.floor === fl.id });
          hits.push({ kind: 'floor', bid: b.id, floor: fl.id, polys: [r] });
        });
      }
    });
  }

  function draw() {
    if (!W) return;
    setView(); hits = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.fillStyle = C.ground; ctx.fillRect(0, 0, W, H);
    drawRoads();
    B.forEach(b => {                       // courtyards and shadows lie on the ground, under every building
      const e = anim[b.id].e, dim = anim[b.id].dim;
      ctx.globalAlpha = dim;
      (b.holes || []).forEach(h => fillPoly(h, 0, C.lawn));
      ctx.globalAlpha = dim * (1 - e);
      ctx.beginPath(); [b.outline].concat(b.holes || []).forEach(r => trace(r.map(p => [p[0] + 9, p[1] + 5]), 0));
      ctx.fillStyle = C.shadow; ctx.fill('evenodd');
    });
    const order = B.slice().sort((p, q) => depthOf(p.centre[0], p.centre[1]) - depthOf(q.centre[0], q.centre[1]));
    if (state.building) order.sort((p, q) => (p.id === state.building) - (q.id === state.building));
    order.forEach(drawBuilding);
    ctx.globalAlpha = 1;
    drawTags();
  }

  // ---------- animation ----------
  let raf = 0, last = 0;
  function approach(v, g, k, eps) { return Math.abs(g - v) < eps ? g : v + (g - v) * k; }
  function step(dt) {
    const k = 1 - Math.exp(-dt * 8);
    let moving = false;
    const set = (obj, key, g, eps) => { const v = approach(obj[key], g, k, eps); if (v !== g) moving = true; obj[key] = v; };
    set(cam, 'yaw', goal.yaw, 0.0005); set(cam, 'pitch', goal.pitch, 0.0005); set(cam, 'zoom', goal.zoom, goal.zoom * 0.0008);
    set(cam, 'tx', goal.tx, 0.02); set(cam, 'ty', goal.ty, 0.02); set(cam, 'tz', goal.tz, 0.02);
    B.forEach(b => {
      const a = anim[b.id];
      set(a, 'e', a.eGoal, 0.002); set(a, 'dim', a.dimGoal, 0.004);
      a.fa.forEach((v, j) => set(a.fa, j, a.faGoal[j], 0.004));
    });
    return moving;
  }
  function frame(t) {
    raf = 0;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    const moving = step(dt);
    draw();
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  function request() { if (!raf) raf = requestAnimationFrame(frame); }

  // ---------- size ----------
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w === W && h === H) return false;
    const first = !W;
    W = w; H = h;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (first) { applyState(true); } else { applyState(true); }
    return true;
  }

  // ---------- picking ----------
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function pick(pt) {
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].polys.some(poly => inside(pt, poly))) return hits[i];
    return null;
  }
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function roomOf(h) { const b = byId(h.bid); return b.rooms[h.floor].rooms[h.i]; }
  function choose(h) {
    if (!h) {
      if (state.room) { state.room = null; syncUi(); request(); } else if (state.building) { select(null); }
      return;
    }
    if (h.kind === 'room') { state.room = { bid: h.bid, floor: h.floor, i: h.i }; syncUi(); request(); return; }
    if (h.kind === 'floor') { select(h.bid, state.floor === h.floor ? 'all' : h.floor); return; }
    if (h.kind === 'b') select(h.bid, 'all');
  }
  function select(id, floor) {
    state.building = id; state.floor = id ? (floor || 'all') : 'all'; state.room = null; state.hover = null;
    applyState(false);
  }

  // ---------- pointer, wheel and keyboard ----------
  const pointers = new Map();
  let drag = null, pinch = null;
  function pan(dx, dy) {
    const x1 = -dx / cam.zoom, y1 = -dy / (cam.zoom * sinP);
    cam.tx += x1 * cosY + y1 * sinY; cam.ty += -x1 * sinY + y1 * cosY;
    const bnd = D.bounds; cam.tx = clamp(cam.tx, bnd[0] - 60, bnd[2] + 60); cam.ty = clamp(cam.ty, bnd[1] - 60, bnd[3] + 60);
    goal.tx = cam.tx; goal.ty = cam.ty;
  }
  function zoomAt(pt, factor) {
    const z = clamp(cam.zoom * factor, minZoom, maxZoom), f = z / cam.zoom;
    const u = (pt[0] - W / 2) / cam.zoom, v = (pt[1] - H / 2) / (cam.zoom * sinP);
    const dx = u - u / f, dy = v - v / f;
    cam.tx += dx * cosY + dy * sinY; cam.ty += -dx * sinY + dy * cosY; cam.zoom = z;
    Object.assign(goal, { tx: cam.tx, ty: cam.ty, zoom: z });
  }
  const freeze = () => Object.assign(goal, cam);

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button > 2) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not needed */ }
    pointers.set(e.pointerId, local(e));
    freeze();
    if (pointers.size === 1) {
      drag = { start: local(e), last: local(e), moved: false, mode: e.button === 2 || e.shiftKey ? 'pan' : 'turn', id: e.pointerId };
      pinch = null;
    } else if (pointers.size === 2) {
      const [p, q] = [...pointers.values()];
      pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]) || 1, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] };
      if (drag) drag.moved = true;
    }
  });
  canvas.addEventListener('pointermove', e => {
    const pt = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pt);
    if (pinch && pointers.size >= 2) {
      const [p, q] = [...pointers.values()];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1, mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      pan(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      zoomAt(mid, d / pinch.d);
      pinch = { d, mid };
      hideTip(); request(); return;
    }
    if (drag && e.pointerId === drag.id && pointers.has(e.pointerId)) {
      const dx = pt[0] - drag.last[0], dy = pt[1] - drag.last[1];
      if (!drag.moved && Math.hypot(pt[0] - drag.start[0], pt[1] - drag.start[1]) > 5) drag.moved = true;
      if (drag.moved) {
        if (drag.mode === 'pan') pan(dx, dy);
        else { cam.yaw -= dx * 0.0075; cam.pitch = clamp(cam.pitch + dy * 0.006, rad(20), rad(86)); goal.yaw = cam.yaw; goal.pitch = cam.pitch; }
        hideTip(); request();
      }
      drag.last = pt; return;
    }
    if (e.pointerType === 'mouse') hover(pt, e);
  });
  function endPointer(e, cancelled) {
    pointers.delete(e.pointerId);
    if (drag && e.pointerId === drag.id) {
      const wasClick = !drag.moved && !cancelled && !pinch;
      const pt = local(e);
      drag = null;
      if (wasClick) choose(pick(pt));
    }
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { drag = null; }
  }
  canvas.addEventListener('pointerup', e => endPointer(e, false));
  canvas.addEventListener('pointercancel', e => endPointer(e, true));
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pointers.size) { state.hover = null; hideTip(); request(); } });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;                  // a plain scroll moves the page
    e.preventDefault(); freeze();
    zoomAt(local(e), Math.exp(-clamp(e.deltaY, -60, 60) * 0.01)); request();
  }, { passive: false });

  function hover(pt, e) {
    const h = pick(pt);
    const key = h ? `${h.kind}|${h.bid}|${h.floor}|${h.i}` : '';
    const old = state.hover ? `${state.hover.kind}|${state.hover.bid}|${state.hover.floor}|${state.hover.i}` : '';
    canvas.style.cursor = h ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (key !== old) { state.hover = h; request(); }
    if (h && ui.tip) {
      const b = byId(h.bid);
      ui.tip.textContent = h.kind === 'room' ? roomOf(h).name : h.kind === 'floor' ? `${b.full}, ${b.floors[floorIndex(b, h.floor)].label}` : b.full;
      const r = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      ui.tip.style.left = `${Math.round(e.clientX - sr.left + 14)}px`; ui.tip.style.top = `${Math.round(e.clientY - sr.top + 16)}px`; ui.tip.hidden = false;
    } else hideTip();
  }
  function hideTip() { if (ui.tip) ui.tip.hidden = true; }

  function turn(d) { goal.yaw = cam.yaw + rad(d); request(); }
  function tilt(d) { goal.pitch = clamp(cam.pitch + rad(d), rad(20), rad(86)); request(); }
  function zoomBy(f) { goal.zoom = clamp(cam.zoom * f, minZoom, maxZoom); request(); }
  function reset() { applyState(false, true); }
  const actions = { 'turn-left': () => turn(-30), 'turn-right': () => turn(30), 'tilt-up': () => tilt(8), 'tilt-down': () => tilt(-8), 'zoom-in': () => zoomBy(1.35), 'zoom-out': () => zoomBy(1 / 1.35), reset };
  if (ui.tools) ui.tools.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && actions[b.dataset.act]) actions[b.dataset.act](); });
  canvas.addEventListener('keydown', e => {
    const k = e.key;
    const map = { ArrowLeft: 'turn-left', ArrowRight: 'turn-right', ArrowUp: 'tilt-up', ArrowDown: 'tilt-down', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '_': 'zoom-out', '0': 'reset' };
    if (map[k]) { e.preventDefault(); actions[map[k]](); }
    else if (k === 'Escape' && state.building) { e.preventDefault(); select(null); }
  });

  // ---------- the page around the canvas ----------
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let floorsFor = null;
  function syncUi() {
    if (ui.buildings) ui.buildings.querySelectorAll('[data-building]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.building === state.building)));
    const b = state.building && byId(state.building);
    if (ui.floors) {
      ui.floors.hidden = !b;
      if (b && floorsFor !== b.id) {
        floorsFor = b.id; ui.floors.textContent = '';
        const all = el('button', '', 'All floors'); all.type = 'button'; all.dataset.floor = 'all'; ui.floors.appendChild(all);
        b.floors.slice().reverse().forEach(f => { const btn = el('button', '', f.label); btn.type = 'button'; btn.dataset.floor = f.id; ui.floors.appendChild(btn); });
      }
      if (b) ui.floors.querySelectorAll('[data-floor]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.floor === state.floor)));
    }
    if (ui.detail) {
      ui.detail.hidden = !b;
      if (b) {
        const fl = state.floor === 'all' ? null : b.floors[floorIndex(b, state.floor)];
        const shown = fl || b.floors[b.n - 1];
        ui.title.textContent = fl ? `${b.full}: ${fl.label}` : b.full;
        ui.note.textContent = fl ? b.notes[fl.id] : `${b.n} floors, pulled apart so that each one shows. Pick a floor to see its rooms.`;
        showPlan(b, fl);
        void shown;
      }
    }
    syncPick();
    syncUrl();
  }
  function showPlan(b, fl) {
    const lhcFloor = b.id === 'lhc' && fl && (fl.id === '1' || fl.id === '2');
    const svg = ui.planLhc && ui.planLhc.querySelector('svg');
    if (ui.planLhc) ui.planLhc.hidden = !lhcFloor;
    if (lhcFloor && svg) {
      const plan = svg.querySelector('#view-plan'), jv = svg.querySelector('#view-jv');
      if (plan) plan.toggleAttribute('hidden', fl.id !== '1');
      if (jv) jv.toggleAttribute('hidden', fl.id !== '2');
    }
    if (ui.planGen) {
      ui.planGen.hidden = lhcFloor || !fl;
      if (!lhcFloor && fl) ui.planGen.innerHTML = outlineSvg(b, fl);
    }
  }
  function outlineSvg(b, fl) {
    const xs = b.outline.map(p => p[0]), ys = b.outline.map(p => p[1]), pad = 12;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - Math.min(...xs) + 2 * pad, h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
    const d = ring => `M${ring.map(p => `${p[0]} ${p[1]}`).join('L')}Z`;
    const tone = b.id === 'lhc' ? 'lobby' : b.tone;
    return `<svg class="lhc-map-svg plan-flat" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" role="img" aria-label="${b.full}, ${fl.label}: outline">`
      + `<path class="fp-fill tone-${tone}" fill-rule="evenodd" d="${[b.outline].concat(b.holes || []).map(d).join('')}"/>`
      + (b.holes || []).map(hole => `<path class="fp-fill tone-lawn" d="${d(hole)}"/>`).join('')
      + `<path class="wall" d="${[b.outline].concat(b.holes || []).map(d).join('')}"/></svg>`;
  }
  function syncPick() {
    if (!ui.pick) return;
    const r = state.room && state.building ? byId(state.room.bid).rooms[state.room.floor].rooms[state.room.i] : null;
    ui.pick.hidden = !r;
    if (!r) return;
    ui.pick.textContent = '';
    ui.pick.appendChild(el('strong', '', r.name));
    const cap = roomCap(r);
    if (cap) ui.pick.appendChild(el('span', 'pick-cap', cap));
    if (r.id) { const a = el('a', 'btn primary', 'Open seating arrangement'); a.href = `room.html?room=${r.id}`; ui.pick.appendChild(a); }
  }
  function syncUrl() {
    let q = '';
    if (state.building) q = `?building=${state.building}${state.floor !== 'all' ? `&floor=${state.floor}` : ''}`;
    try { history.replaceState(null, '', location.pathname + q); } catch { /* ignore */ }
  }

  if (ui.buildings) ui.buildings.addEventListener('click', e => {
    const btn = e.target.closest('[data-building]');
    if (btn) select(state.building === btn.dataset.building ? null : btn.dataset.building, 'all');
  });
  if (ui.floors) ui.floors.addEventListener('click', e => {
    const btn = e.target.closest('[data-floor]');
    if (!btn || !state.building) return;
    state.floor = btn.dataset.floor; state.room = null; applyState(false);
  });

  // ---------- start ----------
  const params = new URLSearchParams(location.search);
  const want = params.get('building') || (params.get('view') === 'jv' ? 'lhc' : null);
  const wantFloor = params.get('floor') || (params.get('view') === 'jv' ? '2' : 'all');
  if (want && byId(want)) { state.building = want; const b = byId(want); state.floor = floorIndex(b, wantFloor) >= 0 ? wantFloor : 'all'; }
  if (ui.buildings) ui.buildings.hidden = false;
  if (ui.tools) ui.tools.hidden = false;
  if (ui.hint) ui.hint.hidden = false;
  canvas.style.cursor = 'grab';
  syncUi();
  resize();
  if (window.ResizeObserver) new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (Math.round(r.width) !== W || !W) resize(); }).observe(canvas);
  else window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(request);
  request();
})();
