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
  const m   = TOWER_LEVEL_MULT[Math.min(t.level || 1, towerLevelCap())] || TOWER_LEVEL_MULT[1];
  const overloaded = (t.overloadUntil || 0) > 0;
  return {
    dmg:   Math.round((tpl.dmg + BONUSES.towerDmg) * m.dmg * (BONUSES.pactTowerDmgMult || 1)),
    spd:   tpl.spd   * m.spd   * BONUSES.towerSpdMult * (overloaded ? OVERLOAD_SPD_MULT : 1),
    range: tpl.range * m.range * BONUSES.towerRangeMult,
    slow:        tpl.slow ? Math.min(0.8, tpl.slow) : 0,
    slowDur:     tpl.slowDur || 0,
    splash:      tpl.splash || 0,
    pierceArmor: !!tpl.pierceArmor,
    targetMode:  tpl.targetMode || 'nearest',
    chain:       tpl.chain || 0,
    chainRange:  tpl.chainRange || 0,
    overloaded
  };
}

// ─── Defense Enemy ────────────────────────────────────────────────────────────
let _defEnemyId = 0;
let _airLaneCounter = 0;

function makeDefenseEnemy(typeId, waveIndex, opts) {
  const tpl   = ENEMY_TYPES[typeId];
  const w     = Math.max(0, waveIndex || 0);
  // 훈련은 웨이브당 선형, 무한은 층 곡선 + 그 층의 변형. 둘을 겹쳐 쓰지 않는다.
  const mods  = endlessMods(w);
  const scale = (mods ? endlessStatMult(w) * (mods.hpBonus || 1)
                      : (1 + w * DEF_WAVE_HP_SCALE))
              * (BONUSES.pactDefHpMult || 1);
  const hp    = Math.max(1, Math.round((opts && opts.hp) || tpl.hp * scale));

  // 비행은 ∞ 경로가 아니라 항로를 탄다 — 좌우를 번갈아 써서 한쪽만 막지 못하게
  const flying = !!tpl.flying;
  const path   = flying ? airPathFor(_airLaneCounter++) : THE_PATH;
  const start  = cellCenter(path[0][0], path[0][1]);

  return {
    id: ++_defEnemyId,
    typeId,
    cls: tpl.cls || 'medium',
    flying,
    isBounty: !!tpl.isBounty,
    path,
    wpIdx: 0,
    x: start.x, y: start.y,
    hp, maxHp: hp,
    spd: tpl.spd * ENEMY_CELL_SPD * (BONUSES.pactEnemySpdMult || 1)
         * endlessSpdMult(w) * (mods ? (mods.spdBonus || 1) : 1),
    dmg: Math.round(tpl.dmg * (mods ? endlessDmgMult(w) : (1 + w * 0.04))),
    reward: (opts && opts.reward) || tpl.reward,
    gems: (opts && opts.gems) || 0,
    armor: (tpl.armor || 0)
         + (mods ? (mods.armorBonus || 0) + Math.floor(w / 4)
                 : Math.floor(w / DEF_WAVE_ARMOR_EVERY))
         + (BONUSES.pactArmorBonus || 0),
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

// 상성 배율은 방어력 차감보다 먼저 곱한다 — 약한 타워는 방어력까지 겹쳐 더 안 통한다
function defDamage(enemy, dmg, pierceArmor, affinity) {
  const base = dmg * (affinity === undefined ? 1 : affinity);
  if (pierceArmor) return Math.max(1, Math.round(base));
  return Math.max(1, Math.round(base - (enemy.armor || 0)));
}

function hurtDefenseEnemy(e, dmg, pierceArmor, onKill, affinity) {
  if (e.dead || e.reached) return 0;
  const real = defDamage(e, dmg, pierceArmor, affinity);
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

// 상성이 좋은 적을 우선 노린다. 대포탑이 박쥐를 붙잡고 헛되이 쏘는 것을 막는다.
function pickTargetSmart(enemies, center, range, mode, towerTypeId) {
  let best = null, bestScore = -Infinity;
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    const d = Math.hypot(e.x - center.x, e.y - center.y);
    if (d > range) continue;
    const aff = affinityOf(towerTypeId, e);
    // 거의 안 통하는 상대(0.5 미만)는 다른 표적이 있으면 넘긴다
    let score = aff * 100;
    if (mode === 'strongest') score += e.hp * 0.05;
    else                      score += (range - d) * 0.02;
    if (e.isBounty) score += 40;          // 현상수배는 놓치면 손해가 크다
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function updateTowers(towers, enemies, projectiles, dt) {
  for (const tower of towers) {
    if (tower.muzzle > 0) tower.muzzle = Math.max(0, tower.muzzle - dt);
    if (tower.overloadUntil > 0) tower.overloadUntil = Math.max(0, tower.overloadUntil - dt);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.cooldown > 0) continue;

    const st     = towerStats(tower);
    const center = cellCenter(tower.col, tower.row);
    const best   = pickTargetSmart(enemies, center, st.range, st.targetMode, tower.typeId);
    if (!best) continue;

    tower.cooldown = 1 / st.spd;
    tower.muzzle   = 0.12;

    const tpl  = TOWER_TYPES[tower.typeId];
    const proj = makeProjectile(center.x, center.y, best, st.dmg, tpl.projColor, {
      slow: st.slow, slowDur: st.slowDur,
      splash: st.splash || (BONUSES.towerSplash ? 34 : 0),
      pierceArmor: st.pierceArmor,
      spd: tower.typeId === 'sniper' ? 620 : 320,
      owner: tower,
      towerTypeId: tower.typeId,
      chain: st.chain, chainRange: st.chainRange
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
    const aff   = p.towerTypeId ? affinityOf(p.towerTypeId, tgt) : 1;
    const dealt = hurtDefenseEnemy(tgt, p.dmg, p.pierceArmor, credit, aff);
    if (p.owner) p.owner.damageDealt += dealt;
    // 상성이 갈리는 순간을 눈에 보이게 — 왜 안 죽는지 알아야 배치를 바꾼다
    if (typeof spawnFloaty === 'function' && p.towerTypeId && (aff >= 1.2 || aff <= 0.6)) {
      if (Math.random() < 0.25) {
        spawnFloaty(aff >= 1.2 ? '효과적!' : '저항', tgt.x, tgt.y - (tgt.radius || 8) - 6,
                    aff >= 1.2 ? '#22c55e' : '#94a3b8');
      }
    }

    // ⚡ 번개탑 연쇄 — 근처 적으로 튄다
    if (p.chain > 0) {
      let hops = p.chain, from = tgt;
      const hit = new Set([tgt]);
      while (hops-- > 0) {
        let next = null, nd = p.chainRange;
        for (const e of (p._enemies || [])) {
          if (hit.has(e) || e.dead || e.reached) continue;
          const d = Math.hypot(e.x - from.x, e.y - from.y);
          if (d < nd) { nd = d; next = e; }
        }
        if (!next) break;
        hit.add(next);
        const cAff = affinityOf(p.towerTypeId, next);
        const cd = hurtDefenseEnemy(next, p.dmg * 0.6, p.pierceArmor, credit, cAff);
        if (p.owner) p.owner.damageDealt += cd;
        if (typeof FX !== 'undefined') FX.spark(from.x, from.y, next.x, next.y, p.color);
        from = next;
      }
    }

    if (p.slow > 0) {
      tgt.slowFactor = Math.max(tgt.slowFactor, p.slow);
      tgt.slowTimer  = Math.max(tgt.slowTimer, p.slowDur);
    }

    if (p.splash > 0) {
      for (const e of (p._enemies || [])) {
        if (e === tgt || e.dead || e.reached) continue;
        if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < p.splash) {
          const d = hurtDefenseEnemy(e, p.dmg * 0.5, p.pierceArmor, credit,
                                     p.towerTypeId ? affinityOf(p.towerTypeId, e) : 1);
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
