// ── HVT Lunar Lander Game ──────────────────────────────────
(function () {
  'use strict';

  const canvas   = document.getElementById('gameCanvas');
  const ctx      = canvas.getContext('2d');
  const overlay  = document.getElementById('gameOverlay');
  const startBtn = document.getElementById('startBtn');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg   = document.getElementById('overlayMsg');

  const fuelEl  = document.getElementById('fuelVal');
  const altEl   = document.getElementById('altVal');
  const velEl   = document.getElementById('velVal');
  const scoreEl = document.getElementById('scoreVal');

  function resizeCanvas() {
    const w = canvas.parentElement.clientWidth - 32;
    canvas.width  = Math.min(w, 788);
    canvas.height = Math.round(canvas.width * 0.48);
  }
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); if (!gameRunning) drawIdle(); });

  // ── Constants ──────────────────────────────────────────
  const GRAVITY      = 0.007;
  const THRUST_MAIN  = 0.040;
  const ROTATE_SPEED = 0.025;
  const MAX_LAND_VEL = 1.4;
  const MAX_LAND_ANG = 0.52;
  const PAD_W        = 90;
  const LANDER_W     = 38;
  const LANDER_H     = 32;
  const TOTAL_FUEL   = 1400;

  let state, keys, score, gameRunning, animId;

  function resetState() {
    const cw = canvas.width, ch = canvas.height;
    state = {
      x: cw / 2,
      y: ch * 0.10,
      vx: (Math.random() - 0.5) * 0.25,
      vy: 0.05,
      angle: 0,
      fuel: TOTAL_FUEL,
      thrusting: false,
      landed: false,
      crashed: false,
      terrain: generateTerrain(),
      pads: [],
      particles: [],
      stars: generateStars(),
    };
    state.pads = generatePads(state.terrain);
  }

  function generateTerrain() {
    const cw = canvas.width, ch = canvas.height;
    const pts = [{ x: 0, y: ch * 0.75 }];
    const segments = 14;
    for (let i = 1; i < segments; i++) {
      pts.push({ x: (cw / segments) * i, y: ch * 0.65 + Math.random() * ch * 0.16 });
    }
    pts.push({ x: cw, y: ch * 0.75 });
    pts.push({ x: cw, y: ch });
    pts.push({ x: 0, y: ch });
    return pts;
  }

  function generatePads(terrain) {
    const pads = [];
    const pts  = terrain;
    const usedIdx = new Set();
    let tries = 0;
    while (pads.length < 3 && tries < 200) {
      tries++;
      const i = 1 + Math.floor(Math.random() * (pts.length - 4));
      if ([...usedIdx].some(u => Math.abs(u - i) < 2)) continue;
      const p1 = pts[i], p2 = pts[i + 1];
      if (!p2 || (p2.x - p1.x) < 10) continue;
      const flatY = (p1.y + p2.y) / 2;
      pts[i].y = flatY;
      pts[i + 1].y = flatY;
      usedIdx.add(i);
      const pointVal = [3, 2, 1][pads.length] || 1;
      pads.push({ x: (p1.x + p2.x) / 2 - PAD_W / 2, y: flatY, w: PAD_W, points: pointVal });
    }
    return pads;
  }

  function generateStars() {
    const stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height * 0.65, r: Math.random() * 1.2 + 0.2, op: Math.random() * 0.7 + 0.2 });
    }
    return stars;
  }

  // Input
  keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (['ArrowUp','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if ((e.key === 'r' || e.key === 'R') && gameRunning) restartGame();
  });
  window.addEventListener('keyup', e => keys[e.key] = false);

  function bindMobile(id, keyName) {
    const el = document.getElementById(id);
    if (!el) return;
    const on  = e => { e.preventDefault(); keys[keyName] = true;  el.classList.add('active'); };
    const off = e => { e.preventDefault(); keys[keyName] = false; el.classList.remove('active'); };
    el.addEventListener('touchstart', on,  { passive: false });
    el.addEventListener('touchend',   off, { passive: false });
    el.addEventListener('mousedown',  on);
    el.addEventListener('mouseup',    off);
    el.addEventListener('mouseleave', off);
  }
  bindMobile('ctrlThrust', 'ArrowUp');
  bindMobile('ctrlLeft',   'ArrowLeft');
  bindMobile('ctrlRight',  'ArrowRight');

  // Physics
  function update() {
    if (!gameRunning || state.landed || state.crashed) return;
    const s = state;
    s.thrusting = false;

    if (keys['ArrowUp'] && s.fuel > 0) {
      s.vx += Math.sin(s.angle) * THRUST_MAIN;
      s.vy -= Math.cos(s.angle) * THRUST_MAIN;
      s.fuel = Math.max(0, s.fuel - 1.5);
      s.thrusting = true;
      spawnParticles(s);
    }
    if (keys['ArrowLeft']  && s.fuel > 0) { s.angle -= ROTATE_SPEED; s.fuel = Math.max(0, s.fuel - 0.3); }
    if (keys['ArrowRight'] && s.fuel > 0) { s.angle += ROTATE_SPEED; s.fuel = Math.max(0, s.fuel - 0.3); }

    s.vy += GRAVITY;
    s.x  += s.vx;
    s.y  += s.vy;

    if (s.x < 10) { s.x = 10; s.vx *= -0.5; }
    if (s.x > canvas.width - 10) { s.x = canvas.width - 10; s.vx *= -0.5; }

    s.particles = s.particles.filter(p => p.life > 0);
    s.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--; });

    checkLanding();
    updateHUD();
  }

  function spawnParticles(s) {
    for (let i = 0; i < 5; i++) {
      const sp = (Math.random() - 0.5) * 1.0;
      s.particles.push({
        x: s.x + Math.sin(s.angle + Math.PI) * 18,
        y: s.y + Math.cos(s.angle + Math.PI) * 18,
        vx: Math.sin(s.angle + Math.PI + sp) * (1.5 + Math.random() * 1.5),
        vy: Math.cos(s.angle + Math.PI + sp) * (1.5 + Math.random() * 1.5),
        life: 22, maxLife: 22, type: 'thrust'
      });
    }
  }

  function terrainY(x) {
    const pts = state.terrain;
    for (let i = 0; i < pts.length - 3; i++) {
      if (x >= pts[i].x && x <= pts[i + 1].x) {
        const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x);
        return pts[i].y + t * (pts[i + 1].y - pts[i].y);
      }
    }
    return canvas.height * 0.75;
  }

  function checkLanding() {
    const s = state;
    const ty   = terrainY(s.x);
    const legY = s.y + LANDER_H / 2 + 10;
    if (legY >= ty) {
      s.y = ty - LANDER_H / 2 - 10;
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const ang   = Math.abs(s.angle % (Math.PI * 2));
      const pad   = state.pads.find(p => s.x >= p.x && s.x <= p.x + p.w);
      if (speed <= MAX_LAND_VEL && ang <= MAX_LAND_ANG && pad) {
        s.landed = true;
        const bonus = Math.floor(s.fuel / 20);
        const pts   = pad.points * 100 + bonus;
        score += pts;
        scoreEl.textContent = score;
        endGame(true, pad.points, pts);
      } else {
        s.crashed = true;
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
          s.particles.push({ x: s.x, y: s.y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1, life: 50, maxLife: 50, type: 'crash' });
        }
        const reason = !pad ? 'missed the pad' : (speed > MAX_LAND_VEL ? 'too fast' : 'too angled');
        endGame(false, 0, 0, reason);
      }
    }
  }

  function updateHUD() {
    const s = state;
    const alt = Math.max(0, Math.round(terrainY(s.x) - s.y - LANDER_H / 2));
    const vel = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    fuelEl.textContent = Math.round(s.fuel / TOTAL_FUEL * 100) + '%';
    altEl.textContent  = alt + 'm';
    velEl.textContent  = vel.toFixed(2) + 'm/s';
    velEl.style.color  = vel > MAX_LAND_VEL ? '#e07070' : '#c0c8d8';
    fuelEl.style.color = s.fuel < 300 ? '#d4aa60' : '#c0c8d8';
  }

  // ── Detailed LEM drawing ────────────────────────────────
  // All coords relative to lander center (0,0), scaled to fit ~38x32px bounding box.
  // Positive Y = down in canvas space. Lander "up" = negative Y.
  // Scale factor: SVG source is ~80 units wide, we want ~38px → scale = 38/80 ≈ 0.475
  // Origin offset: SVG LEM center is at roughly (40, 68) in the g transform space
  function drawLEM(thrusting) {
    const sc = 0.45;
    const ox = -38 * sc;  // center the 76-unit-wide shape
    const oy = -80 * sc;  // center the ~100-unit-tall shape (top of antenna to bottom of legs)

    // ── Engine flame ────────────────────────────────────
    if (thrusting) {
      const fh = (18 + Math.random() * 12) * sc;
      const fy = (96) * sc + oy;
      const fg = ctx.createLinearGradient(0, fy, 0, fy + fh);
      fg.addColorStop(0,   'rgba(200,210,255,0.95)');
      fg.addColorStop(0.3, 'rgba(255,190,60,0.8)');
      fg.addColorStop(1,   'rgba(255,80,10,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-6 * sc, fy);
      ctx.lineTo( 6 * sc, fy);
      ctx.lineTo( 0, fy + fh);
      ctx.fill();
    }

    // ── Landing legs ─────────────────────────────────────
    ctx.strokeStyle = '#a0b0be'; ctx.lineWidth = 2.2 * sc;  ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((30 - 38) * sc + ox + 38*sc, (87 - 68) * sc + oy + 80*sc);
    ctx.lineTo((18 - 38) * sc + ox + 38*sc, (100 - 68) * sc + oy + 80*sc);
    ctx.stroke();
    ctx.lineWidth = 1.4 * sc;
    ctx.beginPath();
    ctx.moveTo((27 - 38) * sc + ox + 38*sc, (87 - 68) * sc + oy + 80*sc);
    ctx.lineTo((13 - 38) * sc + ox + 38*sc, (102 - 68) * sc + oy + 80*sc);
    ctx.stroke();
    ctx.lineWidth = 2.8 * sc;
    ctx.beginPath();
    ctx.moveTo((18 - 38) * sc + ox + 38*sc, (100 - 68) * sc + oy + 80*sc);
    ctx.lineTo((8  - 38) * sc + ox + 38*sc, (100 - 68) * sc + oy + 80*sc);
    ctx.stroke();
    ctx.lineWidth = 1.2 * sc;
    ctx.beginPath();
    ctx.moveTo((13 - 38) * sc + ox + 38*sc, (102 - 68) * sc + oy + 80*sc);
    ctx.lineTo((4  - 38) * sc + ox + 38*sc, (102 - 68) * sc + oy + 80*sc);
    ctx.stroke();

    ctx.lineWidth = 2.2 * sc;
    ctx.beginPath();
    ctx.moveTo((50 - 38) * sc + ox + 38*sc, (87 - 68) * sc + oy + 80*sc);
    ctx.lineTo((62 - 38) * sc + ox + 38*sc, (100 - 68) * sc + oy + 80*sc);
    ctx.stroke();
    ctx.lineWidth = 1.4 * sc;
    ctx.beginPath();
    ctx.moveTo((53 - 38) * sc + ox + 38*sc, (87 - 68) * sc + oy + 80*sc);
    ctx.lineTo((67 - 38) * sc + ox + 38*sc, (102 - 68) * sc + oy + 80*sc);
    ctx.stroke();
    ctx.lineWidth = 2.8 * sc;
    ctx.beginPath();
    ctx.moveTo((62 - 38) * sc + ox + 38*sc, (100 - 68) * sc + oy + 80*sc);
    ctx.lineTo((72 - 38) * sc + ox + 38*sc, (100 - 68) * sc + oy + 80*sc);
    ctx.stroke();
    ctx.lineWidth = 1.2 * sc;
    ctx.beginPath();
    ctx.moveTo((67 - 38) * sc + ox + 38*sc, (102 - 68) * sc + oy + 80*sc);
    ctx.lineTo((76 - 38) * sc + ox + 38*sc, (102 - 68) * sc + oy + 80*sc);
    ctx.stroke();

    // Helper: convert SVG-space coords to canvas-relative coords
    const cx = (svgX) => (svgX - 38) * sc + ox + 38*sc;
    const cy = (svgY) => (svgY - 68) * sc + oy + 80*sc;
    const cw = (w)    => w * sc;
    const ch = (h)    => h * sc;

    // ── Descent stage skirt (equipment shelf) ─────────
    const dsGrad = ctx.createLinearGradient(cx(16), cy(80), cx(60), cy(80));
    dsGrad.addColorStop(0,   '#b0bcc8');
    dsGrad.addColorStop(0.5, '#a8b8c4');
    dsGrad.addColorStop(1,   '#8090a0');
    ctx.fillStyle = dsGrad;
    ctx.beginPath();
    ctx.roundRect(cx(26), cy(80), cw(28), ch(7), 0.8 * sc);
    ctx.fill();
    ctx.strokeStyle = '#7888a0'; ctx.lineWidth = 0.5 * sc;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#506070';
      ctx.beginPath();
      ctx.roundRect(cx(27 + i * 6.5), cy(81), cw(5), ch(5), 0.3 * sc);
      ctx.fill();
    }

    // ── Descent stage body ─────────────────────────────
    const dsBodyGrad = ctx.createLinearGradient(cx(16), cy(57), cx(60), cy(80));
    dsBodyGrad.addColorStop(0,   '#e0e8f0');
    dsBodyGrad.addColorStop(0.6, '#b0bcc8');
    dsBodyGrad.addColorStop(1,   '#8090a0');
    ctx.fillStyle = dsBodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx(38), cy(57));
    ctx.lineTo(cx(54), cy(57));
    ctx.lineTo(cx(60), cy(65));
    ctx.lineTo(cx(54), cy(80));
    ctx.lineTo(cx(38), cy(80));
    ctx.lineTo(cx(22), cy(80));
    ctx.lineTo(cx(16), cy(65));
    ctx.lineTo(cx(22), cy(57));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8898a8'; ctx.lineWidth = 0.8 * sc; ctx.stroke();
    // Side face shadow
    ctx.fillStyle = 'rgba(120,128,144,0.65)';
    ctx.beginPath();
    ctx.moveTo(cx(54), cy(57)); ctx.lineTo(cx(60), cy(65)); ctx.lineTo(cx(60), cy(80)); ctx.lineTo(cx(54), cy(80));
    ctx.closePath(); ctx.fill();
    // Panel lines
    ctx.strokeStyle = '#7888a0'; ctx.lineWidth = 0.5 * sc;
    [[28,57,28,80],[36,57,36,80],[46,57,46,80],[52,57,52,80]].forEach(([x1,y1,x2,y2]) => {
      ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.moveTo(cx(x1),cy(y1)); ctx.lineTo(cx(x2),cy(y2)); ctx.stroke();
    });
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(cx(16),cy(67)); ctx.lineTo(cx(60),cy(67)); ctx.stroke();
    ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(cx(17),cy(73)); ctx.lineTo(cx(60),cy(73)); ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Solar panels ───────────────────────────────────
    ctx.strokeStyle = '#8898a8'; ctx.lineWidth = 0.9 * sc;
    ctx.beginPath(); ctx.moveTo(cx(20), cy(72)); ctx.lineTo(cx(2), cy(72)); ctx.stroke();
    const scGrad = ctx.createLinearGradient(cx(2), 0, cx(20), 0);
    scGrad.addColorStop(0, '#1a2540'); scGrad.addColorStop(1, '#0e1828');
    ctx.fillStyle = scGrad;
    ctx.beginPath(); ctx.roundRect(cx(2), cy(72), cw(18), ch(13), 1.5 * sc); ctx.fill();
    ctx.strokeStyle = '#2a4060'; ctx.lineWidth = 0.7 * sc; ctx.stroke();
    ctx.strokeStyle = '#1e3050'; ctx.lineWidth = 0.6 * sc;
    [7,11,15].forEach(x => { ctx.beginPath(); ctx.moveTo(cx(x),cy(72)); ctx.lineTo(cx(x),cy(85)); ctx.stroke(); });
    ctx.strokeStyle = '#2a4870'; ctx.lineWidth = 0.5 * sc;
    ctx.beginPath(); ctx.moveTo(cx(2),cy(78)); ctx.lineTo(cx(20),cy(78)); ctx.stroke();

    ctx.beginPath(); ctx.moveTo(cx(60), cy(72)); ctx.lineTo(cx(78), cy(72));
    ctx.strokeStyle = '#8898a8'; ctx.lineWidth = 0.9 * sc; ctx.stroke();
    ctx.fillStyle = scGrad;
    ctx.beginPath(); ctx.roundRect(cx(60), cy(72), cw(18), ch(13), 1.5 * sc); ctx.fill();
    ctx.strokeStyle = '#2a4060'; ctx.lineWidth = 0.7 * sc; ctx.stroke();
    ctx.strokeStyle = '#1e3050'; ctx.lineWidth = 0.6 * sc;
    [65,69,73].forEach(x => { ctx.beginPath(); ctx.moveTo(cx(x),cy(72)); ctx.lineTo(cx(x),cy(85)); ctx.stroke(); });
    ctx.strokeStyle = '#2a4870'; ctx.lineWidth = 0.5 * sc;
    ctx.beginPath(); ctx.moveTo(cx(60),cy(78)); ctx.lineTo(cx(78),cy(78)); ctx.stroke();

    // ── Gold foil struts ──────────────────────────────
    ctx.strokeStyle = '#d4a830'; ctx.lineWidth = 1.3 * sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx(28),cy(57)); ctx.lineTo(cx(20),cy(50)); ctx.lineTo(cx(20),cy(40)); ctx.lineTo(cx(28),cy(38)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx(52),cy(57)); ctx.lineTo(cx(60),cy(50)); ctx.lineTo(cx(60),cy(40)); ctx.lineTo(cx(52),cy(38)); ctx.stroke();

    // ── Gold foil panels ──────────────────────────────
    const gfGrad = ctx.createLinearGradient(cx(14), cy(34), cx(28), cy(44));
    gfGrad.addColorStop(0, '#f0d068'); gfGrad.addColorStop(0.5, '#c89820'); gfGrad.addColorStop(1, '#a07010');
    ctx.fillStyle = gfGrad;
    ctx.beginPath(); ctx.roundRect(cx(14), cy(34), cw(14), ch(10), 1.2 * sc); ctx.fill();
    ctx.strokeStyle = '#a07010'; ctx.lineWidth = 0.6 * sc; ctx.stroke();
    ctx.strokeStyle = '#604000'; ctx.lineWidth = 0.6 * sc;
    ctx.beginPath(); ctx.moveTo(cx(16),cy(37)); ctx.lineTo(cx(26),cy(37)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx(16),cy(41)); ctx.lineTo(cx(26),cy(41)); ctx.stroke();

    ctx.fillStyle = gfGrad;
    ctx.beginPath(); ctx.roundRect(cx(52), cy(34), cw(14), ch(10), 1.2 * sc); ctx.fill();
    ctx.strokeStyle = '#a07010'; ctx.lineWidth = 0.6 * sc; ctx.stroke();
    ctx.strokeStyle = '#604000'; ctx.lineWidth = 0.6 * sc;
    ctx.beginPath(); ctx.moveTo(cx(54),cy(37)); ctx.lineTo(cx(64),cy(37)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx(54),cy(41)); ctx.lineTo(cx(64),cy(41)); ctx.stroke();

    // ── Ascent stage body ─────────────────────────────
    const asGrad = ctx.createLinearGradient(cx(28), cy(38), cx(52), cy(58));
    asGrad.addColorStop(0, '#c8d4e0'); asGrad.addColorStop(1, '#7890a0');
    ctx.fillStyle = asGrad;
    ctx.beginPath(); ctx.roundRect(cx(28), cy(38), cw(24), ch(20), 1.5 * sc); ctx.fill();
    ctx.strokeStyle = '#7888a0'; ctx.lineWidth = 0.8 * sc; ctx.stroke();
    // Top cap
    const atGrad = ctx.createLinearGradient(cx(28), 0, cx(52), 0);
    atGrad.addColorStop(0, '#b0c4d4'); atGrad.addColorStop(1, '#7090a8');
    ctx.fillStyle = atGrad;
    ctx.beginPath(); ctx.roundRect(cx(28), cy(37), cw(24), ch(4), 0.8 * sc); ctx.fill();
    // Equipment bays
    ctx.fillStyle = '#3a5068'; ctx.strokeStyle = '#4a6080'; ctx.lineWidth = 0.4 * sc;
    ctx.beginPath(); ctx.roundRect(cx(29), cy(41), cw(7), ch(5), 0.5 * sc); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a3e54';
    ctx.beginPath(); ctx.roundRect(cx(38), cy(41), cw(4), ch(5), 0.5 * sc); ctx.fill();
    ctx.fillStyle = '#3a5068'; ctx.strokeStyle = '#4a6080';
    ctx.beginPath(); ctx.roundRect(cx(44), cy(41), cw(7), ch(5), 0.5 * sc); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6878a0'; ctx.lineWidth = 0.4 * sc; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(cx(29),cy(49)); ctx.lineTo(cx(51),cy(49)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx(29),cy(53)); ctx.lineTo(cx(51),cy(53)); ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Porthole window ───────────────────────────────
    ctx.fillStyle = '#0c1520'; ctx.strokeStyle = '#506070'; ctx.lineWidth = 1.2 * sc;
    ctx.beginPath(); ctx.arc(cx(40), cy(68), 9 * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const wgGrad = ctx.createRadialGradient(cx(37), cy(65), 1*sc, cx(40), cy(68), 7*sc);
    wgGrad.addColorStop(0, 'rgba(88,150,180,0.8)'); wgGrad.addColorStop(1, 'rgba(12,24,40,1)');
    ctx.fillStyle = wgGrad;
    ctx.beginPath(); ctx.arc(cx(40), cy(68), 7 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7aa0be'; ctx.lineWidth = 0.4 * sc; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx(40), cy(68), 7 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#5888a8';
    ctx.beginPath(); ctx.arc(cx(37), cy(65), 2.5 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.strokeStyle = '#607888'; ctx.lineWidth = 0.4 * sc;
    ctx.beginPath(); ctx.moveTo(cx(36),cy(68)); ctx.lineTo(cx(44),cy(68)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx(40),cy(64)); ctx.lineTo(cx(40),cy(72)); ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Descent engine bell ───────────────────────────
    const thGrad = ctx.createLinearGradient(cx(35), cy(87), cx(45), cy(96));
    thGrad.addColorStop(0, '#b0bcc8'); thGrad.addColorStop(1, '#607080');
    ctx.fillStyle = thGrad; ctx.strokeStyle = '#6878a0'; ctx.lineWidth = 0.7 * sc;
    ctx.beginPath(); ctx.roundRect(cx(35), cy(87), cw(10), ch(9), 0.8 * sc); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#506070'; ctx.strokeStyle = '#404e5e'; ctx.lineWidth = 0.4 * sc;
    ctx.beginPath(); ctx.ellipse(cx(40), cy(96), 4 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#8090a0'; ctx.lineWidth = 0.4 * sc; ctx.globalAlpha = 0.6;
    [37,40,43].forEach(x => { ctx.beginPath(); ctx.moveTo(cx(x),cy(87)); ctx.lineTo(cx(x),cy(95)); ctx.stroke(); });
    ctx.globalAlpha = 1;

    // ── Antenna ───────────────────────────────────────
    ctx.strokeStyle = '#c0c8d8'; ctx.lineWidth = 1.4 * sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx(40),cy(37)); ctx.lineTo(cx(40),cy(25)); ctx.stroke();
    ctx.lineWidth = 1.0 * sc;
    ctx.beginPath(); ctx.moveTo(cx(40),cy(25)); ctx.lineTo(cx(37),cy(19)); ctx.stroke();
    ctx.lineWidth = 0.8 * sc;
    ctx.beginPath(); ctx.moveTo(cx(40),cy(23)); ctx.lineTo(cx(43),cy(17)); ctx.stroke();
    // Gold beacon
    const antGrad = ctx.createRadialGradient(cx(40), cy(14), 0, cx(40), cy(14), 3.5*sc);
    antGrad.addColorStop(0, '#f8e088'); antGrad.addColorStop(1, '#a07010');
    ctx.fillStyle = antGrad; ctx.strokeStyle = '#906010'; ctx.lineWidth = 0.7 * sc;
    ctx.beginPath(); ctx.arc(cx(40), cy(14), 3.5 * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffeea0';
    ctx.beginPath(); ctx.arc(cx(40), cy(14), 1.5 * sc, 0, Math.PI * 2); ctx.fill();

    ctx.lineCap = 'butt';
  }

  function drawLander() {
    const s = state;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    drawLEM(s.thrusting);
    ctx.restore();
  }

  // Drawing
  function draw() {
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#060610'); bg.addColorStop(1, '#0e0e18');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);

    state.stars.forEach(s => {
      ctx.globalAlpha = s.op; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    const eg = ctx.createRadialGradient(cw * 0.85, 0, 0, cw * 0.85, 0, 90);
    eg.addColorStop(0, 'rgba(80,100,160,0.25)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, 0, cw, ch);

    drawTerrain(); drawPads(); drawParticles();
    if (!state.crashed) drawLander();
  }

  function drawTerrain() {
    const pts = state.terrain;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height);
    tg.addColorStop(0, '#2a2a35'); tg.addColorStop(1, '#1a1a22');
    ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = 'rgba(192,200,216,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 2; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function drawPads() {
    state.pads.forEach(pad => {
      const grd = ctx.createLinearGradient(pad.x, pad.y - 6, pad.x, pad.y);
      grd.addColorStop(0, 'rgba(192,200,216,0.0)');
      grd.addColorStop(1, 'rgba(192,200,216,0.08)');
      ctx.fillStyle = grd; ctx.fillRect(pad.x, pad.y - 6, pad.w, 6);
      ctx.fillStyle = '#c0c8d8'; ctx.fillRect(pad.x, pad.y - 3, pad.w, 3);
      for (let i = 0; i <= 6; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#d4aa60' : '#c0c8d8';
        ctx.beginPath(); ctx.arc(pad.x + (pad.w / 6) * i, pad.y - 5, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#d4aa60';
      ctx.font = `bold ${Math.max(9, canvas.width * 0.014)}px 'Share Tech Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(pad.points + 'PT', pad.x + pad.w / 2, pad.y - 10);
    });
    ctx.textAlign = 'left';
  }

  function drawParticles() {
    state.particles.forEach(p => {
      const a = p.life / p.maxLife;
      ctx.fillStyle = p.type === 'thrust'
        ? `rgba(180,200,255,${a * 0.85})`
        : `rgba(220,140,60,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.type === 'crash' ? 2.5 : 2, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawIdle() {
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#060610'); bg.addColorStop(1, '#0e0e18');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = 0.2 + (i % 5) * 0.08; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc((i * 137.5) % cw, (i * 89.3) % (ch * 0.7), 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2a35'; ctx.fillRect(0, ch * 0.72, cw, ch);
  }

  function gameLoop() { update(); draw(); animId = requestAnimationFrame(gameLoop); }

  function startGame() {
    overlay.style.display = 'none';
    if (animId) cancelAnimationFrame(animId);
    score = parseInt(scoreEl.textContent) || 0;
    gameRunning = true;
    resetState();
    gameLoop();
  }

  function restartGame() {
    if (animId) cancelAnimationFrame(animId);
    gameRunning = false;
    overlayTitle.textContent = 'NEW MISSION';
    overlayMsg.innerHTML = 'Pilot the module to the landing pads.<br/>&#8592; &#8594; Rotate | &#8593; Main Engine | R Restart';
    overlay.style.display = 'flex';
    startBtn.textContent = 'LAUNCH';
    drawIdle();
  }

  function endGame(landed, padPts, total, reason) {
    setTimeout(() => {
      if (landed) {
        overlayTitle.textContent = '✓ TOUCHDOWN';
        overlayMsg.innerHTML = `Pad value: ${padPts}&#9733; &nbsp;|&nbsp; +${total} pts<br/>Total: <strong>${score}</strong>`;
        startBtn.textContent = 'NEXT MISSION';
      } else {
        overlayTitle.textContent = '✗ MISSION ABORT';
        overlayMsg.innerHTML = `Reason: ${reason || 'crash'}.<br/>Score: <strong>${score}</strong>`;
        startBtn.textContent = 'RETRY MISSION';
      }
      gameRunning = false;
      if (animId) cancelAnimationFrame(animId);
      draw();
      overlay.style.display = 'flex';
    }, landed ? 600 : 1200);
  }

  drawIdle();
  startBtn.addEventListener('click', startGame);

  const track = document.getElementById('tickerTrack');
  if (track) track.innerHTML += track.innerHTML;

})();
