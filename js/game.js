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
  // 최소 DPR 2 강제: PC(DPR=1)에서도 2배 고해상도 렌더링으로 텍스트 선명도 확보
  const dpr = Math.max(2, window.devicePixelRatio || 1);
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

// ─── 세션 설정 (런 리셋과 무관) ──────────────────────────────────────────────
let _paused   = false;
let _speedIdx = 0;
function gameSpeed() { return SPEED_STEPS[_speedIdx]; }
function togglePause() { _paused = !_paused; SFX.click(); }
function cycleSpeed()  { _speedIdx = (_speedIdx + 1) % SPEED_STEPS.length; SFX.click(); }

// ─── 영구 데이터 (런 초기화 후에도 유지) ─────────────────────────────────────
let _soulStones    = 0;
let _metaUpgrades  = {};
let _clearedStages = new Array(10).fill(false);
let _skillTreeOwned = [];
let _stats          = createStats();

// ─── 초기 상태 ────────────────────────────────────────────────────────────────
function newState() {
  return {
    wave:0,
    page:'battle',
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
    town: createTown(),
    waveActive:false,
    gameOver:false, stageCleared:false,
    showMeta:false,
    upgradePick: { active:false, cards:[] },
    activeUpgrades: [],
    hoveredCell:null,
    selectedTowerType:'arrow',
    resultBanked:false,
    floaties:[],
    ui:{ waveBtn:{}, hireCards:[], hiredSlots:[], heroDefBtn:{}, heroBatBtn:{}, metaCards:[], metaStartBtn:{}, metaTab:'tower', towerTabBtn:{}, heroTabBtn:{}, supportTabBtn:{} },
    // 영구 데이터 참조
    get soulStones()    { return _soulStones; },
    set soulStones(v)   { _soulStones = v; },
    get metaUpgrades()  { return _metaUpgrades; },
    set metaUpgrades(v) { _metaUpgrades = v; },
    get clearedStages()  { return _clearedStages; },
    set clearedStages(v) { _clearedStages = v; },
    get skillTreeOwned()  { return _skillTreeOwned; },
    set skillTreeOwned(v) { _skillTreeOwned = v; },
    get stats()  { return _stats; },
    set stats(v) { _stats = v; },
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
  gs.hero.level = Math.max(1, Math.min(HERO_MAX_LEVEL, sv.heroLevel||1));
  gs.hero.exp   = sv.heroExp || 0;
  gs.hero.hp    = HERO_LEVELS[gs.hero.level].hp;
  gs.battle.totalGoldEarned = sv.totalGoldEarned || 0;
  gs.caveLevel  = Math.max(1, Math.min(5, sv.caveLevel||1));
  _soulStones    = sv.soulStones   || 0;
  _metaUpgrades  = sv.metaUpgrades || {};
  _clearedStages = sv.clearedStages || new Array(10).fill(false);
  _skillTreeOwned = sv.skillTreeOwned || [];
  _stats          = Object.assign(createStats(), sv.stats || {});
  if (sv.townBuildings) {
    for (const [k, v] of Object.entries(sv.townBuildings)) {
      if (gs.town.buildings[k]) gs.town.buildings[k] = v;
    }
  }
  gs.town.equippedItems = sv.townEquipped || [];
  refreshHeroShop(gs);
  wm.init(gs.wave);
})();

// 메타 업그레이드 및 시작 보너스 적용
reapplyAllBonuses(gs);
_applyStartBonuses();

function _applyStartBonuses() {
  gs.gold    += BONUSES.startGoldBonus;
  gs.baseHP   = Math.min(BASE_HP_MAX + BONUSES.baseHpMax, gs.baseHP + BONUSES.baseHpMax);
  gs.hero.exp = Math.min(HERO_LEVELS[gs.hero.level].expNeeded - 1, gs.hero.exp + BONUSES.heroStartExp);
  gs.battle.maxSlots = 4 + BONUSES.maxSlotBonus;
}

