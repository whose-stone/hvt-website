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

  // ── Constants (tuned for easier play) ──────────────────
  const GRAVITY      = 0.007;   // was 0.012 — gentler pull
  const THRUST_MAIN  = 0.040;   // was 0.030 — more responsive engine
  const ROTATE_SPEED = 0.025;   // was 0.030 — slightly less twitchy rotation
  const MAX_LAND_VEL = 1.4;     // was 0.8  — more forgiving touchdown speed
  const MAX_LAND_ANG = 0.52;    // was 0.35 — ~30° tolerance instead of ~20°
  const PAD_W        = 90;      // was 60   — wider landing pads
  const LANDER_W     = 28;
  const LANDER_H     = 22;
  const TOTAL_FUEL   = 1400;    // was 1000 — more fuel to learn with

  let state, keys, score, gameRunning, animId;

  function resetState() {
    const cw = canvas.width, ch = canvas.height;
    state = {
      x: cw / 2,
      y: ch * 0.10,
      vx: (Math.random() - 0.5) * 0.25,  // less initial horizontal drift
      vy: 0.05,                            // slower initial descent
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
    // Flatter terrain: less vertical variance
    const pts = [{ x: 0, y: ch * 0.75 }];
    const segments = 14;  // fewer segments = gentler slopes
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
      s.vx -= Math.sin(s.angle) * THRUST_MAIN;
      s.vy -= Math.cos(s.angle) * THRUST_MAIN;
      s.fuel = Math.max(0, s.fuel - 1.5);  // fuel burns slightly slower
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
    for (let i = 0; i < 4; i++) {
      const sp = (Math.random() - 0.5) * 0.8;
      s.particles.push({
        x: s.x + Math.sin(s.angle + Math.PI) * 14,
        y: s.y + Math.cos(s.angle + Math.PI) * 14,
        vx: Math.sin(s.angle + Math.PI + sp) * (1.2 + Math.random()),
        vy: Math.cos(s.angle + Math.PI + sp) * (1.2 + Math.random()),
        life: 20, maxLife: 20, type: 'thrust'
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
    const legY = s.y + LANDER_H / 2 + 6;
    if (legY >= ty) {
      s.y = ty - LANDER_H / 2 - 6;
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
        // Show why it crashed
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
      // Pad glow
      const grd = ctx.createLinearGradient(pad.x, pad.y - 6, pad.x, pad.y);
      grd.addColorStop(0, 'rgba(192,200,216,0.0)');
      grd.addColorStop(1, 'rgba(192,200,216,0.08)');
      ctx.fillStyle = grd;
      ctx.fillRect(pad.x, pad.y - 6, pad.w, 6);

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

  function drawLander() {
    const s = state;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    const hw = LANDER_W / 2, hh = LANDER_H / 2;

    if (s.thrusting) {
      const fh = 12 + Math.random() * 8;
      const fg = ctx.createLinearGradient(0, hh, 0, hh + fh);
      fg.addColorStop(0, 'rgba(192,200,255,0.9)');
      fg.addColorStop(0.4, 'rgba(255,180,60,0.7)');
      fg.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-5, hh); ctx.lineTo(5, hh); ctx.lineTo(0, hh + fh); ctx.fill();
    }

    ctx.strokeStyle = 'rgba(192,200,216,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-hw + 2, hh - 4); ctx.lineTo(-hw - 8, hh + 8);
    ctx.moveTo(-hw - 8, hh + 8); ctx.lineTo(-hw - 12, hh + 8);
    ctx.moveTo(hw - 2, hh - 4);  ctx.lineTo(hw + 8, hh + 8);
    ctx.moveTo(hw + 8, hh + 8);  ctx.lineTo(hw + 12, hh + 8);
    ctx.stroke();

    ctx.fillStyle = '#b0b8c8';
    ctx.beginPath(); ctx.roundRect(-hw, -hh + 4, LANDER_W, LANDER_H - 4, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = '#9098a8';
    ctx.beginPath(); ctx.roundRect(-hw * 0.55, -hh - 6, LANDER_W * 0.55, 10, 1); ctx.fill();

    ctx.fillStyle = '#1a2030'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(140,170,220,0.6)'; ctx.beginPath(); ctx.arc(-1, -1, 3, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(212,170,96,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -hh - 6); ctx.lineTo(0, -hh - 14); ctx.stroke();
    ctx.fillStyle = '#d4aa60'; ctx.beginPath(); ctx.arc(0, -hh - 15, 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    state.particles.forEach(p => {
      const a = p.life / p.maxLife;
      ctx.fillStyle = p.type === 'thrust'
        ? `rgba(180,200,255,${a * 0.8})`
        : `rgba(220,140,60,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.type === 'crash' ? 2 : 1.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawIdle() {
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#060610'); bg.addColorStop(1, '#0e0e18');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = 0.2 + (i % 5) * 0.08;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc((i * 137.5) % cw, (i * 89.3) % (ch * 0.7), 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2a35'; ctx.fillRect(0, ch * 0.72, cw, ch);
  }

  // Game loop
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

  // Init
  drawIdle();
  startBtn.addEventListener('click', startGame);

  // Duplicate ticker for seamless loop
  const track = document.getElementById('tickerTrack');
  if (track) track.innerHTML += track.innerHTML;

})();
