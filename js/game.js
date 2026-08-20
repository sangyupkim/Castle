'use strict';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let _scale   = 1;

function resize() {
  const s = Math.min(window.innerWidth / CW, window.innerHeight / CH);
  canvas.width = CW; canvas.height = CH;
  canvas.style.width = `${CW * s}px`; canvas.style.height = `${CH * s}px`;
  _scale = s;
}
window.addEventListener('resize', resize);
resize();

// ─── 타이틀 이미지 ───────────────────────────────────────────────────────────
const _titleImg = new Image();
_titleImg.src = 'assets/images/mainpage.png';
let _titleScreen = true;
let _titleAlpha  = 1;

// ─── 세션 설정 (런 리셋과 무관) ──────────────────────────────────────────────
let _paused   = false;
let _speedIdx = 0;
function gameSpeed() { return SPEED_STEPS[_speedIdx]; }

// ─── 영구 데이터 (런 초기화 후에도 유지) ─────────────────────────────────────
let _soulStones   = 0;
let _metaUpgrades = {};
let _stats        = createStats();

// ─── 초기 상태 ────────────────────────────────────────────────────────────────
function newState() {
  return {
    wave: 0,
    gold: 10, baseHP: BASE_HP_MAX,
    caveLevel: 1,
    endless: false,
    towers: [], defenseEnemies: [], projectiles: [],
    battle: null,
    hero: {
      level: 1, exp: 0,
      hp: HERO_LEVELS[1].hp,
      placement: 'none',
      dead: false, reviveTimer: 0,
      defX: GRID_OX + 4 * CELL_W + CELL_W / 2,
      defY: GRID_OY + 3 * CELL_H + CELL_H / 2,
      atkCooldown: 0, hitCooldown: 0
    },
    waveActive: false,
    gameOver: false, stageCleared: false, resultBanked: false,
    showMeta: false,
    upgradePick: { active: false, cards: [] },
    activeUpgrades: [],
    hoveredCell: null,
    selectedTowerType: 'arrow',
    selectedTower: null,
    floaties: [],
    ui: {},
    // 영구 데이터 참조
    get soulStones()   { return _soulStones; },
    set soulStones(v)  { _soulStones = v; },
    get metaUpgrades() { return _metaUpgrades; },
    set metaUpgrades(v){ _metaUpgrades = v; },
    get stats()        { return _stats; },
    set stats(v)       { _stats = v; },
  };
}

let gs  = newState();
const wm  = createWaveManager();
const tut = createTutorial();

gs.battle = createBattle();

// ─── 세이브 로드 ─────────────────────────────────────────────────────────────
(function () {
  const sv = SaveManager.load();
  if (!sv) return;
  _soulStones   = sv.soulStones   || 0;
  _metaUpgrades = sv.metaUpgrades || {};
  _stats        = Object.assign(createStats(), sv.stats || {});
  if (sv.wave === undefined) return;   // 메타 전용 세이브 (진행 상황 없음)

  gs.gold       = sv.gold   !== undefined ? sv.gold   : 10;
  gs.baseHP     = sv.baseHP !== undefined ? sv.baseHP : BASE_HP_MAX;
  gs.wave       = sv.wave   || 0;
  gs.endless    = !!sv.endless;
  gs.hero.level = Math.max(1, Math.min(HERO_MAX_LEVEL, sv.heroLevel || 1));
  gs.hero.exp   = sv.heroExp || 0;
  gs.hero.hp    = HERO_LEVELS[gs.hero.level].hp;
  gs.battle.totalGoldEarned = sv.totalGoldEarned || 0;
  gs.caveLevel  = Math.max(1, Math.min(CAVE_MAX_LEVEL, sv.caveLevel || 1));
  wm.init(gs.wave);
})();

// 메타 업그레이드 및 시작 보너스 적용
resetBonuses();
applyMetaUpgrades(gs);
_applyStartBonuses();