function baseHpMax()     { return BASE_HP_MAX + BONUSES.baseHpMax; }
function heroMaxHp()     { return Math.round(HERO_LEVELS[gs.hero.level].hp * BONUSES.heroStatMult); }
function heroReviveDur() { return Math.max(5, HERO_REVIVE_TIME - BONUSES.heroReviveReduction); }

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

window.addEventListener('keydown', e => {
  if (_titleScreen) { _startFadeOut(); return; }
  if (tut.active)   { tut.next(); return; }
  switch (e.key) {
    case '1': case '2': case '3': case '4': {
      const id = TOWER_ORDER[Number(e.key) - 1];
      if (id) { gs.selectedTowerType = id; gs.ui.towerAction = null; SFX.click(); }
      break;
    }
    case ' ':
      e.preventDefault();
      if (wm.phase === 'idle' && gs.page === 'battle') { wm.startWave(gs); gs.waveActive = true; }
      else togglePause();
      break;
    case 'p': case 'P': togglePause(); break;
    case 's': case 'S': cycleSpeed(); break;
    case 'm': case 'M': SFX.toggleMute(); break;
    case 't': case 'T': gs.page = (gs.page === 'town' ? 'battle' : 'town'); SFX.click(); break;
    case 'Escape': gs.ui.towerAction = null; break;
  }
});

function tap({x,y}) {
  if (_titleScreen) { SFX.unlock(); _startFadeOut(); return; }
  if (tut.active)   { tut.next(); SFX.click(); return; }
  if (gs.showMeta)  {
    if (hitTest(x,y,gs.ui.metaStartBtn)) { gs.showMeta=false; resetGame(false); return; }
    // Tab switching
    if (hitTest(x,y,gs.ui.towerTabBtn||{}))   { gs.ui.metaTab='tower'; return; }
    if (hitTest(x,y,gs.ui.heroTabBtn||{}))     { gs.ui.metaTab='hero'; return; }
    if (hitTest(x,y,gs.ui.supportTabBtn||{}))  { gs.ui.metaTab='support'; return; }
    // Skill purchase
    for (const card of gs.ui.metaCards||[]) {
      if (hitTest(x,y,card)) {
        if (buySkillNode(card.skillId, gs)) { SaveManager.save(gs); spawnFloaty(`${card.icon} 습득!`,x,y,'#a78bfa'); }
        else spawnFloaty('보석 부족 또는 선행 필요!',x,y,'#ef4444');
        return;
      }
    }
    return;
  }
  if (gs.gameOver||gs.stageCleared) { gs.showMeta=true; return; }
  if (gs.upgradePick.active) {
    for (const card of gs.ui.upgradeCards||[]) {
      if (hitTest(x,y,card)) { applyUpgradeCard(card.card,gs); wm.confirmPick(gs); gs.upgradePick={active:false,cards:[]}; gs.waveActive=false; return; }
    }
    return;
  }

  // 게임 컨트롤 (항상 최우선)
  if (gs.page!=='town') {
    if (hitTest(x,y,gs.ui.ctrlPause||{})) { togglePause(); return; }
    if (hitTest(x,y,gs.ui.ctrlSpeed||{})) { cycleSpeed();  return; }
    if (hitTest(x,y,gs.ui.ctrlMute ||{})) { SFX.toggleMute(); return; }
    if (hitTest(x,y,gs.ui.briefTownBtn||{}) || hitTest(x,y,gs.ui.uibarTownBtn||{})) { gs.page='town'; SFX.click(); return; }
  }

  // 기지 탭 → 마을 진입 (idle 상태에서만)
  if (wm.phase==='idle' && y<UIBAR_Y) {
    const cell=screenToCell(x,y);
    if (cell && cell.c===4 && cell.r===6) { gs.page='town'; return; }
  }
  // 마을 페이지에서는 전투 화면 탭 막기
  if (gs.page==='town') { handleTownTap(x,y); return; }

  // Defense grid: always tappable when not in active wave
  if (y<UIBAR_Y && wm.phase==='idle') {
    const cell=screenToCell(x,y);
    if (!cell) return;
    if (gs.towers.some(t=>t.col===cell.c&&t.row===cell.r)) {
      const tower=gs.towers.find(t=>t.col===cell.c&&t.row===cell.r);
      gs.ui.towerAction = (gs.ui.towerAction?.col===cell.c&&gs.ui.towerAction?.row===cell.r) ? null : {col:cell.c,row:cell.r,tower};
      return;
    }
    if (isBlockedCell(cell.c, cell.r)) return;
    buildTowerAt(cell.c, cell.r, x, y);
    return;
  }

  // Tower action buttons (rendered near tower in defense area)
  if (gs.ui.towerAction && y<UIBAR_Y) {
    if (hitTest(x,y,gs.ui.towerUpgradeBtn||{})) { upgradeSelectedTower(x,y); return; }
    if (hitTest(x,y,gs.ui.towerRemoveBtn||{}))  { sellSelectedTower(x,y);    return; }
  }

  // Idle phase: wave start buttons (UIBar or battle area)
  if (wm.phase==='idle') {
    if (hitTest(x,y,gs.ui.waveBtn||{}) || hitTest(x,y,gs.ui.battleWaveStartBtn||{})) {
      if (!gs.battle.ourTeam.length) {
        spawnFloaty('병력을 먼저 고용하세요!', CW/2, BATTLE_Y+40, '#ef4444');
        SFX.denied();
      } else {
        wm.startWave(gs); gs.waveActive=true;
      }
      return;
    }
    handleTownTap(x,y);
    return;
  }
}

