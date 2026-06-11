'use strict';

// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let _scale   = 1;

function resize() {
  const s = Math.min(window.innerWidth/CW, window.innerHeight/CH);
  canvas.width=CW; canvas.height=CH;
  canvas.style.width=`${CW*s}px`; canvas.style.height=`${CH*s}px`;
  _scale=s;
}
window.addEventListener('resize', resize);
resize();

// ─── 초기 상태 ────────────────────────────────────────────────────────────────
function newState() {
  return {
    phase:1, wave:0,
    gold:10, baseHP:BASE_HP_MAX,
    towers:[], defenseEnemies:[], projectiles:[],
    battle: null,
    hero: {
      level:1, exp:0,
      hp: HERO_LEVELS[1].hp,
      placement:'none',  // 'none' | 'defense' | 'battle'
      dead:false, reviveTimer:0,
      // 방어존에서의 위치 (가운데 배치)
      defX: GRID_OX + 4*CELL_W + CELL_W/2,
      defY: GRID_OY + 3*CELL_H + CELL_H/2,
      atkCooldown:0
    },
    waveActive:false,
    gameOver:false, stageCleared:false,
    hoveredCell:null,
    floaties:[],
    ui:{ waveBtn:{}, hireCards:[], hiredSlots:[], heroDefBtn:{}, heroBatBtn:{} }
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
  wm.init(gs.wave);
})();

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
  if (tut.active)      { tut.next(); return; }
  if (gs.gameOver)     { resetGame(false); return; }
  if (gs.stageCleared) { resetGame(true);  return; }

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
    if (hitTest(x,y,gs.ui.heroDefBtn)) {
      gs.hero.placement = gs.hero.placement==='defense' ? 'none' : 'defense';
      // 하단 배치였으면 영웅 아군에서 제거
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
        // 영웅 전투 유닛 추가 (이미 없으면)
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
    const cost=TOWER_TYPES.arrow.cost;
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

  // 사거리 내 가장 가까운 적 탐색
  let best=null, bestD=Infinity;
  for (const e of gs.defenseEnemies) {
    if (e.dead||e.reached) continue;
    const d=Math.hypot(e.x-hero.defX, e.y-hero.defY);
    if (d<=lv.range&&d<bestD) { best=e; bestD=d; }
  }
  if (!best) return;

  hero.atkCooldown=1.0; // 초당 1회
  best.hp-=lv.atk;
  if (best.hp<=0) {
    best.dead=true;
    // EXP 획득
    const expGain = ENEMY_TYPES[best.typeId]?.reward || 2;
    heroGainExp(expGain);
    spawnFloaty(`EXP+${expGain}`,hero.defX,hero.defY-20,'#f59e0b');
  }
  // 타격 투사체 (시각 효과)
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
    hero.hp=HERO_LEVELS[hero.level].hp; // HP 풀 회복
    spawnFloaty(`영웅 레벨업! Lv.${hero.level}`,CW/2,DEFENSE_H/2,'#f59e0b');
    addLog(gs.battle,`👑 영웅이 Lv.${hero.level}로 성장!`,COLORS.hero);
  }
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function update(dt) {
  if (gs.gameOver||gs.stageCleared) return;

  // 영웅 부활
  if (gs.hero.dead) {
    gs.hero.reviveTimer-=dt;
    if (gs.hero.reviveTimer<=0) {
      gs.hero.dead=false;
      gs.hero.hp=HERO_LEVELS[gs.hero.level].hp;
      spawnFloaty('영웅 부활!',CW/2,DEFENSE_H/2,'#22c55e');
    }
  }

  if (!gs.waveActive) { wm.updateIntermission(gs,dt); return; }

  wm.update(gs,dt);

  // 상단 방어
  updateDefenseEnemies(gs.defenseEnemies,dt);
  for (const e of gs.defenseEnemies) {
    if (e.reached&&!e._counted) {
      e._counted=true;
      gs.baseHP=Math.max(0,gs.baseHP-e.dmg);
      spawnFloaty(`-${e.dmg}HP`,CW/2,DEFENSE_H-25,'#ef4444');
      if (gs.baseHP<=0) { gs.gameOver=true; return; }
    }
  }

  // 타워 공격 (킬 보상 없음 — 자원은 하단에서만)
  updateTowers(gs.towers,gs.defenseEnemies,gs.projectiles,dt);
  updateProjectiles(gs.projectiles,()=>{},dt);
  gs.defenseEnemies=gs.defenseEnemies.filter(e=>!e.dead&&!e.reached);

  // 영웅 방어 공격
  updateHeroDefense(dt);

  // 하단 전투
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
  drawFloaties(ctx);
  renderTutorial(ctx,tut);
  update(dt);
  requestAnimationFrame(loop);
}

// ─── 리셋 ────────────────────────────────────────────────────────────────────
function resetGame(next) {
  const hero=gs.hero;
  gs=newState();
  gs.battle=createBattle();

  if (next) {
    gs.hero=hero;
    gs.hero.dead=false; gs.hero.hp=HERO_LEVELS[gs.hero.level].hp;
    gs.hero.placement='none';
    SaveManager.clear();
  } else {
    const sv=SaveManager.load();
    if (sv) {
      gs.gold=sv.gold||10; gs.baseHP=sv.baseHP||BASE_HP_MAX;
      gs.wave=sv.wave||0;
      gs.hero.level=Math.max(1,Math.min(5,sv.heroLevel||1));
      gs.hero.exp=sv.heroExp||0;
      gs.hero.hp=HERO_LEVELS[gs.hero.level].hp;
      gs.battle.totalGoldEarned=sv.totalGoldEarned||0;
    }
  }
  wm.init(gs.wave);
}

// ─── 시작 ────────────────────────────────────────────────────────────────────
requestAnimationFrame(ts=>{ _last=ts; requestAnimationFrame(loop); });
