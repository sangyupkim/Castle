'use strict';

let _uid = 0;

// ─── 유닛 생성 ────────────────────────────────────────────────────────────────
function makeUnit(typeId) {
  const t = UNIT_TYPES[typeId];
  return {
    id:++_uid, typeId, isPlayer:true, isHero:false,
    name:t.name, icon:t.icon, color:t.color,
    hp:t.hp, maxHp:t.hp, atk:t.atk, def:t.def,
    mp:t.mp, maxMp:t.maxMp,
    skillName:t.skillName, skillAtk:t.skillAtk,
    skillCost:t.skillCost, skillColor:t.skillColor,
    healAmt:t.healAmt||0,
    ticksSinceSkill:0, dead:false,
    flashTimer:0, flashColor:'#fff'
  };
}

function makeMob(typeId) {
  const t = BATTLE_MOB_TYPES[typeId];
  return {
    id:++_uid, typeId, isPlayer:false,
    name:t.name, icon:t.icon, color:t.color,
    hp:t.hp, maxHp:t.hp, atk:t.atk, def:t.def,
    mp:t.mp, maxMp:t.maxMp,
    skillAtk:t.skillAtk, skillCost:t.skillCost,
    goldReward:t.goldReward,
    ticksSinceSkill:0, dead:false,
    flashTimer:0, flashColor:'#fff'
  };
}

// 처치 수 + 케이브 레벨 반영 스케일링 몹
function makeScaledMob(typeId, killCount, caveLevel) {
  const t  = BATTLE_MOB_TYPES[typeId];
  const cv = CAVE_LEVELS[caveLevel] || CAVE_LEVELS[1];
  const km = 1 + killCount * KILL_SCALE;   // 처치 기반 배율
  const sm = km * cv.statMult;              // 스탯 최종 배율
  const gm = km * cv.goldMult;              // 골드 최종 배율
  return {
    id:++_uid, typeId, isPlayer:false,
    name:t.name, icon:t.icon, color:t.color,
    hp:      Math.max(1, Math.round(t.hp       * sm)),
    maxHp:   Math.max(1, Math.round(t.hp       * sm)),
    atk:     Math.max(1, Math.round(t.atk      * sm)),
    def:     Math.max(0, Math.round(t.def      * sm)),
    mp:t.mp, maxMp:t.maxMp,
    skillAtk:Math.max(1, Math.round(t.skillAtk * sm)),
    skillCost:t.skillCost,
    goldReward: Math.max(1, Math.round(t.goldReward * gm)),
    ticksSinceSkill:0, dead:false,
    flashTimer:0, flashColor:'#fff'
  };
}

// 영웅을 전투용 유닛으로 변환
function makeHeroUnit(hero) {
  const lv = HERO_LEVELS[hero.level];
  return {
    id:++_uid, typeId:'hero', isPlayer:true, isHero:true,
    name:'영웅', icon:'👑', color:COLORS.hero,
    hp:hero.hp, maxHp:lv.hp, atk:lv.atk, def:lv.def,
    mp:30, maxMp:30,
    skillName:'영웅 일격', skillAtk: Math.floor(lv.atk*2.2),
    skillCost:15, skillColor:'#fbbf24', healAmt:0,
    ticksSinceSkill:0, dead:false,
    flashTimer:0, flashColor:'#fff'
  };
}

// ─── 배틀 상태 ────────────────────────────────────────────────────────────────
function createBattle() {
  return {
    phase: 'hire',       // hire | fighting | won | lost
    ourTeam: [],
    enemyTeam: [],
    maxSlots: 4,
    tickTimer: 0,
    tickCount: 0,
    goldEarned: 0,       // 이번 웨이브 적립
    totalGoldEarned: 0,  // 스테이지 누적 (표시용)
    killCount: 0,        // 이번 웨이브 처치 수 (스케일링 기준)
    log: [],
    floaties: [],
    result: null
  };
}

// ─── 고용 / 해고 ─────────────────────────────────────────────────────────────
function hireUnit(battle, typeId, gold) {
  const t = UNIT_TYPES[typeId];
  if (!t || battle.ourTeam.length >= battle.maxSlots || gold < t.cost) return gold;
  battle.ourTeam.push(makeUnit(typeId));
  return gold - t.cost;
}

function fireUnit(battle, idx) {
  if (idx < 0 || idx >= battle.ourTeam.length) return 0;
  const u = battle.ourTeam[idx];
  if (u.isHero) return 0; // 영웅은 해고 불가
  const refund = Math.floor(UNIT_TYPES[u.typeId].cost / 2);
  battle.ourTeam.splice(idx, 1);
  return refund;
}

// ─── 전투 시작 ────────────────────────────────────────────────────────────────
function startFighting(battle) {
  if (battle.ourTeam.length === 0) return false;
  battle.phase      = 'fighting';
  battle.tickTimer  = 0;
  battle.tickCount  = 0;
  battle.killCount  = 0;
  battle.result     = null;
  battle.goldEarned = 0;
  for (const u of [...battle.ourTeam, ...battle.enemyTeam]) u.ticksSinceSkill = 0;
  return true;
}