function handleTownTap(x,y) {
  const t=gs.town;

  // Back to battle page
  if (hitTest(x,y,gs.ui.townPageBackBtn||{})) { gs.page='battle'; return; }

  // Building sub-screen
  if (t.screen!=='main') {
    // Tab buttons work even inside sub-screen
    if (hitTest(x,y,gs.ui.tabTownBtn||{}))   { t.screen='main'; t.tab='town'; return; }
    if (hitTest(x,y,gs.ui.tabArmyBtn||{}))   { t.screen='main'; t.tab='army'; return; }
    if (hitTest(x,y,gs.ui.tabTowersBtn||{})) { t.screen='main'; t.tab='towers'; gs.ui.towerAction=null; return; }
    if (hitTest(x,y,gs.ui.townBackBtn||{})) { t.screen='main'; return; }
    if (t.screen==='heroShop') {
      for (const btn of gs.ui.shopItemBtns||[]) {
        if (hitTest(x,y,btn)) {
          if (!buyShopItem(btn.item,gs)) spawnFloaty('골드 부족!',x,y,'#ef4444');
          else spawnFloaty(`${btn.item.icon} 구매!`,x,y,'#a78bfa');
          return;
        }
      }
      return;
    }
    if (hitTest(x,y,gs.ui.buildingLvUpBtn||{})) {
      if (levelUpBuilding(t.screen,gs)) spawnFloaty('건물 레벨업!',x,y,'#f59e0b');
      else spawnFloaty('골드 부족!',x,y,'#ef4444');
      return;
    }
    for (const btn of gs.ui.upgradeBtns||[]) {
      if (hitTest(x,y,btn)) {
        if (!buyTownUpgrade(t.screen,btn.id,gs)) spawnFloaty('골드 부족!',x,y,'#ef4444');
        else spawnFloaty('강화 완료!',x,y,'#22c55e');
        return;
      }
    }
    return;
  }

  // Tab switching
  if (hitTest(x,y,gs.ui.tabTownBtn||{})) { t.tab='town'; return; }
  if (hitTest(x,y,gs.ui.tabArmyBtn||{})) { t.tab='army'; return; }
  if (hitTest(x,y,gs.ui.tabTowersBtn||{})) { t.tab='towers'; gs.ui.towerAction=null; return; }

  // Towers tab
  if (t.tab==='towers') {
    if (hitTest(x,y,gs.ui.towerUpgradeBtn||{})) { upgradeSelectedTower(x,y); return; }
    if (hitTest(x,y,gs.ui.towerRemoveBtn||{}))  { sellSelectedTower(x,y);    return; }
    for (const b of gs.ui.towerTypeBtns||[]) {
      if (hitTest(x,y,b)) { gs.selectedTowerType=b.typeId; gs.ui.towerAction=null; SFX.click(); return; }
    }
    if (gs.ui.towerMiniGrid) {
      const mg=gs.ui.towerMiniGrid;
      if (x>=mg.x && x<mg.x+GRID_COLS*mg.cellW && y>=mg.y && y<mg.y+GRID_ROWS*mg.cellH) {
        const c=Math.floor((x-mg.x)/mg.cellW);
        const r=Math.floor((y-mg.y)/mg.cellH);
        if (c<0||c>=GRID_COLS||r<0||r>=GRID_ROWS) return;
        const existing=gs.towers.find(tw=>tw.col===c&&tw.row===r);
        if (existing) {
          gs.ui.towerAction=(gs.ui.towerAction?.col===c&&gs.ui.towerAction?.row===r)?null:{col:c,row:r,tower:existing};
        } else {
          if (isBlockedCell(c, r)) return;
          buildTowerAt(c, r, x, y);
        }
        return;
      }
    }
    return;
  }

  if (t.tab==='town') {
    for (const card of gs.ui.buildingCards||[]) {
      if (hitTest(x,y,card)) {
        if (!card.built) {
          if (!buildBuilding(card.id,gs)) spawnFloaty('골드 부족!',x,y,'#ef4444');
          else spawnFloaty('건설 완료!',x,y,'#22c55e');
        } else if (card.id!=='cave') {
          t.screen=card.id;
        }
        return;
      }
    }
    if (hitTest(x,y,gs.ui.caveBtn||{})) {
      const nextLv=gs.caveLevel+1;
      if (nextLv<=CAVE_MAX_LEVEL) {
        const cost=CAVE_LEVELS[nextLv].upgradeCost;
        if (gs.gold>=cost) { gs.gold-=cost; gs.caveLevel=nextLv; spawnFloaty(`🗿 케이브 Lv.${nextLv}!`,CW/2,300,'#a78bfa'); }
        else spawnFloaty('골드 부족!',x,y,'#ef4444');
      }
      return;
    }
  }

  if (t.tab==='army') {
    if (hitTest(x,y,gs.ui.heroDefBtn||{})) { gs.hero.placement=gs.hero.placement==='defense'?'none':'defense'; if (gs.hero.placement==='defense') gs.battle.ourTeam=gs.battle.ourTeam.filter(u=>!u.isHero); return; }
    if (hitTest(x,y,gs.ui.heroBatBtn||{})) {
      if (gs.hero.placement==='battle') { gs.hero.placement='none'; gs.battle.ourTeam=gs.battle.ourTeam.filter(u=>!u.isHero); }
      else { gs.hero.placement='battle'; if (!gs.battle.ourTeam.some(u=>u.isHero)) gs.battle.ourTeam.unshift(makeHeroUnit(gs.hero)); }
      return;
    }
    for (const card of gs.ui.hireCards||[]) {
      if (hitTest(x,y,card)) {
        const prev=gs.gold; gs.gold=hireUnit(gs.battle,card.typeId,gs.gold);
        if (gs.gold<prev) { spawnFloaty(`+${UNIT_TYPES[card.typeId].name}`,card.x+card.w/2,card.y,'#60a5fa'); SFX.hire(); }
        else { const full=gs.battle.ourTeam.filter(u=>!u.isHero).length>=gs.battle.maxSlots;
               spawnFloaty(full?'슬롯이 가득 참!':'골드 부족!',x,y,'#ef4444'); SFX.denied(); }
        return;
      }
    }
    for (const slot of gs.ui.hiredSlots||[]) {
      if (hitTest(x,y,slot)) {
        const units=gs.battle.ourTeam.filter(u=>!u.isHero);
        if (units[slot.idx]) { const ref=fireUnit(gs.battle,gs.battle.ourTeam.indexOf(units[slot.idx])); gs.gold+=ref; if (ref>0) { spawnFloaty(`+${ref}💰`,x,y,COLORS.gold); SFX.sell(); } }
        return;
      }
    }
    if (hitTest(x,y,gs.ui.deployBtn||{})) {
      if (!gs.battle.ourTeam.length) { spawnFloaty('병력을 먼저 고용하세요!',x,y,'#ef4444'); SFX.denied(); return; }
      gs.page='battle'; wm.startWave(gs); gs.waveActive=true;
      return;
    }
  }
}

