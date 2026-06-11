'use strict';

// ─── Unit factory ─────────────────────────────────────────────────────────────
let _unitId = 0;
function makeMerc(typeId) {
  const tpl = MERC_TYPES[typeId];
  return {
    id: ++_unitId,
    typeId,
    x: MERC_SPAWN_X + Math.random() * 30,
    y: GROUND_Y,
    hp: tpl.hp, maxHp: tpl.hp,
    atk: tpl.atk, atkSpd: tpl.atkSpd,
    moveSpd: tpl.moveSpd,
    radius: tpl.radius,
    facing: 1,   // +1 = right
    atkCooldown: 0,
    state: 'move', // move | fight
    target: null,
    dead: false,
    floaty: null  // floating damage text
  };
}

function makeBattleEnemy(typeId) {
  const tpl = BATTLE_ENEMY_TYPES[typeId];
  return {
    id: ++_unitId,
    typeId,
    x: MOB_SPAWN_X - Math.random() * 20,
    y: GROUND_Y,
    hp: tpl.hp, maxHp: tpl.hp,
    atk: tpl.atk, atkSpd: tpl.atkSpd,
    moveSpd: tpl.moveSpd,
    radius: tpl.radius,
    facing: -1,  // -1 = left
    atkCooldown: 0,
    state: 'move',
    target: null,
    dead: false
  };
}

// ─── Skill system ─────────────────────────────────────────────────────────────
const SKILLS = [
  { id:'rally',  name:'결집',  desc:'아군 공격력 +50% (5초)', icon:'⚡', cd:20, activeCd:0 },
  { id:'shield', name:'방패막', desc:'아군 방어 (피해 50% 감소 3초)', icon:'🛡', cd:25, activeCd:0 },
  { id:'charge', name:'돌격',  desc:'아군 이동속도 2배 (3초)', icon:'💨', cd:18, activeCd:0 }
];

const battleEffects = { rally:0, shield:0, charge:0 };

function activateSkill(skillId, mercs) {
  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill || skill.activeCd > 0) return false;
  skill.activeCd = skill.cd;
  if (skillId === 'rally')  { battleEffects.rally  = 5; }
  if (skillId === 'shield') { battleEffects.shield = 3; }
  if (skillId === 'charge') { battleEffects.charge = 3; }
  return true;
}

// ─── Update ──────────────────────────────────────────────────────────────────
function updateBattle(mercs, mobs, dt) {
  // Update effect timers
  for (const k of Object.keys(battleEffects)) {
    if (battleEffects[k] > 0) battleEffects[k] = Math.max(0, battleEffects[k] - dt);
  }
  for (const sk of SKILLS) {
    if (sk.activeCd > 0) sk.activeCd = Math.max(0, sk.activeCd - dt);
  }

  const rallyMult  = battleEffects.rally  > 0 ? 1.5 : 1;
  const chargeMult = battleEffects.charge > 0 ? 2   : 1;
  const shieldMult = battleEffects.shield > 0 ? 0.5 : 1;

  // Update mercs
  for (const m of mercs) {
    if (m.dead) continue;
    m.atkCooldown = Math.max(0, m.atkCooldown - dt);

    // Find nearest enemy in attack range
    const range = m.radius + 30;
    let nearest = null, nearDist = Infinity;
    for (const mob of mobs) {
      if (mob.dead) continue;
      const d = Math.abs(mob.x - m.x);
      if (d < nearDist) { nearest = mob; nearDist = d; }
    }

    if (nearest && nearDist <= range) {
      m.state = 'fight';
      m.target = nearest;
      if (m.atkCooldown <= 0) {
        const dmg = Math.round(m.atk * rallyMult);
        const actual = Math.max(1, Math.round(dmg * shieldMult)); // shield applies to received dmg
        nearest.hp -= dmg;
        m.atkCooldown = 1 / m.atkSpd;
        if (nearest.hp <= 0) nearest.dead = true;
      }
    } else {
      m.state = 'move';
      m.target = null;
      m.x += m.moveSpd * chargeMult * dt;
    }
    // Clamp
    m.x = Math.min(CW - m.radius, m.x);
  }

  // Update mobs
  for (const mob of mobs) {
    if (mob.dead) continue;
    mob.atkCooldown = Math.max(0, mob.atkCooldown - dt);

    const range = mob.radius + 30;
    let nearest = null, nearDist = Infinity;
    for (const m of mercs) {
      if (m.dead) continue;
      const d = Math.abs(m.x - mob.x);
      if (d < nearDist) { nearest = m; nearDist = d; }
    }

    if (nearest && nearDist <= range) {
      mob.state = 'fight';
      mob.target = nearest;
      if (mob.atkCooldown <= 0) {
        const dmg = Math.max(1, Math.round(mob.atk * shieldMult));
        nearest.hp -= dmg;
        mob.atkCooldown = 1 / mob.atkSpd;
        if (nearest.hp <= 0) nearest.dead = true;
      }
    } else {
      mob.state = 'move';
      mob.target = null;
      mob.x += mob.moveSpd * mob.facing * dt;
    }
    // Clamp (mobs shouldn't go past left edge - they "win" if they do, handled in wave.js)
  }
}
