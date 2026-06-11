'use strict';

// ─── Canvas Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let _scale   = 1;

function resize() {
  const s = Math.min(window.innerWidth/CW, window.innerHeight/CH);
  canvas.width  = CW; canvas.height = CH;
  canvas.style.width  = `${CW*s}px`;
  canvas.style.height = `${CH*s}px`;
  _scale = s;
}
window.addEventListener('resize', resize);
resize();

// ─── State ────────────────────────────────────────────────────────────────────
function newState() {
  return {
    phase: 1, wave: 0,
    gold: 10, baseHP: BASE_HP_MAX,
    towers: [], defenseEnemies: [], projectiles: [],
    battle: null,
    waveActive: false,
    gameOver: false, stageCleared: false,
    hero: { level:1, exp:0, hp:50, maxHp:50, dead:false, reviveTimer:0 },
    hoveredCell: null,
    floaties: [],
    ui: { waveBtn:{x:0,y:0,w:0,h:0}, hireCards:[], hiredSlots:[] }
  };
}

let gs  = newState();
const wm  = createWaveManager();
const tut = createTutorial();

// Init battle for wave 0
gs.battle = createBattle();
setupEnemyTeam(gs.battle, 0);

// Load save
(function() {
  const sv = SaveManager.load();
  if (!sv) return;
  gs.gold   = sv.gold   || 10;
  gs.baseHP = sv.baseHP || BASE_HP_MAX;
  gs.wave   = sv.wave   || 0;
  gs.hero.level = sv.heroLevel || 1;
  gs.hero.exp   = sv.heroExp   || 0;
  wm.init(gs.wave);
  setupEnemyTeam(gs.battle, gs.wave);
})();

tut.start();

// ─── Input ────────────────────────────────────────────────────────────────────
function pt(e) {
  const r = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x:(t.clientX-r.left)/_scale, y:(t.clientY-r.top)/_scale };
}

canvas.addEventListener('mousemove', e => {
  const p = pt(e);
  gs.hoveredCell = p.y < UIBAR_Y ? screenToCell(p.x, p.y) : null;
});
canvas.addEventListener('mouseleave', () => { gs.hoveredCell = null; });
canvas.addEventListener('click', e => tap(pt(e)));
canvas.addEventListener('touchstart', e => { e.preventDefault(); tap(pt(e)); }, {passive:false});

function tap(p) {
  const { x, y } = p;

  if (tut.active)      { tut.next(); return; }
  if (gs.gameOver)     { resetGame(false); return; }
  if (gs.stageCleared) { resetGame(true);  return; }

  // ── UI Bar: wave start button ──────────────────────────────────────────
  const btn = gs.ui.waveBtn;
  if (hitTest(x,y,btn)) {
    if (wm.phase === 'idle') {
      if (gs.battle.phase === 'hire') {
        // Need at least 1 unit hired or can skip battle part
        wm.startWave(gs);
        gs.waveActive = true;
      }
    }
    return;
  }

  // ── Hire Phase: hire cards ─────────────────────────────────────────────
  if (gs.battle.phase === 'hire') {
    for (const card of gs.ui.hireCards||[]) {
      if (hitTest(x,y,card)) {
        const prev = gs.gold;
        gs.gold = hireUnit(gs.battle, card.typeId, gs.gold);
        if (gs.gold < prev) {
          spawnFloaty(`+${UNIT_TYPES[card.typeId].name}`, card.x+card.w/2, card.y, '#60a5fa');
        } else {
          spawnFloaty('골드 부족!', x, y, '#ef4444');
        }
        return;
      }
    }

    // Hired slots: tap to remove
    for (const slot of gs.ui.hiredSlots||[]) {
      if (hitTest(x,y,slot) && gs.battle.ourTeam[slot.idx]) {
        const refund = fireUnit(gs.battle, slot.idx) || 0;
        gs.gold += refund;
        spawnFloaty(`+${refund}💰`, x, y, COLORS.gold);
        return;
      }
    }
  }

  // ── Defense zone: place tower ──────────────────────────────────────────
  if (y < UIBAR_Y) {
    const cell = screenToCell(x, y);
    if (!cell) return;
    if (PATH_CELLS.has(`${cell.c},${cell.r}`)) return;
    if (cell.c===4 && (cell.r===0||cell.r===6)) return;
    if (gs.towers.some(t => t.col===cell.c && t.row===cell.r)) {
      spawnFloaty('이미 있음', x, y, '#64748b'); return;
    }
    const cost = TOWER_TYPES.arrow.cost;
    if (gs.gold >= cost) {
      gs.gold -= cost;
      gs.towers.push(makeTower(cell.c, cell.r, 'arrow'));
      spawnFloaty(`-${cost}💰`, x, y, COLORS.gold);
    } else {
      spawnFloaty('골드 부족!', x, y, '#ef4444');
    }
  }
}

