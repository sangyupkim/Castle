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
    flashTimer:0, flashColor:'#fff',
    drawX: BATTLE_TEAM_X   // 시각적 x (아군은 고정)
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
    flashTimer:0, flashColor:'#fff',
    drawX: BATTLE_ENEMY_SPAWN_X, drawY: 0, deadTimer: 0
  };
}

// 처치 수 + 케이브 레벨 반영 스케일링 몹
function makeScaledMob(typeId, killCount, caveLevel) {
  const t  = BATTLE_MOB_TYPES[typeId];
  const cv = CAVE_LEVELS[caveLevel] || CAVE_LEVELS[1];
  const km = 1 + killCount * KILL_SCALE;
  const sm = km * cv.statMult;
  const gm = km * cv.goldMult;
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
    flashTimer:0, flashColor:'#fff',
    drawX: BATTLE_ENEMY_SPAWN_X, drawY: 0, deadTimer: 0
  };
}

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
    flashTimer:0, flashColor:'#fff',
    drawX: BATTLE_TEAM_X
  };
}

// ─── 배틀 상태 ────────────────────────────────────────────────────────────────
function createBattle() {
  return {
    phase: 'hire',
    ourTeam: [],
    enemyTeam: [],
    maxSlots: 4,
    tickTimer: 0,
    tickCount: 0,
    goldEarned: 0,
    totalGoldEarned: 0,
    killCount: 0,
    scrollX: 0,       // 배경 스크롤 (전진 연출)
    playerDrift: 0,   // 아군 전진 드리프트
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
  if (u.isHero) return 0;
  const refund = Math.floor(UNIT_TYPES[u.typeId].cost / 2);
  battle.ourTeam.splice(idx, 1);
  return refund;
}

// ─── 전투 시작 ────────────────────────────────────────────────────────────────
function startFighting(battle) {
  if (battle.ourTeam.length === 0) return false;
  battle.phase       = 'fighting';
  battle.tickTimer   = 0;
  battle.tickCount   = 0;
  battle.killCount   = 0;
  battle.scrollX     = 0;
  battle.playerDrift = 0;
  battle.result      = null;
  battle.goldEarned  = 0;
  for (const u of [...battle.ourTeam, ...battle.enemyTeam]) u.ticksSinceSkill = 0;
  return true;
}

// ─── 전투 틱 ─────────────────────────────────────────────────────────────────
function battleTick(battle) {
  battle.tickCount++;

  const our = battle.ourTeam.filter(u => !u.dead);
  // 전투 대상: 화면에 도착한 적만 (아직 걸어오는 중이면 제외)
  const foe = battle.enemyTeam.filter(u => !u.dead && u.drawX <= BATTLE_ENEMY_X + 10);
  if (!our.length || !foe.length) return;

  // 아군 공격
  for (const u of our) {
    u.ticksSinceSkill++;
    const useSkill = u.ticksSinceSkill >= SKILL_TICK_CD && u.mp >= u.skillCost;

    if (useSkill) {
      u.ticksSinceSkill = 0;
      u.mp -= u.skillCost;

      if (u.healAmt > 0) {
        const target = our.slice().sort((a,b) => (a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
        const healed = Math.min(target.maxHp - target.hp, u.healAmt);
        target.hp += healed;
        const idx = battle.ourTeam.indexOf(target);
        addFloaty(battle, `+${healed}`, target.drawX, unitY(idx), '#34d399');
        addLog(battle, `${u.name}의 ${u.skillName}! +${healed}회복`, u.skillColor);
      } else {
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

  // 아군 전멸 시에만 즉시 패배 처리
  if (!battle.ourTeam.some(u => !u.dead)) { battle.phase='lost'; battle.result='lost'; }
}

// ─── 피해 적용 ────────────────────────────────────────────────────────────────
function applyDamage(target, dmg, battle, color, isMobTarget) {
  target.hp -= dmg;
  target.flashTimer = 0.25; target.flashColor = color;
  const arr = isMobTarget ? battle.enemyTeam : battle.ourTeam;
  const idx = arr.indexOf(target);
  const x   = isMobTarget ? (target.drawX || BATTLE_ENEMY_X) : (target.drawX || BATTLE_TEAM_X);
  const y   = isMobTarget ? (target.drawY || unitY(idx)) : unitY(idx);
  addFloaty(battle, `-${dmg}`, x, y, color);

  if (target.hp <= 0) {
    target.dead = true; target.hp = 0;
    if (isMobTarget) {
      battle.killCount++;
      if (target.goldReward) {
        battle.goldEarned      += target.goldReward;
        battle.totalGoldEarned += target.goldReward;
        addFloaty(battle, `+${target.goldReward}💰`, x, y - 22, COLORS.gold);
      }
    }
  }
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function updateBattle(battle, dt) {
  if (battle.phase !== 'fighting') return;

  // 플래시/플로티/로그
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

  // 적 걷기 애니메이션: 오른쪽에서 왼쪽으로 이동
  for (const e of battle.enemyTeam) {
    if (e.dead) {
      e.deadTimer += dt;
    } else {
      e.drawX = Math.max(BATTLE_ENEMY_X, e.drawX - BATTLE_ENEMY_WALK_SPD * dt);
    }
  }
  // 사망 후 0.7초 지난 적 제거
  battle.enemyTeam = battle.enemyTeam.filter(e => !e.dead || e.deadTimer < 0.7);

  // 아군 전진 연출: 생존 적이 없을 때 배경 스크롤 + 아군 드리프트
  const hasLiveEnemies = battle.enemyTeam.some(e => !e.dead);
  if (!hasLiveEnemies && battle.ourTeam.some(u => !u.dead)) {
    battle.scrollX    += BATTLE_MARCH_SPD * dt;
    battle.playerDrift = Math.min(55, battle.playerDrift + 75 * dt);
  } else if (hasLiveEnemies) {
    battle.playerDrift = Math.max(0, battle.playerDrift - 250 * dt);
  }

  // 전투 틱
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

function serializeEnemies() { return []; }
function restoreEnemies()   { return []; }