// ─── 타워 건설 / 강화 / 판매 ─────────────────────────────────────────────────
function buildTowerAt(c, r, fx, fy) {
  const typeId = gs.selectedTowerType || 'arrow';
  const cost   = towerBuildCost(typeId, gs.towers);
  if (gs.gold < cost) { spawnFloaty('골드 부족!', fx, fy, '#ef4444'); SFX.denied(); return false; }
  gs.gold -= cost;
  const t = makeTower(c, r, typeId);
  t.invested = cost;
  gs.towers.push(t);
  gs.ui.towerAction = null;
  spawnFloaty(`-${cost}💰`, fx, fy, COLORS.gold);
  const ctr = cellCenter(c, r);
  FX.ring(ctr.x, ctr.y, TOWER_TYPES[typeId].color, 8);
  SFX.build();
  return true;
}

function upgradeSelectedTower(x, y) {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  const cost = towerUpgradeCost(tower);
  if (cost === null) { spawnFloaty('최대 레벨!', x, y, '#f59e0b'); SFX.denied(); return; }
  if (gs.gold < cost) { spawnFloaty('골드 부족!', x, y, '#ef4444'); SFX.denied(); return; }
  gs.gold -= cost;
  tower.invested = (tower.invested || 0) + cost;
  tower.level = (tower.level || 1) + 1;
  spawnFloaty(`타워 Lv.${tower.level}!`, x, y, '#f59e0b');
  const ctr = cellCenter(tower.col, tower.row);
  FX.ring(ctr.x, ctr.y, '#22c55e', 9);
  SFX.upgrade();
}