function hitTest(x,y,r) { return r && x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h; }

function screenToCell(x, y) {
  const c = Math.floor((x-GRID_OX)/CELL_W);
  const r = Math.floor((y-GRID_OY)/CELL_H);
  if (c<0||c>=GRID_COLS||r<0||r>=GRID_ROWS) return null;
  return { c, r };
}

// ─── Floaties ─────────────────────────────────────────────────────────────────
function spawnFloaty(text, x, y, color) {
  gs.floaties.push({text, x, y, color, life:1.2, vy:-28});
}

function updateFloaties(dt) {
  for (let i=gs.floaties.length-1; i>=0; i--) {
    const f = gs.floaties[i];
    f.life -= dt; f.y += f.vy*dt;
    if (f.life<=0) gs.floaties.splice(i,1);
  }
}

function drawFloaties(ctx) {
  for (const f of gs.floaties) {
    ctx.globalAlpha = Math.max(0, f.life/1.2);
    ctx.fillStyle = f.color; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ─── Update ──────────────────────────────────────────────────────────────────
function update(dt) {
  if (gs.gameOver || gs.stageCleared) return;

  // Hero revive
  if (gs.hero.dead) {
    gs.hero.reviveTimer -= dt;
    if (gs.hero.reviveTimer <= 0) {
      gs.hero.dead = false; gs.hero.hp = gs.hero.maxHp;
      spawnFloaty('영웅 부활!', CW/2, CH/2, '#22c55e');
    }
  }

  if (!gs.waveActive) {
    wm.updateIntermission(gs, dt);
    return;
  }

  wm.update(gs, dt);

  // Defense
  updateDefenseEnemies(gs.defenseEnemies, dt);
  for (const e of gs.defenseEnemies) {
    if (e.reached && !e._counted) {
      e._counted = true;
      gs.baseHP = Math.max(0, gs.baseHP - e.dmg);
      spawnFloaty(`-${e.dmg} HP`, CW/2, DEFENSE_H-25, '#ef4444');
      if (gs.baseHP <= 0) { gs.gameOver = true; return; }
    }
  }
  updateTowers(gs.towers, gs.defenseEnemies, gs.projectiles, dt);
  updateProjectiles(gs.projectiles, (killed) => {
    gs.gold += killed.reward;
    spawnFloaty(`+${killed.reward}💰`, killed.x, killed.y, COLORS.gold);
  }, dt);
  gs.defenseEnemies = gs.defenseEnemies.filter(e => !e.dead && !e.reached);

  // Battle
  updateBattle(gs.battle, dt);

  // End wave check (wm handles this internally)
  if (wm.phase === 'intermission') {
    gs.waveActive = false;
  }

  updateFloaties(dt);
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
let _last = 0;
function loop(ts) {
  const dt = Math.min((ts - _last)/1000, 0.05);
  _last = ts;

  ctx.clearRect(0,0,CW,CH);
  renderDefense(ctx, gs);
  renderUIBar(ctx, gs, wm);
  renderBattle(ctx, gs);
  renderHUD(ctx, gs);
  drawFloaties(ctx);
  renderTutorial(ctx, tut);

  update(dt);
  requestAnimationFrame(loop);
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame(nextStage) {
  const hero = gs.hero;
  gs = newState();
  if (nextStage) {
    gs.hero = hero;
    gs.hero.dead = false; gs.hero.hp = gs.hero.maxHp;
    SaveManager.clear();
  } else {
    const sv = SaveManager.load();
    if (sv) {
      gs.gold = sv.gold || 10; gs.baseHP = sv.baseHP || BASE_HP_MAX;
      gs.wave = sv.wave || 0;
      gs.hero.level = sv.heroLevel||1; gs.hero.exp = sv.heroExp||0;
    }
  }
  gs.battle = createBattle();
  setupEnemyTeam(gs.battle, gs.wave);
  wm.init(gs.wave);
}

requestAnimationFrame(ts => { _last=ts; requestAnimationFrame(loop); });