function _applyStartBonuses() {
  gs.gold    += BONUSES.startGoldBonus;
  gs.baseHP   = Math.min(heroBaseMax(), gs.baseHP + BONUSES.baseHpMax);
  gs.hero.exp = Math.min(HERO_LEVELS[gs.hero.level].expNeeded - 1, gs.hero.exp + BONUSES.heroStartExp);
  gs.battle.maxSlots = 4 + BONUSES.maxSlotBonus;
  gs.caveLevel = Math.max(gs.caveLevel, startingCaveLevel(gs));
  setBattleSlotCount(gs.battle.maxSlots);
}

function heroBaseMax()  { return BASE_HP_MAX + BONUSES.baseHpMax; }
function heroMaxHp()    { return Math.round(HERO_LEVELS[gs.hero.level].hp * BONUSES.heroStatMult); }
function heroReviveDur(){ return Math.max(5, HERO_REVIVE_TIME - BONUSES.heroReviveReduction); }

tut.start();

// ─── 입력 ────────────────────────────────────────────────────────────────────
function pt(e) {
  const r = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - r.left) / _scale, y: (t.clientY - r.top) / _scale };
}

canvas.addEventListener('mousemove', e => {
  const p = pt(e);
  gs.hoveredCell = p.y < TOOLBAR_Y ? screenToCell(p.x, p.y) : null;
});
canvas.addEventListener('mouseleave', () => { gs.hoveredCell = null; });
canvas.addEventListener('click', e => tap(pt(e)));
canvas.addEventListener('touchstart', e => { e.preventDefault(); tap(pt(e)); }, { passive: false });

window.addEventListener('keydown', e => {
  if (_titleScreen) { _startFadeOut(); return; }
  if (tut.active)   { tut.next(); return; }
  switch (e.key) {
    case '1': case '2': case '3': case '4': {
      const id = TOWER_ORDER[Number(e.key) - 1];
      if (id) { gs.selectedTowerType = id; gs.selectedTower = null; SFX.click(); }
      break;
    }
    case ' ':
      e.preventDefault();
      if (wm.phase === 'idle' && gs.battle.ourTeam.length) tryStartWave();
      else togglePause();
      break;
    case 'p': case 'P': togglePause(); break;
    case 's': case 'S': cycleSpeed(); break;
    case 'm': case 'M': SFX.toggleMute(); break;
    case 'Escape': gs.selectedTower = null; break;
  }
});

function togglePause() { _paused = !_paused; SFX.click(); }
function cycleSpeed()  { _speedIdx = (_speedIdx + 1) % SPEED_STEPS.length; SFX.click(); }

function tryStartWave() {
  if (wm.phase === 'intermission') { wm.skipIntermission(); return; }
  if (wm.phase !== 'idle') return;
  if (!gs.battle.ourTeam.length) { spawnFloaty('병력이 없습니다!', CW / 2, UIBAR_Y - 10, '#ef4444'); SFX.denied(); return; }
  wm.startWave(gs);
  gs.waveActive = true;
  gs.selectedTower = null;
}

