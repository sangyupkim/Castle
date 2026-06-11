'use strict';

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Responsive sizing – keep portrait 480×800, scale to fit window
function resize() {
  const scale = Math.min(window.innerWidth / CW, window.innerHeight / CH);
  canvas.width  = CW;
  canvas.height = CH;
  canvas.style.width  = `${CW * scale}px`;
  canvas.style.height = `${CH * scale}px`;
  _canvasScale = scale;
}
let _canvasScale = 1;
window.addEventListener('resize', resize);
resize();

// ─── Game State ───────────────────────────────────────────────────────────────
function createInitialState() {
  return {
    phase:  1,
    wave:   0,      // 0-based (displayed as wave+1)
    gold:   10,
    baseHP: BASE_HP_MAX,

    towers:        [],
    defenseEnemies:[],
    projectiles:   [],

    mercs:         [],
    battleEnemies: [],

    waveActive: false,
    gameOver:   false,
    stageCleared: false,

    hero: { level:1, exp:0, hp:50, maxHp:50, dead:false, reviveTimer:0 },

    hoveredCell: null,

    ui: {
      waveBtn:   { x:0, y:0, w:0, h:0 },
      skillBtns: [{},{},{} ]
    },

    // floating texts
    floaties: []
  };
}

let gs = createInitialState();
const wm  = createWaveManager();
const tut = createTutorial();

// Load save
const saved = SaveManager.load();
if (saved) {
  gs.phase   = saved.phase  || 1;
  gs.wave    = saved.wave   || 0;
  gs.gold    = saved.gold   || 10;
  gs.baseHP  = saved.baseHP || BASE_HP_MAX;
  gs.hero.level = saved.heroLevel || 1;
  gs.hero.exp   = saved.heroExp   || 0;
  wm.init(gs.wave);
}

tut.start();

// ─── Input ────────────────────────────────────────────────────────────────────
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return {
    x: (touch.clientX - rect.left) / _canvasScale,
    y: (touch.clientY - rect.top)  / _canvasScale
  };
}

canvas.addEventListener('mousemove', e => {
  const pt = canvasPoint(e);
  gs.hoveredCell = screenToCell(pt.x, pt.y);
});

canvas.addEventListener('mouseleave', () => { gs.hoveredCell = null; });

canvas.addEventListener('click',     e => handleTap(canvasPoint(e)));
canvas.addEventListener('touchstart', e => { e.preventDefault(); handleTap(canvasPoint(e)); }, { passive: false });

function handleTap(pt) {
  // Tutorial dismissal
  if (tut.active) { tut.next(); return; }

  // Game over / clear → restart
  if (gs.gameOver)    { resetGame(); return; }
  if (gs.stageCleared){ resetGame(true); return; }

  const { x, y } = pt;

  // ── UI Bar buttons ───────────────────────────────────────────────────────
  const btn = gs.ui.waveBtn;
  if (hitTest(x, y, btn)) {
    if (wm.phase === 'idle') {
      wm.startWave(gs);
      gs.waveActive = true;
    } else if (wm.phase === 'active' && gs.gold >= MERC_TYPES.swordsman.cost) {
      gs.gold -= MERC_TYPES.swordsman.cost;
      gs.mercs.push(makeMerc('swordsman'));
      spawnFloaty(`+검사`, btn.x + btn.w / 2, btn.y, '#60a5fa');
    }
    return;
  }

  // ── Skill buttons ────────────────────────────────────────────────────────
  for (const sb of gs.ui.skillBtns) {
    if (sb.skillId && hitTest(x, y, sb)) {
      const ok = activateSkill(sb.skillId, gs.mercs);
      if (ok) spawnFloaty(SKILLS.find(s => s.id === sb.skillId).icon, sb.x + sb.w/2, sb.y, '#fbbf24');
      return;
    }
  }

  // ── Defense zone: place tower ────────────────────────────────────────────
  if (y < UIBAR_Y) {
    const cell = screenToCell(x, y);
    if (cell && !PATH_CELLS.has(`${cell.c},${cell.r}`)) {
      // Don't place on start/end
      if (cell.c === 4 && (cell.r === 0 || cell.r === 6)) return;
      // Already has tower?
      if (gs.towers.some(t => t.col === cell.c && t.row === cell.r)) return;
      const cost = TOWER_TYPES.arrow.cost;
      if (gs.gold >= cost) {
        gs.gold -= cost;
        gs.towers.push(makeTower(cell.c, cell.r, 'arrow'));
        spawnFloaty(`-${cost}💰`, x, y, '#fbbf24');
      } else {
        spawnFloaty('골드 부족!', x, y, '#ef4444');
      }
    }
  }
}