// ─── 전투 틱 ─────────────────────────────────────────────────────────────────
function battleTick(battle) {
  battle.tickCount++;

  const our = battle.ourTeam.filter(u => !u.dead);
  const foe = battle.enemyTeam.filter(u => !u.dead);
  if (!our.length || !foe.length) return;

  // 아군 공격
  for (const u of our) {
    u.ticksSinceSkill++;
    const useSkill = u.ticksSinceSkill >= SKILL_TICK_CD && u.mp >= u.skillCost;

    if (useSkill) {
      u.ticksSinceSkill = 0;
      u.mp -= u.skillCost;

      if (u.healAmt > 0) {
        // 치유사: HP 비율 최저 아군 치유
        const target = our.slice().sort((a,b) => (a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
        const healed = Math.min(target.maxHp - target.hp, u.healAmt);
        target.hp += healed;
        const idx = battle.ourTeam.indexOf(target);
        addFloaty(battle, `+${healed}`, BATTLE_TEAM_X, unitY(idx), '#34d399');
        addLog(battle, `${u.name}의 ${u.skillName}! +${healed}회복`, u.skillColor);
      } else {
        // 공격 스킬
        const target = foe[Math.floor(Math.random()*foe.length)];
        const dmg = Math.max(1, u.skillAtk - target.def);
        applyDamage(target, dmg, battle, u.skillColor, true);
        addLog(battle, `${u.name}의 ${u.skillName}! ${dmg}피해`, u.skillColor);
      }
    } else {
      const target = foe[Math.floor(Math.random()*foe.length)];
      const dmg = Math.max(1, u.atk - target.def);
      applyDamage(target, dmg, battle, '#fbbf24', true);
    }
    u.mp = Math.min(u.maxMp, u.mp + MP_REGEN_TICK);
  }

  // 적 공격
  for (const mob of foe) {
    mob.ticksSinceSkill++;
    const useSkill = mob.ticksSinceSkill >= SKILL_TICK_CD && mob.mp >= mob.skillCost;
    const target = our[Math.floor(Math.random()*our.length)];

    if (useSkill) {
      mob.ticksSinceSkill = 0;
      mob.mp -= mob.skillCost;
      const dmg = Math.max(1, mob.skillAtk - target.def);
      applyDamage(target, dmg, battle, '#ef4444', false);
      addLog(battle, `${mob.name} 스킬! ${dmg}피해`, '#ef4444');
    } else {
      const dmg = Math.max(1, mob.atk - target.def);
      applyDamage(target, dmg, battle, '#fca5a5', false);
    }
    mob.mp = Math.min(mob.maxMp, mob.mp + MP_REGEN_TICK);
  }

  // 종료 체크
  if (!battle.enemyTeam.some(u => !u.dead)) { battle.phase='won';  battle.result='won';  }
  if (!battle.ourTeam.some(u => !u.dead))   { battle.phase='lost'; battle.result='lost'; }
}

// ─── 피해 적용 ────────────────────────────────────────────────────────────────
function applyDamage(target, dmg, battle, color, isMobTarget) {
  target.hp -= dmg;
  target.flashTimer = 0.25; target.flashColor = color;
  const arr = isMobTarget ? battle.enemyTeam : battle.ourTeam;
  const idx = arr.indexOf(target);
  const x   = isMobTarget ? BATTLE_ENEMY_X : BATTLE_TEAM_X;
  addFloaty(battle, `-${dmg}`, x, unitY(idx), color);

  if (target.hp <= 0) {
    target.dead = true; target.hp = 0;
    if (isMobTarget) {
      battle.killCount++;
      if (target.goldReward) {
        battle.goldEarned      += target.goldReward;
        battle.totalGoldEarned += target.goldReward;
        addFloaty(battle, `+${target.goldReward}💰`, x, unitY(idx)-22, COLORS.gold);
      }
    }
  }
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function updateBattle(battle, dt) {
  if (battle.phase !== 'fighting') return;

  for (const u of [...battle.ourTeam, ...battle.enemyTeam]) {
    if (u.flashTimer > 0) u.flashTimer = Math.max(0, u.flashTimer - dt);
  }
  for (let i = battle.floaties.length-1; i >= 0; i--) {
    const f = battle.floaties[i];
    f.y += f.vy*dt; f.life -= dt;
    if (f.life <= 0) battle.floaties.splice(i,1);
  }
  for (let i = battle.log.length-1; i >= 0; i--) {
    battle.log[i].timer -= dt;
    if (battle.log[i].timer <= 0) battle.log.splice(i,1);
  }

  battle.tickTimer += dt;
  if (battle.tickTimer >= TICK_INTERVAL) {
    battle.tickTimer -= TICK_INTERVAL;
    battleTick(battle);
  }
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
function addLog(battle, text, color) {
  battle.log.unshift({text, color, timer:2.5});
  if (battle.log.length > 5) battle.log.pop();
}

function addFloaty(battle, text, x, y, color) {
  battle.floaties.push({text, x, y:y-BATTLE_UNIT_R, vy:-40, life:1.2, color});
}

function unitY(idx) {
  return BATTLE_UNIT_START_Y + 40 + idx * BATTLE_UNIT_GAP + BATTLE_UNIT_R;
}

// 세이브용 직렬화 (이월 없으므로 빈 배열 반환 — 호환성 유지)
function serializeEnemies() { return []; }
function restoreEnemies()   { return []; }