function tap({ x, y }) {
  if (_titleScreen) { SFX.unlock(); _startFadeOut(); return; }
  if (tut.active) { tut.next(); SFX.click(); return; }

  // ── 메타 업그레이드 화면 ──────────────────────────────────────────────────
  if (gs.showMeta) {
    if (hitTest(x, y, gs.ui.metaStartBtn)) {
      gs.showMeta = false;
      resetGame();
      SFX.click();
      return;
    }
    if (hitTest(x, y, gs.ui.metaTutBtn)) { tut.replay(); return; }
    for (const card of gs.ui.metaCards || []) {
      if (hitTest(x, y, card)) {
        if (buyMetaUpgrade(card.upg, gs)) {
          SaveManager.saveMetaOnly(gs);
          spawnFloaty(`${card.upg.icon} 구매!`, x, y, '#a78bfa');
          SFX.upgrade();
        } else {
          spawnFloaty('영혼석 부족!', x, y, '#ef4444');
          SFX.denied();
        }
        return;
      }
    }
    return;
  }

  if (gs.gameOver)     { gs.showMeta = true; SFX.click(); return; }
  if (gs.stageCleared) {
    if (hitTest(x, y, gs.ui.clearEndlessBtn)) { startEndless(); return; }
    gs.showMeta = true; SFX.click(); return;
  }

  // ── 업그레이드 픽 화면 ────────────────────────────────────────────────────
  if (gs.upgradePick.active) {
    for (const card of gs.ui.upgradeCards || []) {
      if (hitTest(x, y, card)) {
        applyUpgradeCard(card.card, gs);
        wm.confirmPick(gs);
        gs.waveActive = false;
        spawnFloaty(`${card.card.icon} ${card.card.name}`, CW / 2, 260, '#a5b4fc');
        SFX.upgrade();
        return;
      }
    }
    return;
  }

  // ── 툴바 (타워 팔레트 / 컨트롤) ──────────────────────────────────────────
  if (y >= TOOLBAR_Y && y < UIBAR_Y) {
    if (hitTest(x, y, gs.ui.ctrlPause)) { togglePause(); return; }
    if (hitTest(x, y, gs.ui.ctrlSpeed)) { cycleSpeed();  return; }
    if (hitTest(x, y, gs.ui.ctrlMute))  { SFX.toggleMute(); return; }

    if (gs.selectedTower) {
      if (hitTest(x, y, gs.ui.towerUpBtn))     { doUpgradeTower(); return; }
      if (hitTest(x, y, gs.ui.towerSellBtn))   { doSellTower();    return; }
      if (hitTest(x, y, gs.ui.towerCancelBtn)) { gs.selectedTower = null; SFX.click(); return; }
      return;
    }
    for (const b of gs.ui.towerBtns || []) {
      if (hitTest(x, y, b)) { gs.selectedTowerType = b.typeId; SFX.click(); return; }
    }
    return;
  }

  // ── 웨이브 시작 버튼 ────────────────────────────────────────────────────
  if (hitTest(x, y, gs.ui.waveBtn)) { tryStartWave(); return; }

  // ── 고용 화면 전용 조작 ───────────────────────────────────────────────────
  if (gs.battle.phase === 'hire' && wm.phase !== 'active') {
    if (gs.ui.caveBtn && hitTest(x, y, gs.ui.caveBtn)) { doCaveUpgrade(x, y); return; }
    if (hitTest(x, y, gs.ui.heroDefBtn)) {
      gs.hero.placement = gs.hero.placement === 'defense' ? 'none' : 'defense';
      if (gs.hero.placement === 'defense') {
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u => !u.isHero);
      }
      SFX.click();
      return;
    }
    if (hitTest(x, y, gs.ui.heroBatBtn)) {
      if (gs.hero.placement === 'battle') {
        gs.hero.placement = 'none';
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u => !u.isHero);
      } else if (gs.hero.dead) {
        spawnFloaty('영웅이 부활 중입니다', x, y, '#ef4444'); SFX.denied(); return;
      } else {
        gs.hero.placement = 'battle';
        if (!gs.battle.ourTeam.some(u => u.isHero)) {
          gs.battle.ourTeam.unshift(makeHeroUnit(gs.hero));
        }
      }
      SFX.click();
      return;
    }
  }

  // ── 병력 고용 / 해고 ─────────────────────────────────────────────────────
  if (gs.battle.phase === 'hire') {
    for (const card of gs.ui.hireCards || []) {
      if (hitTest(x, y, card)) {
        const prev = gs.gold;
        gs.gold = hireUnit(gs.battle, card.typeId, gs.gold);
        if (gs.gold < prev) {
          spawnFloaty(`+${UNIT_TYPES[card.typeId].name}`, card.x + card.w / 2, card.y, '#60a5fa');
          SFX.hire();
        } else {
          const full = gs.battle.ourTeam.filter(u => !u.isHero).length >= gs.battle.maxSlots;
          spawnFloaty(full ? '슬롯이 가득 참!' : '골드 부족!', x, y, '#ef4444');
          SFX.denied();
        }
        return;
      }
    }
    for (const slot of gs.ui.hiredSlots || []) {
      if (hitTest(x, y, slot)) {
        const units = gs.battle.ourTeam.filter(u => !u.isHero);
        if (units[slot.idx]) {
          const ref = fireUnit(gs.battle, gs.battle.ourTeam.indexOf(units[slot.idx]));
          gs.gold += ref;
          if (ref > 0) { spawnFloaty(`+${ref}💰`, x, y, COLORS.gold); SFX.sell(); }
        }
        return;
      }
    }
  }

  // ── 상단 방어 구역 ───────────────────────────────────────────────────────
  if (y < TOOLBAR_Y) {
    const cell = screenToCell(x, y);
    if (!cell) { gs.selectedTower = null; return; }

    // 이미 세워진 타워 → 선택 (업그레이드/판매)
    const existing = gs.towers.find(t => t.col === cell.c && t.row === cell.r);
    if (existing) {
      gs.selectedTower = gs.selectedTower === existing ? null : existing;
      SFX.click();
      return;
    }
    gs.selectedTower = null;

    // 경로 칸 → 영웅 배치 이동
    if (PATH_CELLS.has(`${cell.c},${cell.r}`)) {
      if (gs.hero.placement === 'defense') {
        const c = cellCenter(cell.c, cell.r);
        gs.hero.defX = c.x; gs.hero.defY = c.y;
        spawnFloaty('👑 이동', c.x, c.y - 18, COLORS.hero);
        SFX.click();
      }
      return;
    }
    if (isBlockedCell(cell.c, cell.r)) return;

    buildTower(cell, x, y);
  }
}