function sellSelectedTower(x, y) {
  const ta = gs.ui.towerAction;
  if (!ta) return;
  const tower = gs.towers.find(tw => tw.col === ta.col && tw.row === ta.row);
  if (!tower) { gs.ui.towerAction = null; return; }
  const value = towerSellValue(tower);
  gs.gold += value;
  gs.towers = gs.towers.filter(tw => tw !== tower);
  gs.ui.towerAction = null;
  spawnFloaty(`+${value}💰`, x, y, COLORS.gold);
  SFX.sell();
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

  // 영웅이 상단에 있으면 EXP. 직접 처치는 전액, 타워 처치는 40%
  if (gs.hero.placement === 'defense' && !gs.hero.dead) {
    const exp = (tpl.reward || 2) * BONUSES.heroExpMult * (byHero ? 1 : 0.4);
    if (exp >= 1) {
      heroGainExp(exp);
      spawnFloaty(`EXP+${Math.floor(exp)}`, gs.hero.defX, gs.hero.defY - 26, '#f59e0b');
    }
  }
}

// ─── 영웅 방어 구역 전투 ─────────────────────────────────────────────────────
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

  // 근접한 적의 반격 — 영웅도 죽을 수 있다
  hero.hitCooldown = Math.max(0, (hero.hitCooldown || 0) - dt);
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
  spawnFloaty('👑 영웅 전사!', CW/2, DEFENSE_H/2, '#ef4444');
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
    spawnFloaty(`영웅 레벨업! Lv.${hero.level}`, CW/2, DEFENSE_H/2, '#f59e0b');
    addLog(gs.battle, `👑 영웅이 Lv.${hero.level}로 성장!`, COLORS.hero);
    FX.ring(CW/2, DEFENSE_H/2, COLORS.hero, 18);
    SFX.levelUp();
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

  FX.update(dt);

  if (gs.gameOver||gs.stageCleared) { bankRunResult(); updateFloaties(dt); return; }
  if (gs.showMeta) { updateFloaties(dt); return; }
  if (gs.upgradePick.active) { updateFloaties(dt); return; }

  // 영웅 부활 카운트다운
  if (gs.hero.dead) {
    gs.hero.reviveTimer = Math.max(0, gs.hero.reviveTimer - dt);
    if (gs.hero.reviveTimer <= 0) {
      gs.hero.dead = false;
      gs.hero.hp = heroMaxHp();
      spawnFloaty('👑 영웅 부활!', CW/2, DEFENSE_H/2, '#22c55e');
      SFX.levelUp();
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
      FX.shake(Math.min(8, 2 + dmg * 0.2), 0.3);
      SFX.baseHit();
      if (gs.baseHP<=0) { gs.gameOver=true; bankRunResult(); return; }
    }
  }

  // 기지 재생
  if (BONUSES.baseRegen > 0) {
    gs.baseHP = Math.min(baseHpMax(), gs.baseHP + BONUSES.baseRegen * dt);
  }

  updateTowers(gs.towers,gs.defenseEnemies,gs.projectiles,dt);
  updateProjectiles(gs.projectiles, e => onDefenseKill(e, false), dt);
  gs.defenseEnemies=gs.defenseEnemies.filter(e=>!e.dead&&!e.reached);

  updateHeroDefense(dt);
  updateBattle(gs.battle, dt, wm.groupPhase === 'advancing');

  if (wm.phase==='intermission') gs.waveActive=false;

  updateFloaties(dt);
}

