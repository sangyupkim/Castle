'use strict';

// ─── Tower ───────────────────────────────────────────────────────────────────
function makeTower(col, row, typeId) {
  return {
    col, row, typeId,
    level: 1,
    invested: TOWER_TYPES[typeId].cost,
    cooldown: 0,
    kills: 0,
    damageDealt: 0,
    muzzle: 0
  };
}

// 레벨 + 현재 BONUSES를 반영한 실효 스탯.
// 건설 시점에 스냅샷하지 않으므로, 나중에 산 강화도 기존 타워에 적용된다.
function towerStats(t) {
  const tpl = TOWER_TYPES[t.typeId];
  const m   = TOWER_LEVEL_MULT[t.level || 1] || TOWER_LEVEL_MULT[1];
  return {
    dmg:   Math.round((tpl.dmg + BONUSES.towerDmg) * m.dmg),
    spd:   tpl.spd   * m.spd   * BONUSES.towerSpdMult,
    range: tpl.range * m.range * BONUSES.towerRangeMult,
    slow:        tpl.slow ? Math.min(0.8, tpl.slow) : 0,
    slowDur:     tpl.slowDur || 0,
    splash:      tpl.splash || 0,
    pierceArmor: !!tpl.pierceArmor,
    targetMode:  tpl.targetMode || 'nearest'
  };
}

// ─── Defense Enemy ────────────────────────────────────────────────────────────
let _defEnemyId = 0;
function makeDefenseEnemy(typeId, waveIndex) {
  const tpl   = ENEMY_TYPES[typeId];
  const w     = Math.max(0, waveIndex || 0);
  const scale = 1 + w * DEF_WAVE_HP_SCALE;
  const hp    = Math.max(1, Math.round(tpl.hp * scale));
  const start = cellCenter(THE_PATH[0][0], THE_PATH[0][1]);
  return {
    id: ++_defEnemyId,
    typeId,
    path: THE_PATH,
    wpIdx: 0,
    x: start.x, y: start.y,
    hp, maxHp: hp,
    spd: tpl.spd * ENEMY_CELL_SPD,
    dmg: Math.round(tpl.dmg * (1 + w * 0.04)),
    reward: tpl.reward,
    armor: (tpl.armor || 0) + Math.floor(w / DEF_WAVE_ARMOR_EVERY),
    radius: tpl.radius,
    slowTimer: 0, slowFactor: 0,
    hitFlash: 0,
    dead: false,
    reached: false
  };
}

// ─── Projectile ───────────────────────────────────────────────────────────────
function makeProjectile(sx, sy, target, dmg, color, opts) {
  return Object.assign({
    x: sx, y: sy, tx: target.x, ty: target.y,
    target, dmg, color, spd: 320,
    slow: 0, slowDur: 0, splash: 0, pierceArmor: false
  }, opts || {});
}

function defDamage(enemy, dmg, pierceArmor) {
  if (pierceArmor) return Math.max(1, Math.round(dmg));
  return Math.max(1, Math.round(dmg - (enemy.armor || 0)));
}

function hurtDefenseEnemy(e, dmg, pierceArmor, onKill) {
  if (e.dead || e.reached) return 0;
  const real = defDamage(e, dmg, pierceArmor);
  e.hp -= real;
  e.hitFlash = 0.12;
  if (e.hp <= 0) {
    e.hp = 0;
    e.dead = true;
    if (onKill) onKill(e);
  }
  return real;
}

// ─── Update Logic ─────────────────────────────────────────────────────────────
function updateDefenseEnemies(enemies, dt) {
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

    let mult = 1;
    if (e.slowTimer > 0) {
      e.slowTimer = Math.max(0, e.slowTimer - dt);
      mult = 1 - e.slowFactor;
      if (e.slowTimer === 0) e.slowFactor = 0;
    }

    if (e.wpIdx >= e.path.length - 1) { e.reached = true; continue; }

    const next = cellCenter(e.path[e.wpIdx + 1][0], e.path[e.wpIdx + 1][1]);
    const dx = next.x - e.x, dy = next.y - e.y;
    const dist = Math.hypot(dx, dy);
    const step = e.spd * mult * dt;

    if (step >= dist) {
      e.x = next.x; e.y = next.y;
      e.wpIdx++;
    } else {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }
}

function pickTarget(enemies, center, range, mode) {
  let best = null, bestScore = mode === 'strongest' ? -1 : Infinity;
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    const d = Math.hypot(e.x - center.x, e.y - center.y);
    if (d > range) continue;
    if (mode === 'strongest') {
      if (e.hp > bestScore) { best = e; bestScore = e.hp; }
    } else {
      if (d < bestScore) { best = e; bestScore = d; }
    }
  }
  return best;
}

function updateTowers(towers, enemies, projectiles, dt) {
  for (const tower of towers) {
    if (tower.muzzle > 0) tower.muzzle = Math.max(0, tower.muzzle - dt);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.cooldown > 0) continue;

    const st     = towerStats(tower);
    const center = cellCenter(tower.col, tower.row);
    const best   = pickTarget(enemies, center, st.range, st.targetMode);
    if (!best) continue;

    tower.cooldown = 1 / st.spd;
    tower.muzzle   = 0.12;

    const tpl  = TOWER_TYPES[tower.typeId];
    const proj = makeProjectile(center.x, center.y, best, st.dmg, tpl.projColor, {
      slow: st.slow, slowDur: st.slowDur,
      splash: st.splash || (BONUSES.towerSplash ? 34 : 0),
      pierceArmor: st.pierceArmor,
      spd: tower.typeId === 'sniper' ? 620 : 320,
      owner: tower
    });
    proj._enemies = enemies;
    projectiles.push(proj);
    if (typeof SFX !== 'undefined') {
      if (tower.typeId === 'cannon') SFX.cannon(); else SFX.shoot();
    }
  }
}

function updateProjectiles(projectiles, onKill, dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p   = projectiles[i];
    const tgt = p.target;

    if (!tgt || tgt.dead || tgt.reached) { projectiles.splice(i, 1); continue; }

    p.tx = tgt.x; p.ty = tgt.y;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.spd * dt;

    if (step < dist) {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      continue;
    }

    // ── 명중 ──────────────────────────────────────────────────────────────
    if (p.visual) {                       // 영웅 사격은 연출 전용 (피해는 즉시 적용됨)
      if (typeof FX !== 'undefined') FX.burst(tgt.x, tgt.y, p.color, 4, 9);
      projectiles.splice(i, 1);
      continue;
    }

    const credit = victim => {
      if (p.owner) p.owner.kills++;
      if (onKill) onKill(victim, p.owner);
    };
    const dealt = hurtDefenseEnemy(tgt, p.dmg, p.pierceArmor, credit);
    if (p.owner) p.owner.damageDealt += dealt;

    if (p.slow > 0) {
      tgt.slowFactor = Math.max(tgt.slowFactor, p.slow);
      tgt.slowTimer  = Math.max(tgt.slowTimer, p.slowDur);
    }

    if (p.splash > 0) {
      for (const e of (p._enemies || [])) {
        if (e === tgt || e.dead || e.reached) continue;
        if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < p.splash) {
          const d = hurtDefenseEnemy(e, p.dmg * 0.5, p.pierceArmor, credit);
          if (p.owner) p.owner.damageDealt += d;
        }
      }
      if (typeof FX !== 'undefined') FX.burst(tgt.x, tgt.y, p.color, 10, p.splash * 0.4);
    } else if (typeof FX !== 'undefined') {
      FX.burst(tgt.x, tgt.y, p.color, 3, 8);
    }

    projectiles.splice(i, 1);
  }
}
