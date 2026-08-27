'use strict';

// ─── Tower ───────────────────────────────────────────────────────────────────
// ─── 경로 교체와 타워 이설 ───────────────────────────────────────────────────
// 관문에서 경로가 바뀌면 이미 지은 타워가 새 경로 위에 놓일 수 있다.
// 부수면 Lv.5까지 올린 투자가 통째로 날아가고, 예고 없이 벌을 받는 꼴이 된다.
// 그래서 부수지 않고 인접한 빈 칸으로 옮긴다 — 레벨과 투자금은 그대로다.
// 옮길 자리가 하나도 없을 때만 전액 환불한다.
function relocateTowersOffPath(gs) {
  const occupied = new Set(gs.towers.map(t => `${t.col},${t.row}`));
  const moved = [], refunded = [];

  for (const t of gs.towers) {
    if (!isBlockedCell(t.col, t.row)) continue;
    occupied.delete(`${t.col},${t.row}`);
    const spot = nearestFreeCell(t.col, t.row, occupied);
    if (spot) {
      t.col = spot.c; t.row = spot.r;
      t.relocatedAt = Date.now();
      occupied.add(`${spot.c},${spot.r}`);
      moved.push(t);
    } else {
      refunded.push(t);
    }
  }

  let gold = 0;
  if (refunded.length) {
    gold = refunded.reduce((a, t) => a + (t.invested || 0), 0);
    gs.gold += gold;
    gs.towers = gs.towers.filter(t => !refunded.includes(t));
  }
  return { moved: moved.length, refunded: refunded.length, gold };
}

// 이 층에 맞는 경로를 적용한다. 바뀌었으면 이설 결과를 돌려준다.
function applyPathForFloor(gs, waveIndex) {
  const tier = endlessTier(waveIndex);
  const want = tier > 0 ? pathVariantFor(tier, gs.runSeed || 0) : 0;
  if (want === activePathIdx()) return null;
  applyPathVariant(want);
  const res = relocateTowersOffPath(gs);
  res.variant = want;
  return (res.moved || res.refunded) ? res : null;
}

// 다음 층에서 경로가 바뀌는가 — 준비 화면에 미리 보여주기 위한 것
function nextPathPreview(gs, waveIndex) {
  const tier = endlessTier(waveIndex);
  if (tier <= 0) return null;
  const nextIdx = pathVariantFor(tier + 1, gs.runSeed || 0);
  if (nextIdx === activePathIdx()) return null;
  return { idx: nextIdx, cells: PATH_VARIANTS[nextIdx] };
}

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
  // 층 이벤트 — 안개는 사거리를, 부식은 공격력을, 봉인은 한 종류를 통째로 막는다
  const sealed = fev('sealedTower', null) === t.typeId;
  return {
    sealed,
    dmg:   sealed ? 0 : Math.round((tpl.dmg + BONUSES.towerDmg) * m.dmg
             * (BONUSES.pactTowerDmgMult || 1) * fev('towerDmgMult', 1)),
    spd:   tpl.spd   * m.spd   * BONUSES.towerSpdMult * (overloaded ? OVERLOAD_SPD_MULT : 1),
    range: sealed ? 0 : tpl.range * m.range * BONUSES.towerRangeMult * fev('towerRangeMult', 1),
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
              * (BONUSES.pactDefHpMult || 1) * fev('hpMult', 1);
  const hp    = Math.max(1, Math.round((opts && opts.hp) || tpl.hp * scale));

  // 비행은 ∞ 경로가 아니라 항로를 탄다 — 좌우를 번갈아 써서 한쪽만 막지 못하게
  const flying = !!tpl.flying;
  if (flying && typeof tut !== 'undefined' && tut && tut.showTip) tut.showTip('air');
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
         * endlessSpdMult(w) * (mods ? (mods.spdBonus || 1) : 1)
         * fev('enemySpdMult', 1),
    dmg: Math.round(tpl.dmg * (mods ? endlessDmgMult(w) : (1 + w * 0.04))),
    reward: (opts && opts.reward) || tpl.reward,
    gems: (opts && opts.gems) || 0,
    armor: (tpl.armor || 0)
         + (mods ? (mods.armorBonus || 0) + Math.floor(w / 4)
                 : Math.floor(w / DEF_WAVE_ARMOR_EVERY))
         + (BONUSES.pactArmorBonus || 0),
    radius: tpl.radius,
    // 🌱 재생 — 심층 변형. 상단 적이 초당 최대체력의 일부를 되돌린다.
    regen: mods ? (mods.regen || 0) : 0,
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
    // 🌱 재생 — 꾸준히 깎지 못하면 원점으로 돌아간다. 단발 화력보다 지속 화력을 요구한다.
    if (e.regen > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);

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