function hitTest(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function screenToCell(x, y) {
  if (y < GRID_OY || y > GRID_OY + GRID_ROWS * CELL_H) return null;
  const c = Math.floor((x - GRID_OX) / CELL_W);
  const r = Math.floor((y - GRID_OY) / CELL_H);
  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return null;
  return { c, r };
}

// ─── Floating Texts ───────────────────────────────────────────────────────────
function spawnFloaty(text, x, y, color) {
  gs.floaties.push({ text, x, y, color, life: 1.2, opacity: 1 });
}

function updateFloaties(dt) {
  for (let i = gs.floaties.length - 1; i >= 0; i--) {
    const f = gs.floaties[i];
    f.life -= dt;
    f.y -= 28 * dt;
    f.opacity = Math.max(0, f.life / 1.2);
    if (f.life <= 0) gs.floaties.splice(i, 1);
  }
}

function renderFloaties(ctx) {
  for (const f of gs.floaties) {
    ctx.globalAlpha = f.opacity;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
function update(dt) {
  if (gs.gameOver || gs.stageCleared) return;

  // Hero revive timer
  if (gs.hero.dead) {
    gs.hero.reviveTimer -= dt;
    if (gs.hero.reviveTimer <= 0) {
      gs.hero.dead = false;
      gs.hero.hp = gs.hero.maxHp;
      spawnFloaty('영웅 부활!', CW / 2, CH / 2, '#22c55e');
    }
  }

  if (!gs.waveActive) {
    wm.updateIntermission(gs, dt);
    return;
  }

  // Wave update (spawning)
  wm.update(gs, dt);

  // Defense enemies
  updateDefenseEnemies(gs.defenseEnemies, dt);

  // Check enemies reaching base
  for (const e of gs.defenseEnemies) {
    if (e.reached && !e._counted) {
      e._counted = true;
      gs.baseHP = Math.max(0, gs.baseHP - e.dmg);
      spawnFloaty(`-${e.dmg} HP`, CW / 2, DEFENSE_Y + DEFENSE_H - 30, '#ef4444');
      if (gs.baseHP <= 0) { gs.gameOver = true; return; }
    }
  }

  // Towers shoot
  updateTowers(gs.towers, gs.defenseEnemies, gs.projectiles, dt);

  // Projectiles
  updateProjectiles(gs.projectiles, (killed) => {
    gs.gold += killed.reward;
    spawnFloaty(`+${killed.reward}💰`, killed.x, killed.y, COLORS.gold);
  }, dt);

  // Battle zone
  updateBattle(gs.mercs, gs.battleEnemies, dt);

  // Remove dead units
  gs.defenseEnemies = gs.defenseEnemies.filter(e => !e.dead && !e.reached);
  gs.battleEnemies  = gs.battleEnemies.filter(e => {
    // If enemy walks off left edge, it doesn't damage anything in battle zone,
    // but we can count it as escaped
    if (e.x < -20) { e.dead = true; return false; }
    return !e.dead;
  });
  gs.mercs = gs.mercs.filter(m => !m.dead);
  gs.projectiles = gs.projectiles.filter(() => true); // projectiles self-clean in updateProjectiles

  // Wave ended?
  if (wm.phase === 'intermission') {
    gs.waveActive = false;
    // auto-advance handled in updateIntermission
  }

  updateFloaties(dt);
}

// ─── Render ───────────────────────────────────────────────────────────────────
let _lastTime = 0;
function gameLoop(ts) {
  const dt = Math.min((ts - _lastTime) / 1000, 0.05); // cap at 50ms
  _lastTime = ts;

  ctx.clearRect(0, 0, CW, CH);

  renderDefense(ctx, gs);
  renderUIBar(ctx, gs, wm);
  renderBattle(ctx, gs, dt);
  renderHUD(ctx, gs);
  renderFloaties(ctx);
  renderTutorial(ctx, tut);

  if (!gs.gameOver && !gs.stageCleared) update(dt);

  requestAnimationFrame(gameLoop);
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame(newStage) {
  const prev = gs;
  gs = createInitialState();

  if (newStage) {
    // Keep hero progress, start fresh wave
    gs.hero = prev.hero;
    gs.hero.dead = false;
    gs.hero.hp = gs.hero.maxHp;
    gs.wave = 0;
    wm.init(0);
    SaveManager.clear();
  } else {
    // Retry: restore pre-wave state from save
    const sv = SaveManager.load();
    if (sv) {
      gs.gold  = sv.gold  || 10;
      gs.baseHP= sv.baseHP|| BASE_HP_MAX;
      gs.wave  = sv.wave  || 0;
      gs.hero.level = sv.heroLevel || 1;
      gs.hero.exp   = sv.heroExp   || 0;
    }
    wm.init(gs.wave);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
requestAnimationFrame(ts => { _lastTime = ts; requestAnimationFrame(gameLoop); });