// ─── 런 종료 정산 ────────────────────────────────────────────────────────────
function bankRunResult() {
  if (gs.resultBanked) return;
  gs.resultBanked = true;
  const earned = calcSoulStones(gs);
  _soulStones += earned;
  gs.lastSoulEarned = earned;
  gs.stats.runs++;
  gs.stats.bestWave  = Math.max(gs.stats.bestWave, gs.wave + (gs.stageCleared ? 1 : 0));
  gs.stats.totalGold += gs.battle.totalGoldEarned;
  SaveManager.save(gs);
}

// ─── 렌더 루프 ────────────────────────────────────────────────────────────────
let _last=0;
function loop(ts) {
  const dt=Math.min((ts-_last)/1000,0.05); _last=ts;
  ctx.clearRect(0,0,CW,CH);

  const [shx, shy] = FX.shakeOffset();
  ctx.save();
  ctx.translate(shx, shy);
  if (gs.page==='town') {
    renderTownPage(ctx,gs);
  } else {
    renderDefense(ctx,gs);
    renderUIBar(ctx,gs,wm);
    renderBattle(ctx,gs);
    FX.draw(ctx);
  }
  ctx.restore();

  if (gs.page!=='town') renderHUD(ctx,gs);
  if (gs.upgradePick.active) renderUpgradePick(ctx,gs);
  if (gs.showMeta) renderMetaScreen(ctx,gs);
  drawFloaties(ctx);
  if (_paused && !_titleScreen && !tut.active) renderPauseOverlay(ctx);
  renderTutorial(ctx,tut);
  if (_titleScreen || _fadingOut) renderTitleScreen(ctx, _titleAlpha);

  if (_paused && !_titleScreen && !_fadingOut) {
    FX.update(dt); updateFloaties(dt);
  } else {
    const steps = (_titleScreen || _fadingOut) ? 1 : gameSpeed();
    for (let i = 0; i < steps; i++) update(dt);
  }
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

  gs.page = 'battle';
  gs.town = createTown();
  FX.clear();
  _paused = false;
  refreshHeroShop(gs);
  reapplyAllBonuses(gs);
  _applyStartBonuses();
  wm.init(gs.wave);
}

// ─── 시작 ────────────────────────────────────────────────────────────────────
requestAnimationFrame(ts=>{ _last=ts; requestAnimationFrame(loop); });