// ─── 타워 건설 / 업그레이드 / 판매 ───────────────────────────────────────────
function buildTower(cell, x, y) {
  const typeId = gs.selectedTowerType;
  const cost   = towerBuildCost(typeId, gs.towers);
  if (gs.gold < cost) { spawnFloaty('골드 부족!', x, y, '#ef4444'); SFX.denied(); return; }
  gs.gold -= cost;
  const t = makeTower(cell.c, cell.r, typeId);
  t.invested = cost;
  gs.towers.push(t);
  const c = cellCenter(cell.c, cell.r);
  spawnFloaty(`-${cost}💰`, x, y, COLORS.gold);
  FX.ring(c.x, c.y, TOWER_TYPES[typeId].color, 8);
  SFX.build();
}

function doUpgradeTower() {
  const t = gs.selectedTower;
  if (!t) return;
  const cost = towerUpgradeCost(t);
  if (cost === null) { spawnFloaty('최대 레벨!', CW / 2, TOOLBAR_Y - 10, '#f59e0b'); SFX.denied(); return; }
  if (gs.gold < cost) { spawnFloaty('골드 부족!', CW / 2, TOOLBAR_Y - 10, '#ef4444'); SFX.denied(); return; }
  gs.gold -= cost;
  t.invested += cost;
  upgradeTower(t);
  const c = cellCenter(t.col, t.row);
  spawnFloaty(`Lv.${t.level}!`, c.x, c.y - 14, '#22c55e');
  FX.ring(c.x, c.y, '#22c55e', 9);
  SFX.upgrade();
}

function doSellTower() {
  const t = gs.selectedTower;
  if (!t) return;
  const value = towerSellValue(t);
  gs.gold += value;
  gs.towers.splice(gs.towers.indexOf(t), 1);
  gs.selectedTower = null;
  const c = cellCenter(t.col, t.row);
  spawnFloaty(`+${value}💰`, c.x, c.y - 14, COLORS.gold);
  SFX.sell();
}

