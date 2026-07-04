'use strict';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let _scale   = 1;

function getViewport() {
  // visualViewport가 있으면 사용 (모바일 브라우저 주소창 제외한 실제 높이)
  if (window.visualViewport) {
    return { w: window.visualViewport.width, h: window.visualViewport.height };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vp  = getViewport();
  const s   = Math.min(vp.w / CW, vp.h / CH);
  canvas.width  = Math.round(CW * dpr);
  canvas.height = Math.round(CH * dpr);
  canvas.style.width  = `${CW * s}px`;
  canvas.style.height = `${CH * s}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  _scale = s;
}
window.addEventListener('resize', resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
}
resize();

// ─── 타이틀 이미지 ───────────────────────────────────────────────────────────
const _titleImg = new Image();
_titleImg.src = 'assets/images/mainpage.png';
let _titleScreen = true;  // 앱 시작 시 타이틀 화면 표시
let _titleAlpha  = 1;     // 페이드아웃용

// ─── 영구 데이터 (런 초기화 후에도 유지) ─────────────────────────────────────
let _soulStones   = 0;
let _metaUpgrades = {};

// ─── 초기 상태 ────────────────────────────────────────────────────────────────
function newState() {
  return {
    phase:1, wave:0,
    gold:10, baseHP:BASE_HP_MAX,
    caveLevel:1,
    towers:[], defenseEnemies:[], projectiles:[],
    battle: null,
    hero: {
      level:1, exp:0,
      hp: HERO_LEVELS[1].hp,
      placement:'none',
      dead:false, reviveTimer:0,
      defX: GRID_OX + 4*CELL_W + CELL_W/2,
      defY: GRID_OY + 3*CELL_H + CELL_H/2,
      atkCooldown:0
    },
    waveActive:false,
    gameOver:false, stageCleared:false,
    showMeta:false,
    upgradePick: { active:false, cards:[] },
    activeUpgrades: [],
    hoveredCell:null,
    floaties:[],
    ui:{ waveBtn:{}, hireCards:[], hiredSlots:[], heroDefBtn:{}, heroBatBtn:{}, metaCards:[], metaStartBtn:{} },
    // 영구 데이터 참조
    get soulStones()   { return _soulStones; },
    set soulStones(v)  { _soulStones = v; },
    get metaUpgrades() { return _metaUpgrades; },
    set metaUpgrades(v){ _metaUpgrades = v; },
  };
}

let gs  = newState();
const wm  = createWaveManager();
const tut = createTutorial();

gs.battle = createBattle();

// 세이브 로드
(function(){
  const sv = SaveManager.load();
  if (!sv) return;
  gs.gold       = sv.gold   || 10;
  gs.baseHP     = sv.baseHP || BASE_HP_MAX;
  gs.wave       = sv.wave   || 0;
  gs.hero.level = Math.max(1, Math.min(5, sv.heroLevel||1));
  gs.hero.exp   = sv.heroExp || 0;
  gs.hero.hp    = HERO_LEVELS[gs.hero.level].hp;
  gs.battle.totalGoldEarned = sv.totalGoldEarned || 0;
  gs.caveLevel  = Math.max(1, Math.min(5, sv.caveLevel||1));
  _soulStones   = sv.soulStones   || 0;
  _metaUpgrades = sv.metaUpgrades || {};
  wm.init(gs.wave);
})();

// 메타 업그레이드 및 시작 보너스 적용
resetBonuses();
applyMetaUpgrades(gs);
_applyStartBonuses();

function _applyStartBonuses() {
  gs.gold    += BONUSES.startGoldBonus;
  gs.baseHP   = Math.min(BASE_HP_MAX + BONUSES.baseHpMax, gs.baseHP + BONUSES.baseHpMax);
  gs.hero.exp = Math.min(HERO_LEVELS[gs.hero.level].expNeeded - 1, gs.hero.exp + BONUSES.heroStartExp);
  gs.battle.maxSlots = 4 + BONUSES.maxSlotBonus;
}

tut.start();

// ─── 입력 ────────────────────────────────────────────────────────────────────
function pt(e) {
  const r=canvas.getBoundingClientRect();
  const t=e.touches?e.touches[0]:e;
  return {x:(t.clientX-r.left)/_scale, y:(t.clientY-r.top)/_scale};
}

canvas.addEventListener('mousemove', e => {
  const p=pt(e);
  gs.hoveredCell = p.y<UIBAR_Y ? screenToCell(p.x,p.y) : null;
});
canvas.addEventListener('mouseleave', ()=>{ gs.hoveredCell=null; });
canvas.addEventListener('click', e=>tap(pt(e)));
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); tap(pt(e)); },{passive:false});

function tap({x,y}) {
  if (_titleScreen) { _startFadeOut(); return; }
  if (tut.active) { tut.next(); return; }

  // ── 메타 업그레이드 화면 ──────────────────────────────────────────────────
  if (gs.showMeta) {
    // 시작 버튼
    if (hitTest(x,y,gs.ui.metaStartBtn)) {
      gs.showMeta = false;
      resetGame(false);
      return;
    }
    // 카드 클릭
    for (const card of gs.ui.metaCards||[]) {
      if (hitTest(x,y,card)) {
        if (buyMetaUpgrade(card.upg, gs)) {
          SaveManager.save(gs);
          spawnFloaty(`${card.upg.icon} 구매!`, x, y, '#a78bfa');
        } else {
          spawnFloaty('영혼석 부족!', x, y, '#ef4444');
        }
        return;
      }
    }
    return;
  }

  if (gs.gameOver) {
    // 게임오버 → 메타 화면으로
    gs.showMeta = true;
    return;
  }
  if (gs.stageCleared) {
    gs.showMeta = true;
    return;
  }

  // ── 업그레이드 픽 화면 ────────────────────────────────────────────────────
  if (gs.upgradePick.active) {
    for (const card of gs.ui.upgradeCards||[]) {
      if (hitTest(x,y,card)) {
        applyUpgradeCard(card.card, gs);
        wm.confirmPick(gs);
        gs.upgradePick = { active:false, cards:[] };
        gs.waveActive = false;
        return;
      }
    }
    return;
  }

  // ── 웨이브 시작 버튼 ────────────────────────────────────────────────────
  if (hitTest(x,y,gs.ui.waveBtn)) {
    if (wm.phase==='idle' && gs.battle.ourTeam.length>0) {
      wm.startWave(gs);
      gs.waveActive=true;
    }
    return;
  }

  // ── 영웅 배치 버튼 (고용 화면에서만) ────────────────────────────────────
  if (gs.battle.phase==='hire' && wm.phase==='idle') {
    // 케이브 업그레이드
    if (gs.ui.caveBtn && hitTest(x,y,gs.ui.caveBtn)) {
      const nextLv = gs.caveLevel + 1;
      if (nextLv <= 5) {
        const cost = CAVE_LEVELS[nextLv].upgradeCost;
        if (gs.gold >= cost) {
          gs.gold -= cost;
          gs.caveLevel = nextLv;
          spawnFloaty(`🗿 케이브 Lv.${nextLv}!`, CW/2, BATTLE_Y+40, '#a78bfa');
        } else {
          spawnFloaty('골드 부족!', x, y, '#ef4444');
        }
      }
      return;
    }
    if (hitTest(x,y,gs.ui.heroDefBtn)) {
      gs.hero.placement = gs.hero.placement==='defense' ? 'none' : 'defense';
      if (gs.hero.placement==='defense') {
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u=>!u.isHero);
      }
      return;
    }
    if (hitTest(x,y,gs.ui.heroBatBtn)) {
      if (gs.hero.placement==='battle') {
        gs.hero.placement='none';
        gs.battle.ourTeam = gs.battle.ourTeam.filter(u=>!u.isHero);
      } else {
        gs.hero.placement='battle';
        if (!gs.battle.ourTeam.some(u=>u.isHero)) {
          gs.battle.ourTeam.unshift(makeHeroUnit(gs.hero));
        }
      }
      return;
    }
  }

  // ── 병력 고용 카드 ───────────────────────────────────────────────────────
  if (gs.battle.phase==='hire') {
    for (const card of gs.ui.hireCards||[]) {
      if (hitTest(x,y,card)) {
        const prev=gs.gold;
        gs.gold=hireUnit(gs.battle,card.typeId,gs.gold);
        if (gs.gold<prev) spawnFloaty(`+${UNIT_TYPES[card.typeId].name}`,card.x+card.w/2,card.y,'#60a5fa');
        else spawnFloaty('골드 부족!',x,y,'#ef4444');
        return;
      }
    }
    for (const slot of gs.ui.hiredSlots||[]) {
      if (hitTest(x,y,slot)) {
        const units = gs.battle.ourTeam.filter(u=>!u.isHero);
        if (units[slot.idx]) {
          const ref = fireUnit(gs.battle, gs.battle.ourTeam.indexOf(units[slot.idx]));
          gs.gold+=ref;
          if (ref>0) spawnFloaty(`+${ref}💰`,x,y,COLORS.gold);
        }
        return;
      }
    }
  }

  // ── 상단 타워 건설 ───────────────────────────────────────────────────────
  if (y<UIBAR_Y) {
    const cell=screenToCell(x,y);
    if (!cell) return;
    if (PATH_CELLS.has(`${cell.c},${cell.r}`)) return;
    if (cell.c===4&&(cell.r===0||cell.r===6)) return;
    if (gs.towers.some(t=>t.col===cell.c&&t.row===cell.r)) {
      spawnFloaty('이미 있음',x,y,'#64748b'); return;
    }
    const cost=TOWER_TYPES.arrow.cost - BONUSES.towerCostDiscount;
    if (gs.gold>=cost) {
      gs.gold-=cost;
      gs.towers.push(makeTower(cell.c,cell.r,'arrow'));
      spawnFloaty(`-${cost}💰`,x,y,COLORS.gold);
    } else {
      spawnFloaty('골드 부족!',x,y,'#ef4444');
    }
  }
}

function hitTest(x,y,r){ return r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h; }

function screenToCell(x,y) {
  const c=Math.floor((x-GRID_OX)/CELL_W), r=Math.floor((y-GRID_OY)/CELL_H);
  if(c<0||c>=GRID_COLS||r<0||r>=GRID_ROWS) return null;
  return {c,r};
}

// ─── 플로티 ──────────────────────────────────────────────────────────────────
function spawnFloaty(text,x,y,color) {
  gs.floaties.push({text,x,y,color,life:1.2,vy:-28});
}
function updateFloaties(dt) {
  for(let i=gs.floaties.length-1;i>=0;i--) {
    const f=gs.floaties[i]; f.life-=dt; f.y+=f.vy*dt;
    if(f.life<=0) gs.floaties.splice(i,1);
  }
}
function drawFloaties(ctx) {
  for(const f of gs.floaties) {
    ctx.globalAlpha=Math.max(0,f.life/1.2);
    ctx.fillStyle=f.color; ctx.font='bold 13px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

// ─── 영웅 방어 구역 공격 ─────────────────────────────────────────────────────
function updateHeroDefense(dt) {
  const hero=gs.hero;
  if (hero.placement!=='defense'||hero.dead) return;
  const lv=HERO_LEVELS[hero.level];

  hero.atkCooldown=Math.max(0,hero.atkCooldown-dt);
  if (hero.atkCooldown>0) return;

  let best=null, bestD=Infinity;
  for (const e of gs.defenseEnemies) {
    if (e.dead||e.reached) continue;
    const d=Math.hypot(e.x-hero.defX, e.y-hero.defY);
    if (d<=lv.range&&d<bestD) { best=e; bestD=d; }
  }
  if (!best) return;

  hero.atkCooldown=1.0;
  best.hp-=lv.atk;
  if (best.hp<=0) {
    best.dead=true;
    const expGain = (ENEMY_TYPES[best.typeId]?.reward || 2) * BONUSES.heroExpMult;
    heroGainExp(expGain);
    spawnFloaty(`EXP+${Math.floor(expGain)}`,hero.defX,hero.defY-20,'#f59e0b');
  }
  gs.projectiles.push({
    x:hero.defX, y:hero.defY, tx:best.x, ty:best.y,
    target:best, dmg:0, color:'#f59e0b', spd:350, _heroShot:true
  });
}

function heroGainExp(amount) {
  const hero=gs.hero;
  hero.exp+=amount;
  const lv=HERO_LEVELS[hero.level];
  if (hero.level<5&&hero.exp>=lv.expNeeded) {
    hero.exp-=lv.expNeeded;
    hero.level++;
    hero.hp=HERO_LEVELS[hero.level].hp;
    spawnFloaty(`영웅 레벨업! Lv.${hero.level}`,CW/2,DEFENSE_H/2,'#f59e0b');
    addLog(gs.battle,`👑 영웅이 Lv.${hero.level}로 성장!`,COLORS.hero);
  }
}

// ─── 타이틀 페이드아웃 ───────────────────────────────────────────────────────
let _fadingOut = false;
function _startFadeOut() {
  if (_fadingOut) return;
  _fadingOut = true;
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function update(dt) {
  // 타이틀 페이드아웃
  if (_fadingOut) {
    _titleAlpha = Math.max(0, _titleAlpha - dt * 1.8);
    if (_titleAlpha <= 0) { _titleScreen = false; _fadingOut = false; }
    return;
  }
  if (_titleScreen) return;

  if (gs.gameOver||gs.stageCleared||gs.showMeta) return;
  if (gs.upgradePick.active) { updateFloaties(dt); return; }

  // 영웅 부활
  if (gs.hero.dead) {
    const revTime = Math.max(5, 30 - BONUSES.heroReviveReduction);
    gs.hero.reviveTimer-=dt;
    if (gs.hero.reviveTimer<=0) {
      if (BONUSES.heroInstantRevive || gs.hero.reviveTimer <= -revTime) {
        gs.hero.dead=false;
        gs.hero.hp=HERO_LEVELS[gs.hero.level].hp;
        spawnFloaty('영웅 부활!',CW/2,DEFENSE_H/2,'#22c55e');
      }
    }
  }

  if (!gs.waveActive) { wm.updateIntermission(gs,dt); updateFloaties(dt); return; }

  wm.update(gs,dt);

  // 상단 방어
  updateDefenseEnemies(gs.defenseEnemies,dt);
  for (const e of gs.defenseEnemies) {
    if (e.reached&&!e._counted) {
      e._counted=true;
      const dmg = Math.max(1, Math.round(e.dmg * (1 - BONUSES.baseDefPct)));
      gs.baseHP=Math.max(0,gs.baseHP-dmg);
      spawnFloaty(`-${dmg}HP`,CW/2,DEFENSE_H-25,'#ef4444');
      if (gs.baseHP<=0) {
        gs.gameOver=true;
        const earned = calcSoulStones(gs);
        _soulStones += earned;
        SaveManager.save(gs);
        return;
      }
    }
  }

  // 기지 재생
  if (BONUSES.baseRegen > 0) {
    gs.baseHP = Math.min(BASE_HP_MAX + BONUSES.baseHpMax, gs.baseHP + BONUSES.baseRegen * dt);
  }

  updateTowers(gs.towers,gs.defenseEnemies,gs.projectiles,dt);
  updateProjectiles(gs.projectiles,()=>{},dt);
  gs.defenseEnemies=gs.defenseEnemies.filter(e=>!e.dead&&!e.reached);

  updateHeroDefense(dt);
  updateBattle(gs.battle,dt);

  if (wm.phase==='intermission') gs.waveActive=false;

  updateFloaties(dt);
}

// ─── 렌더 루프 ────────────────────────────────────────────────────────────────
let _last=0;
function loop(ts) {
  const dt=Math.min((ts-_last)/1000,0.05); _last=ts;
  ctx.clearRect(0,0,CW,CH);
  renderDefense(ctx,gs);
  renderUIBar(ctx,gs,wm);
  renderBattle(ctx,gs);
  renderHUD(ctx,gs);
  if (gs.upgradePick.active) renderUpgradePick(ctx,gs);
  if (gs.showMeta) renderMetaScreen(ctx,gs);
  drawFloaties(ctx);
  renderTutorial(ctx,tut);
  if (_titleScreen || _fadingOut) renderTitleScreen(ctx, _titleAlpha);
  update(dt);
  requestAnimationFrame(loop);
}

// ─── 리셋 ────────────────────────────────────────────────────────────────────
function resetGame(fromMeta) {
  const hero = gs.hero;
  const cave = gs.caveLevel;
  gs = newState();
  gs.battle = createBattle();
  gs.caveLevel = cave;

  if (fromMeta) {
    // 스테이지 클리어 후 계속 (영웅 이어받기)
    gs.hero = hero;
    gs.hero.dead = false;
    gs.hero.hp = HERO_LEVELS[gs.hero.level].hp;
    gs.hero.placement = 'none';
    SaveManager.clear();
  }

  resetBonuses();
  applyMetaUpgrades(gs);
  _applyStartBonuses();
  wm.init(gs.wave);
}

// ─── 시작 ────────────────────────────────────────────────────────────────────
requestAnimationFrame(ts=>{ _last=ts; requestAnimationFrame(loop); });
