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

function makeMob(typeId) {
  const t = BATTLE_MOB_TYPES[typeId];
  return {
    id: ++_uid, typeId, isPlayer: false,
    name: t.name, icon: t.icon, color: t.color,
    hp: t.hp, maxHp: t.hp,
    atk: t.atk, def: t.def,
    mp: t.mp, maxMp: t.maxMp,
    skillAtk: t.skillAtk, skillCost: t.skillCost,
    ticksSinceSkill: 0,
    dead: false,
    flashTimer: 0, flashColor: '#fff'
  };
}

// ─── Battle State Machine ─────────────────────────────────────────────────────
function createBattle() {
  return {
    phase: 'hire',       // hire | fighting | won | lost | idle
    ourTeam: [],         // hired units (max 4 initially)
    enemyTeam: [],       // enemy units for this wave
    maxSlots: 4,
    tickTimer: 0,        // counts up to TICK_INTERVAL
    tickCount: 0,
    log: [],             // [{text, color, timer}]
    floaties: [],        // [{text, x, y, vy, life, color}]
    result: null         // 'won' | 'lost' | null
  };
}

// ─── Hire Phase ───────────────────────────────────────────────────────────────
function hireUnit(battle, typeId, gold) {
  const t = UNIT_TYPES[typeId];
  if (!t) return gold;
  if (battle.ourTeam.length >= battle.maxSlots) return gold;
  if (gold < t.cost) return gold;
  battle.ourTeam.push(makeUnit(typeId));
  return gold - t.cost;
}

function fireUnit(battle, idx) {
  if (idx < 0 || idx >= battle.ourTeam.length) return;
  const unit = battle.ourTeam[idx];
  const refund = Math.floor(UNIT_TYPES[unit.typeId].cost / 2);
  battle.ourTeam.splice(idx, 1);
  return refund;
}

// ─── Combat Tick ──────────────────────────────────────────────────────────────
function battleTick(battle) {
  battle.tickCount++;

  const our = battle.ourTeam.filter(u => !u.dead);
  const foe = battle.enemyTeam.filter(u => !u.dead);

  if (our.length === 0 || foe.length === 0) return;

  // ── player units attack ───────────────────────────────────────────────────
  for (const u of our) {
    u.ticksSinceSkill++;
    const useSkill = u.ticksSinceSkill >= SKILL_TICK_CD && u.mp >= u.skillCost;

    if (useSkill) {
      u.ticksSinceSkill = 0;
      u.mp -= u.skillCost;

      if (u.healAmt > 0) {
        // Healer: heal lowest HP ally
        const target = our.slice().sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
        const healed = Math.min(target.maxHp - target.hp, u.healAmt);
        target.hp += healed;
        addFloaty(battle, `+${healed}`, unitX(target), unitY(battle.ourTeam.indexOf(target)), '#34d399');
        addLog(battle, `${u.name}의 ${u.skillName}! +${healed} 회복`, u.skillColor);
        u.flashTimer = 0.3; u.flashColor = u.skillColor;
      } else {
        // Attack skill: hit all enemies OR random target
        const dmg = Math.max(1, u.skillAtk - foe[0].def);
        const target = foe[Math.floor(Math.random() * foe.length)];
        applyDamage(target, dmg, battle, u.skillColor);
        addLog(battle, `${u.name}의 ${u.skillName}! ${dmg} 피해`, u.skillColor);
      }
    } else {
      // Normal attack on random alive enemy
      const target = foe[Math.floor(Math.random() * foe.length)];
      const dmg = Math.max(1, u.atk - target.def);
      applyDamage(target, dmg, battle, '#fbbf24');
    }

    // MP regen
    u.mp = Math.min(u.maxMp, u.mp + MP_REGEN_TICK);
  }

  // ── enemy units attack ───────────────────────────────────────────────────
  for (const mob of foe) {
    mob.ticksSinceSkill++;
    const useSkill = mob.ticksSinceSkill >= SKILL_TICK_CD && mob.mp >= mob.skillCost;

    if (useSkill) {
      mob.ticksSinceSkill = 0;
      mob.mp -= mob.skillCost;
      const target = our[Math.floor(Math.random() * our.length)];
      const dmg = Math.max(1, mob.skillAtk - target.def);
      applyDamage(target, dmg, battle, '#ef4444');
      addLog(battle, `${mob.name}의 스킬! ${dmg} 피해`, '#ef4444');
    } else {
      const target = our[Math.floor(Math.random() * our.length)];
      const dmg = Math.max(1, mob.atk - target.def);
      applyDamage(target, dmg, battle, '#fca5a5');
    }
    mob.mp = Math.min(mob.maxMp, mob.mp + MP_REGEN_TICK);
  }

  // ── check end ──────────────────────────────────────────────────────────────
  const aliveOur = battle.ourTeam.filter(u => !u.dead).length;
  const aliveFoe = battle.enemyTeam.filter(u => !u.dead).length;

  if (aliveFoe === 0) { battle.phase = 'won';  battle.result = 'won';  }
  if (aliveOur === 0) { battle.phase = 'lost'; battle.result = 'lost'; }
}

