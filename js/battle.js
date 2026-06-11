'use strict';

// ─── Unit Factory ─────────────────────────────────────────────────────────────
let _uid = 0;

function makeUnit(typeId) {
  const t = UNIT_TYPES[typeId];
  return {
    id: ++_uid, typeId, isPlayer: true,
    name: t.name, icon: t.icon, color: t.color,
    hp: t.hp, maxHp: t.hp,
    atk: t.atk, def: t.def,
    mp: t.mp, maxMp: t.maxMp,
    skillName: t.skillName, skillAtk: t.skillAtk,
    skillCost: t.skillCost, skillColor: t.skillColor,
    healAmt: t.healAmt || 0,
    ticksSinceSkill: 0,
    dead: false,
    flashTimer: 0, flashColor: '#fff'
  };
}

function makeMob(typeId, hpOverride) {
  const t = BATTLE_MOB_TYPES[typeId];
  const hp = hpOverride !== undefined ? hpOverride : t.hp;
  return {
    id: ++_uid, typeId, isPlayer: false,
    name: t.name, icon: t.icon, color: t.color,
    hp, maxHp: t.hp,
    atk: t.atk, def: t.def,
    mp: t.mp, maxMp: t.maxMp,
    skillAtk: t.skillAtk, skillCost: t.skillCost,
    goldReward: t.goldReward,
    ticksSinceSkill: 0,
    dead: false,
    flashTimer: 0, flashColor: '#fff'
  };
}

// ─── Battle State ─────────────────────────────────────────────────────────────
function createBattle() {
  return {
    phase: 'hire',         // hire | fighting | won | lost
    ourTeam: [],
    enemyTeam: [],         // 생존 몬스터 풀 (체력 이월됨)
    maxSlots: 4,
    tickTimer: 0,
    tickCount: 0,
    goldEarned: 0,         // 이번 웨이브에서 적립한 골드 (웨이브 종료 시 지급)
    totalGoldEarned: 0,    // 스테이지 전체 누적 획득 골드 (표시용)
    log: [],
    floaties: [],
    result: null           // 'won' | 'lost' | null
  };
}

// ─── Hire Phase ───────────────────────────────────────────────────────────────
function hireUnit(battle, typeId, gold) {
  const t = UNIT_TYPES[typeId];
  if (!t || battle.ourTeam.length >= battle.maxSlots || gold < t.cost) return gold;
  battle.ourTeam.push(makeUnit(typeId));
  return gold - t.cost;
}

function fireUnit(battle, idx) {
  if (idx < 0 || idx >= battle.ourTeam.length) return 0;
  const refund = Math.floor(UNIT_TYPES[battle.ourTeam[idx].typeId].cost / 2);
  battle.ourTeam.splice(idx, 1);
  return refund;
}

// ─── Add Enemies for Wave (생존자 풀에 신규 추가) ──────────────────────────────
function addEnemiesForWave(battle, waveIdx) {
  const def = WAVE_DEFS[waveIdx];
  for (const entry of def.addEnemies) {
    for (let i = 0; i < entry.count; i++) {
      battle.enemyTeam.push(makeMob(entry.type));
    }
  }
  // 죽은 몬스터는 제거 (새 전투를 위해)
  battle.enemyTeam = battle.enemyTeam.filter(m => !m.dead);
}

// ─── Combat Tick ──────────────────────────────────────────────────────────────
function battleTick(battle) {
  battle.tickCount++;

  const our = battle.ourTeam.filter(u => !u.dead);
  const foe = battle.enemyTeam.filter(u => !u.dead);

  if (our.length === 0 || foe.length === 0) return;

  // ── 아군 공격 ──────────────────────────────────────────────────────────────
  for (const u of our) {
    u.ticksSinceSkill++;
    const useSkill = u.ticksSinceSkill >= SKILL_TICK_CD && u.mp >= u.skillCost;

    if (useSkill) {
      u.ticksSinceSkill = 0;
      u.mp -= u.skillCost;

      if (u.healAmt > 0) {
        const target = our.slice().sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
        const healed = Math.min(target.maxHp - target.hp, u.healAmt);
        target.hp += healed;
        const idx = battle.ourTeam.indexOf(target);
        addFloaty(battle, `+${healed}`, BATTLE_TEAM_X, unitY(idx), '#34d399');
        addLog(battle, `${u.name}의 ${u.skillName}! +${healed} 회복`, u.skillColor);
        u.flashTimer = 0.3; u.flashColor = u.skillColor;
      } else {
        const target = foe[Math.floor(Math.random() * foe.length)];
        const dmg = Math.max(1, u.skillAtk - target.def);
        applyDamage(target, dmg, battle, u.skillColor, true);
        addLog(battle, `${u.name}의 ${u.skillName}! ${dmg} 피해`, u.skillColor);
      }
    } else {
      const target = foe[Math.floor(Math.random() * foe.length)];
      const dmg = Math.max(1, u.atk - target.def);
      applyDamage(target, dmg, battle, '#fbbf24', true);
    }
    u.mp = Math.min(u.maxMp, u.mp + MP_REGEN_TICK);
  }

  // ── 적 공격 ───────────────────────────────────────────────────────────────
  for (const mob of foe) {
    mob.ticksSinceSkill++;
    const useSkill = mob.ticksSinceSkill >= SKILL_TICK_CD && mob.mp >= mob.skillCost;

    if (useSkill) {
      mob.ticksSinceSkill = 0;
      mob.mp -= mob.skillCost;
      const target = our[Math.floor(Math.random() * our.length)];
      const dmg = Math.max(1, mob.skillAtk - target.def);
      applyDamage(target, dmg, battle, '#ef4444', false);
      addLog(battle, `${mob.name}의 스킬! ${dmg} 피해`, '#ef4444');
    } else {
      const target = our[Math.floor(Math.random() * our.length)];
      const dmg = Math.max(1, mob.atk - target.def);
      applyDamage(target, dmg, battle, '#fca5a5', false);
    }
    mob.mp = Math.min(mob.maxMp, mob.mp + MP_REGEN_TICK);
  }

  // ── 종료 체크 ─────────────────────────────────────────────────────────────
  const aliveOur = battle.ourTeam.filter(u => !u.dead).length;
  const aliveFoe = battle.enemyTeam.filter(u => !u.dead).length;

  if (aliveFoe === 0) { battle.phase = 'won';  battle.result = 'won';  }
  if (aliveOur === 0) { battle.phase = 'lost'; battle.result = 'lost'; }
}