function doCaveUpgrade(x, y) {
  const nextLv = gs.caveLevel + 1;
  if (nextLv > CAVE_MAX_LEVEL) return;
  const cost = CAVE_LEVELS[nextLv].upgradeCost;
  if (gs.gold < cost) { spawnFloaty('골드 부족!', x, y, '#ef4444'); SFX.denied(); return; }
  gs.gold -= cost;
  gs.caveLevel = nextLv;
  spawnFloaty(`🗿 케이브 Lv.${nextLv}!`, CW / 2, BATTLE_Y + 40, '#a78bfa');
  SFX.upgrade();
}

function hitTest(x, y, r) { return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

function screenToCell(x, y) {
  const c = Math.floor((x - GRID_OX) / CELL_W), r = Math.floor((y - GRID_OY) / CELL_H);
  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return null;
  return { c, r };
}

// ─── 플로티 ──────────────────────────────────────────────────────────────────
function spawnFloaty(text, x, y, color) {
  gs.floaties.push({ text, x, y, color, life: 1.2, vy: -28 });
}
function updateFloaties(dt) {
  for (let i = gs.floaties.length - 1; i >= 0; i--) {
    const f = gs.floaties[i]; f.life -= dt; f.y += f.vy * dt;
    if (f.life <= 0) gs.floaties.splice(i, 1);
  }
}
function drawFloaties(ctx) {
  for (const f of gs.floaties) {
    ctx.globalAlpha = Math.max(0, f.life / 1.2);
    ctx.fillStyle = f.color; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ─── 상단 처치 보상 ──────────────────────────────────────────────────────────
function onDefenseKill(e, byHero) {
  const tpl  = ENEMY_TYPES[e.typeId] || {};
  const gold = Math.max(1, Math.round((e.reward || 1) * BONUSES.defenseGoldMult));
  gs.gold += gold;
  gs.battle.totalGoldEarned += gold;
  gs.battle.runKills = (gs.battle.runKills || 0) + 1;
  gs.stats.totalKills++;
  spawnFloaty(`+${gold}💰`, e.x, e.y - 14, COLORS.gold);
  FX.burst(e.x, e.y, tpl.color || '#fff', 12, 14);
  SFX.kill();

  // 영웅이 상단에 있으면 경험치. 직접 처치는 전액, 타워 처치는 40%
  if (gs.hero.placement === 'defense' && !gs.hero.dead) {
    const exp = (tpl.reward || 2) * BONUSES.heroExpMult * (byHero ? 1 : 0.4);
    if (exp >= 1) {
      heroGainExp(exp);
      spawnFloaty(`EXP+${Math.floor(exp)}`, gs.hero.defX, gs.hero.defY - 26, '#f59e0b');
    }
  }
}

// ─── 영웅 (상단 배치) ────────────────────────────────────────────────────────
function updateHeroDefense(dt) {
  const hero = gs.hero;
  if (hero.placement !== 'defense' || hero.dead) return;
  const lv = HERO_LEVELS[hero.level];

  // 공격
  hero.atkCooldown = Math.max(0, hero.atkCooldown - dt);
  if (hero.atkCooldown <= 0) {
    const best = pickTarget(gs.defenseEnemies, { x: hero.defX, y: hero.defY }, lv.range, 'nearest');
    if (best) {
      hero.atkCooldown = 1.0;
      const atk = Math.round((lv.atk + BONUSES.heroAtk) * BONUSES.heroStatMult);
      hurtDefenseEnemy(best, atk, false, e => onDefenseKill(e, true));
      gs.projectiles.push({
        x: hero.defX, y: hero.defY, tx: best.x, ty: best.y,
        target: best, dmg: 0, color: '#f59e0b', spd: 420, visual: true
      });
      SFX.shoot();
    }
  }

  // 근접한 적의 반격
  hero.hitCooldown = Math.max(0, hero.hitCooldown - dt);
  if (hero.hitCooldown <= 0) {
    let incoming = 0;
    for (const e of gs.defenseEnemies) {
      if (e.dead || e.reached) continue;
      if (Math.hypot(e.x - hero.defX, e.y - hero.defY) < CELL_W * 0.75) incoming += e.dmg;
    }
    if (incoming > 0) {
      hero.hitCooldown = 1.0;
      const def  = Math.round(lv.def * BONUSES.heroStatMult);
      const real = Math.max(1, incoming - def);
      hero.hp -= real;
      spawnFloaty(`-${real}`, hero.defX, hero.defY - 18, '#ef4444');
      FX.burst(hero.defX, hero.defY, '#ef4444', 5, 10);
      if (hero.hp <= 0) killHero(gs);
    }
  }
}

function killHero(state) {
  const hero = state.hero;
  if (hero.dead) return;
  hero.dead = true;
  hero.hp = 0;
  hero.placement = 'none';
  hero.reviveTimer = BONUSES.heroInstantRevive ? 0 : heroReviveDur();
  state.battle.ourTeam = state.battle.ourTeam.filter(u => !u.isHero);
  spawnFloaty('👑 영웅 전사!', CW / 2, DEFENSE_H / 2, '#ef4444');
  addLog(state.battle, '👑 영웅이 쓰러졌습니다', '#ef4444');
  FX.shake(7, 0.4);
  SFX.lose();
}

function heroGainExp(amount) {
  const hero = gs.hero;
  hero.exp += amount;
  while (hero.level < HERO_MAX_LEVEL && hero.exp >= HERO_LEVELS[hero.level].expNeeded) {
    hero.exp -= HERO_LEVELS[hero.level].expNeeded;
    hero.level++;
    hero.hp = heroMaxHp();
    spawnFloaty(`영웅 레벨업! Lv.${hero.level}`, CW / 2, DEFENSE_H / 2, '#f59e0b');
    addLog(gs.battle, `👑 영웅이 Lv.${hero.level}로 성장!`, COLORS.hero);
    FX.ring(CW / 2, DEFENSE_H / 2, COLORS.hero, 18);
    SFX.levelUp();
  }
}

// ─── 타이틀 페이드아웃 ───────────────────────────────────────────────────────
let _fadingOut = false;
function _startFadeOut() { _fadingOut = true; }

// ─── 런 종료 처리 ────────────────────────────────────────────────────────────
function bankRunResult() {
  if (gs.resultBanked) return;
  gs.resultBanked = true;
  const earned = calcSoulStones(gs);
  _soulStones += earned;
  gs.stats.runs++;
  gs.stats.bestWave = Math.max(gs.stats.bestWave, gs.wave + (gs.stageCleared ? 1 : 0));
  gs.stats.bestSoul = Math.max(gs.stats.bestSoul, earned);
  gs.stats.totalGold += gs.battle.totalGoldEarned;
  gs.lastSoulEarned = earned;
  SaveManager.saveMetaOnly(gs);
}

function startEndless() {
  gs.endless = true;
  gs.stageCleared = false;
  gs.resultBanked = false;
  gs.wave = STAGE_WAVES;
  wm.init(gs.wave);
  spawnFloaty('♾️ 무한 모드 시작!', CW / 2, CH / 2, '#a78bfa');
  SFX.waveStart();
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function update(dt) {
  if (_fadingOut) {
    _titleAlpha = Math.max(0, _titleAlpha - dt * 1.8);
    if (_titleAlpha <= 0) { _titleScreen = false; _fadingOut = false; }
    return;
  }
  if (_titleScreen) return;

  FX.update(dt);

  if (gs.gameOver || gs.stageCleared) { bankRunResult(); updateFloaties(dt); return; }
  if (gs.showMeta) { updateFloaties(dt); return; }
  if (gs.upgradePick.active) { updateFloaties(dt); return; }

  // 영웅 부활 대기
  if (gs.hero.dead) {
    gs.hero.reviveTimer = Math.max(0, gs.hero.reviveTimer - dt);
    if (gs.hero.reviveTimer <= 0) {
      gs.hero.dead = false;
      gs.hero.hp = heroMaxHp();
      spawnFloaty('👑 영웅 부활!', CW / 2, DEFENSE_H / 2, '#22c55e');
      SFX.levelUp();
    }
  }

  if (!gs.waveActive) { wm.updateIntermission(gs, dt); updateFloaties(dt); return; }

  wm.update(gs, dt);

  // 상단 방어
  updateDefenseEnemies(gs.defenseEnemies, dt);
  for (const e of gs.defenseEnemies) {
    if (e.reached && !e._counted) {
      e._counted = true;
      const dmg = Math.max(1, Math.round(e.dmg * (1 - BONUSES.baseDefPct)));
      gs.baseHP = Math.max(0, gs.baseHP - dmg);
      spawnFloaty(`-${dmg}HP`, CW / 2, DEFENSE_H - 25, '#ef4444');
      FX.shake(Math.min(8, 2 + dmg * 0.2), 0.3);
      SFX.baseHit();
      if (gs.baseHP <= 0) {
        gs.gameOver = true;
        bankRunResult();
        return;
      }
    }
  }

  // 기지 재생
  if (BONUSES.baseRegen > 0) {
    gs.baseHP = Math.min(heroBaseMax(), gs.baseHP + BONUSES.baseRegen * dt);
  }

  updateTowers(gs.towers, gs.defenseEnemies, gs.projectiles, dt);
  updateProjectiles(gs.projectiles, e => onDefenseKill(e, false), dt);
  gs.defenseEnemies = gs.defenseEnemies.filter(e => !e.dead && !e.reached);

  updateHeroDefense(dt);
  updateBattle(gs.battle, dt);

  if (wm.phase !== 'active') gs.waveActive = false;

  updateFloaties(dt);
}

// ─── 렌더 루프 ────────────────────────────────────────────────────────────────
let _last = 0;
function loop(ts) {
  const dt = Math.min((ts - _last) / 1000, 0.05); _last = ts;

  ctx.clearRect(0, 0, CW, CH);
  const [sx, sy] = FX.shakeOffset();
  ctx.save();
  ctx.translate(sx, sy);

  renderDefense(ctx, gs);
  renderToolbar(ctx, gs);
  renderUIBar(ctx, gs, wm);
  renderBattle(ctx, gs);
  FX.draw(ctx);
  ctx.restore();

  renderHUD(ctx, gs);
  if (gs.upgradePick.active) renderUpgradePick(ctx, gs);
  if (gs.showMeta) renderMetaScreen(ctx, gs);
  drawFloaties(ctx);
  if (_paused && !_titleScreen && !tut.active) renderPauseOverlay(ctx);
  renderTutorial(ctx, tut);
  if (_titleScreen || _fadingOut) renderTitleScreen(ctx, _titleAlpha);

  const canRun = !_paused || _titleScreen || _fadingOut;
  if (canRun) {
    const steps = _titleScreen || _fadingOut ? 1 : gameSpeed();
    for (let i = 0; i < steps; i++) update(dt);
  } else {
    FX.update(dt);
    updateFloaties(dt);
  }

  requestAnimationFrame(loop);
}

// ─── 리셋 ────────────────────────────────────────────────────────────────────
function resetGame() {
  gs = newState();
  gs.battle = createBattle();
  FX.clear();

  resetBonuses();
  applyMetaUpgrades(gs);
  _applyStartBonuses();
  _paused = false;
  SaveManager.saveMetaOnly(gs);
  wm.init(0);
}

// ─── 시작 ────────────────────────────────────────────────────────────────────
requestAnimationFrame(ts => { _last = ts; requestAnimationFrame(loop); });