function applyDamage(target, dmg, battle, color) {
  target.hp -= dmg;
  target.flashTimer = 0.25;
  target.flashColor = color;
  const isPlayer = target.isPlayer;
  const idx = (isPlayer ? battle.ourTeam : battle.enemyTeam).indexOf(target);
  const x = isPlayer ? BATTLE_TEAM_X : BATTLE_ENEMY_X;
  const y = unitY(idx);
  addFloaty(battle, `-${dmg}`, x, y, color);
  if (target.hp <= 0) { target.dead = true; target.hp = 0; }
}

function addLog(battle, text, color) {
  battle.log.unshift({ text, color, timer: 2.5 });
  if (battle.log.length > 5) battle.log.pop();
}

function addFloaty(battle, text, x, y, color) {
  battle.floaties.push({ text, x, y: y - BATTLE_UNIT_R, vy: -40, life: 1.2, color });
}

function unitX(unit) { return unit.isPlayer ? BATTLE_TEAM_X : BATTLE_ENEMY_X; }

function unitY(idx) {
  const total = 4;
  const startY = BATTLE_UNIT_START_Y + 40;
  return startY + idx * BATTLE_UNIT_GAP + BATTLE_UNIT_R;
}

// ─── Update ──────────────────────────────────────────────────────────────────
function updateBattle(battle, dt) {
  if (battle.phase !== 'fighting') return;

  // Flash timers
  for (const u of [...battle.ourTeam, ...battle.enemyTeam]) {
    if (u.flashTimer > 0) u.flashTimer = Math.max(0, u.flashTimer - dt);
  }

  // Floaties
  for (let i = battle.floaties.length - 1; i >= 0; i--) {
    const f = battle.floaties[i];
    f.y  += f.vy * dt;
    f.life -= dt;
    if (f.life <= 0) battle.floaties.splice(i, 1);
  }

  // Log timers
  for (let i = battle.log.length - 1; i >= 0; i--) {
    battle.log[i].timer -= dt;
    if (battle.log[i].timer <= 0) battle.log.splice(i, 1);
  }

  // Tick
  battle.tickTimer += dt;
  if (battle.tickTimer >= TICK_INTERVAL) {
    battle.tickTimer -= TICK_INTERVAL;
    battleTick(battle);
  }
}

// ─── Setup Enemy Team from Wave Definition ───────────────────────────────────
function setupEnemyTeam(battle, waveIdx) {
  battle.enemyTeam = [];
  const def = WAVE_DEFS[waveIdx];
  for (const entry of def.battleEnemies) {
    for (let i = 0; i < entry.count; i++) {
      battle.enemyTeam.push(makeMob(entry.type));
    }
  }
  battle.maxSlots = 4;
}

function startFighting(battle) {
  if (battle.ourTeam.length === 0) return false;
  battle.phase = 'fighting';
  battle.tickTimer = 0;
  battle.tickCount = 0;
  battle.result = null;
  // Reset tick counters
  for (const u of battle.ourTeam)   u.ticksSinceSkill = 0;
  for (const u of battle.enemyTeam) u.ticksSinceSkill = 0;
  return true;
}