function applyDamage(target, dmg, battle, color, isMobTarget) {
  target.hp -= dmg;
  target.flashTimer = 0.25;
  target.flashColor = color;

  const arr   = isMobTarget ? battle.enemyTeam : battle.ourTeam;
  const idx   = arr.indexOf(target);
  const x     = isMobTarget ? BATTLE_ENEMY_X : BATTLE_TEAM_X;
  addFloaty(battle, `-${dmg}`, x, unitY(idx), color);

  if (target.hp <= 0) {
    target.dead = true;
    target.hp   = 0;
    // 몬스터 처치 시 골드 적립
    if (isMobTarget && target.goldReward) {
      battle.goldEarned      += target.goldReward;
      battle.totalGoldEarned += target.goldReward;
      addFloaty(battle, `+${target.goldReward}💰`, x, unitY(idx) - 20, COLORS.gold);
      addLog(battle, `${target.name} 처치! +${target.goldReward}💰`, COLORS.gold);
    }
  }
}

function addLog(battle, text, color) {
  battle.log.unshift({ text, color, timer: 2.5 });
  if (battle.log.length > 5) battle.log.pop();
}

function addFloaty(battle, text, x, y, color) {
  battle.floaties.push({ text, x, y: y - BATTLE_UNIT_R, vy: -40, life: 1.2, color });
}

function unitY(idx) {
  return BATTLE_UNIT_START_Y + 40 + idx * BATTLE_UNIT_GAP + BATTLE_UNIT_R;
}

// ─── Update ──────────────────────────────────────────────────────────────────
function updateBattle(battle, dt) {
  if (battle.phase !== 'fighting') return;

  for (const u of [...battle.ourTeam, ...battle.enemyTeam]) {
    if (u.flashTimer > 0) u.flashTimer = Math.max(0, u.flashTimer - dt);
  }

  for (let i = battle.floaties.length - 1; i >= 0; i--) {
    const f = battle.floaties[i];
    f.y  += f.vy * dt;
    f.life -= dt;
    if (f.life <= 0) battle.floaties.splice(i, 1);
  }

  for (let i = battle.log.length - 1; i >= 0; i--) {
    battle.log[i].timer -= dt;
    if (battle.log[i].timer <= 0) battle.log.splice(i, 1);
  }

  battle.tickTimer += dt;
  if (battle.tickTimer >= TICK_INTERVAL) {
    battle.tickTimer -= TICK_INTERVAL;
    battleTick(battle);
  }
}

// ─── 전투 시작 ────────────────────────────────────────────────────────────────
function startFighting(battle) {
  if (battle.ourTeam.length === 0) return false;
  battle.phase      = 'fighting';
  battle.tickTimer  = 0;
  battle.tickCount  = 0;
  battle.result     = null;
  battle.goldEarned = 0;
  for (const u of battle.ourTeam)   u.ticksSinceSkill = 0;
  for (const u of battle.enemyTeam) u.ticksSinceSkill = 0;
  return true;
}

// ─── 몬스터 상태 직렬화 / 복원 (체력 이월용) ─────────────────────────────────
function serializeEnemies(enemyTeam) {
  return enemyTeam
    .filter(m => !m.dead)
    .map(m => ({ typeId: m.typeId, hp: m.hp }));
}

function restoreEnemies(serialized) {
  return (serialized || []).map(s => makeMob(s.typeId, s.hp));
}
