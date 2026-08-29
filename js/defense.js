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
    branch: null,        // ★5에서 고르는 특화. null이면 아직 안 골랐다.

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
  // ★5 분기 — 배율(mult)과 고유 특성(special)을 얹는다. 상성(aff)은 affinityOf가 본다.
  const br = towerBranchOf(t);
  const bm = (br && br.mult) || {};
  const sp = (br && br.special) || {};
  const baseSlow = sp.slow !== undefined ? sp.slow : (tpl.slow || 0);
  const st = {
    sealed,
    branch: br ? br.id : null,
    dmg:   sealed ? 0 : Math.round((tpl.dmg + BONUSES.towerDmg) * m.dmg * (bm.dmg || 1)
             * (BONUSES.towerDmgMult || 1)
             * (BONUSES.pactTowerDmgMult || 1) * fev('towerDmgMult', 1)),
    spd:   tpl.spd   * m.spd   * (bm.spd || 1) * BONUSES.towerSpdMult * (overloaded ? OVERLOAD_SPD_MULT : 1),
    range: sealed ? 0 : tpl.range * m.range * (bm.range || 1) * BONUSES.towerRangeMult * fev('towerRangeMult', 1),
    slow:        Math.min(0.85, baseSlow + (BONUSES.towerSlow || 0)),
    slowDur:     (tpl.slowDur || (BONUSES.towerSlow > 0 ? 0.9 : 0)) * (sp.slowDurMult || 1),
    splash:      sp.splash !== undefined ? sp.splash : (tpl.splash || 0),
    pierceArmor: sp.pierceArmor !== undefined ? !!sp.pierceArmor : !!tpl.pierceArmor,
    pierce:      (BONUSES.towerPierce || 0) + (sp.pierce || 0),
    // ☠️ 독탑 — 장판 피해는 그 탑의 실효 공격력에 비례한다. 강화가 장판에도 붙는다.
    poolDps:     (tpl.poolDps || 0)    * (sp.poolDpsMult || 1),
    poolRadius:  (tpl.poolRadius || 0) * (sp.poolRadiusMult || 1),
    poolDur:     (tpl.poolDur || 0)    * (sp.poolDurMult || 1),
    targetMode:  tpl.targetMode || 'nearest',
    chain:       sp.chain !== undefined ? sp.chain : (tpl.chain || 0),
    chainRange:  (tpl.chainRange || 0) * (sp.chainRangeMult || 1),
    // 분기 고유 — 발사체가 그대로 들고 간다
    critChance:  sp.critChance || 0,
    critMult:    sp.critMult   || 1,
    execute:     sp.execute    || 0,
    vsSlowed:    sp.vsSlowed   || 1,
    stunChance:  sp.stunChance || 0,
    stunDur:     sp.stunDur    || 0,
    corrode:     sp.corrode    || 0,
    overloaded
  };
  return st;
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
    // rewardMult — 스폰 편성이 마릿수를 부풀린 만큼 마리당 보상을 낮춘다
    reward: (opts && opts.reward) ||
            Math.max(1, Math.round(tpl.reward * ((opts && opts.rewardMult) || 1))),
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
    slow: 0, slowDur: 0, splash: 0, pierceArmor: false, pierce: 0
  }, opts || {});
}

// 상성 배율은 방어력 차감보다 먼저 곱한다 — 약한 타워는 방어력까지 겹쳐 더 안 통한다
function defDamage(enemy, dmg, pierceArmor, affinity, pierce) {
  // 🧪 부식 장판 위에서는 방어력이 지워지고 받는 피해가 늘어난다
  const corroded = (enemy.corrodeUntil || 0) > 0;
  const base = dmg * (affinity === undefined ? 1 : affinity) * (corroded ? 1 + enemy.corrodeAmt : 1);
  if (pierceArmor || corroded) return Math.max(1, Math.round(base));
  const armor = Math.max(0, (enemy.armor || 0) - (pierce || 0));
  return Math.max(1, Math.round(base - armor));
}

function hurtDefenseEnemy(e, dmg, pierceArmor, onKill, affinity, pierce) {
  if (e.dead || e.reached) return 0;
  const real = defDamage(e, dmg, pierceArmor, affinity, pierce);
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
    // 시간차를 두고 들어오는 적 (지금은 쓰지 않지만 배관은 남긴다)
    if (e.spawnDelay > 0) { e.spawnDelay = Math.max(0, e.spawnDelay - dt); continue; }
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    // 🧪 부식 — 장판을 벗어나면 곧 풀린다 (장판이 매 프레임 다시 채워 준다)
    if (e.corrodeUntil > 0) { e.corrodeUntil = Math.max(0, e.corrodeUntil - dt); if (!e.corrodeUntil) e.corrodeAmt = 0; }
    // 🌱 재생 — 꾸준히 깎지 못하면 원점으로 돌아간다. 단발 화력보다 지속 화력을 요구한다.
    if (e.regen > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);

    let mult = 1;
    if (e.slowTimer > 0) {
      e.slowTimer = Math.max(0, e.slowTimer - dt);
      mult = 1 - e.slowFactor;
      if (e.slowTimer === 0) e.slowFactor = 0;
    }
    // 👑 영웅이 몸으로 막고 있다 — 서리와 겹쳐도 더 느려지지, 서로 덮어쓰지 않는다
    if (e.heroBlockUntil > 0) {
      e.heroBlockUntil = Math.max(0, e.heroBlockUntil - dt);
      mult *= HERO_BLOCK_SLOW;
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
// 아직 들어오지 않은(시간차 대기 중인) 적은 없는 것으로 친다
function enemyActive(e) { return !e.dead && !e.reached && !(e.spawnDelay > 0); }

function pickTargetSmart(enemies, center, range, mode, towerTypeId, branchId) {
  let best = null, bestScore = -Infinity;
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    const d = Math.hypot(e.x - center.x, e.y - center.y);
    if (d > range) continue;
    const aff = affinityOf(towerTypeId, e, branchId);
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
    // 쿨다운이 NaN이거나 터무니없이 크면 되돌린다.
    // 한 번 NaN이 들어가면 `NaN > 0`이 false라 통과는 하지만, 이후 어떤 계산도 NaN이 되어
    // 그 타워는 영영 쏘지 않는다. 값이 오염될 경로를 다 막기보다 매 프레임 제자리로 돌린다.
    if (!(tower.cooldown >= 0) || tower.cooldown > 60) tower.cooldown = 0;
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    if (tower.cooldown > 0) continue;

    const st     = towerStats(tower);
    const center = cellCenter(tower.col, tower.row);
    const best   = pickTargetSmart(enemies, center, st.range, st.targetMode, tower.typeId, st.branch);
    if (!best) continue;

    // spd가 0이나 NaN이면 1/spd가 Infinity·NaN이 되어 그 타워가 멈춘다
    tower.cooldown = 1 / Math.max(0.05, (st.spd > 0 ? st.spd : 1));
    tower.muzzle   = 0.12;

    const tpl  = TOWER_TYPES[tower.typeId];
    const proj = makeProjectile(center.x, center.y, best, st.dmg, tpl.projColor, {
      slow: st.slow, slowDur: st.slowDur,
      splash: st.splash || (BONUSES.towerSplash ? 34 : 0),
      pierceArmor: st.pierceArmor,
      pierce: st.pierce || 0,
      poolDps: st.poolDps || 0, poolRadius: st.poolRadius || 0, poolDur: st.poolDur || 0,
      spd: tower.typeId === 'sniper' ? 620 : 320,
      owner: tower,
      towerTypeId: tower.typeId,
      branchId: st.branch,
      chain: st.chain, chainRange: st.chainRange,
      // ★5 분기 고유 — 명중 시점에 발사체가 그대로 들고 간다
      critChance: st.critChance, critMult: st.critMult, execute: st.execute,
      vsSlowed: st.vsSlowed, stunChance: st.stunChance, stunDur: st.stunDur,
      corrode: st.corrode
    });
    proj._enemies = enemies;
    projectiles.push(proj);
    if (typeof SFX !== 'undefined') {
      if (tower.typeId === 'cannon') SFX.cannon(); else SFX.shoot();
    }
  }
}

// ─── ☠️ 독 장판 ──────────────────────────────────────────────────────────────
// 같은 자리에 겹쳐 깔면 피해가 곱절이 된다. 겹치는 것 자체는 허용하되
// 아주 가까운 장판은 시간만 새로 채워서, 독탑 도배가 무한 중첩이 되지 않게 한다.
function spawnPoisonPool(x, y, p) {
  const pools = gs.poisonPools || (gs.poisonPools = []);
  const r = p.poolRadius || POISON_POOL_RADIUS;
  for (const q of pools) {
    if (Math.hypot(q.x - x, q.y - y) < r * 0.45) {
      q.life = Math.max(q.life, p.poolDur || POISON_POOL_DUR);
      q.dps  = Math.max(q.dps, p.dmg * (p.poolDps || POISON_POOL_DPS));
      return;
    }
  }
  if (pools.length >= POISON_POOL_MAX) pools.shift();
  pools.push({
    x, y, r,
    dps:   p.dmg * (p.poolDps || POISON_POOL_DPS),
    life:  p.poolDur || POISON_POOL_DUR,
    maxLife: p.poolDur || POISON_POOL_DUR,
    owner: p.owner || null,
    towerTypeId: p.towerTypeId || 'poison',
    branchId: p.branchId || null,
    corrode: p.corrode || 0,
    pierce: p.pierce || 0
  });
}

// 밟고 있는 적을 계속 깎는다. 피해가 1을 넘을 때만 실제로 적용한다 —
// 프레임마다 소수점을 반올림하면 배속에 따라 총량이 달라진다.
function updatePoisonPools(enemies, onKill, dt) {
  const pools = gs.poisonPools;
  if (!pools || !pools.length) return;
  for (let i = pools.length - 1; i >= 0; i--) {
    const q = pools[i];
    q.life -= dt;
    if (q.life <= 0) { pools.splice(i, 1); continue; }
    for (const e of enemies) {
      if (e.dead || e.reached || e.flying) continue;   // 비행은 장판 위를 지나간다
      if (Math.hypot(e.x - q.x, e.y - q.y) > q.r + (e.radius || 0)) continue;
      const aff = affinityOf(q.towerTypeId, e, q.branchId);
      // 🧪 부식 — 장판을 밟는 동안 방어력을 잃고 받는 피해가 늘어난다.
      // 이 분기 혼자서는 약하다. 옆에 선 다른 타워 전부를 세게 만드는 것이 값어치다.
      if (q.corrode > 0) { e.corrodeUntil = 0.6; e.corrodeAmt = Math.max(e.corrodeAmt || 0, q.corrode); }
      e._poisonAccum = (e._poisonAccum || 0) + q.dps * aff * dt;
      if (e._poisonAccum < 1) continue;
      const tick = Math.floor(e._poisonAccum);
      e._poisonAccum -= tick;
      const dealt = hurtDefenseEnemy(e, tick, false, victim => {
        if (q.owner) q.owner.kills++;
        if (onKill) onKill(victim, q.owner);
      }, 1, q.pierce);
      if (q.owner) q.owner.damageDealt += dealt;
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
    // ☠️ 독탑 — 맞은 자리에 장판을 깐다. 한 발의 값보다 자리에 남는 값이 크다.
    if (p.poolDps > 0) spawnPoisonPool(p.tx, p.ty, p);
    const aff   = p.towerTypeId ? affinityOf(p.towerTypeId, tgt, p.branchId) : 1;

    // ── ★5 분기 고유 ────────────────────────────────────────────────────
    let dmg = p.dmg, crit = false;
    // 💎 서릿발 — 이미 느려진 적에게만 값을 낸다. 혼자 두면 감속이 약해 손해다.
    if (p.vsSlowed > 1 && (tgt.slowTimer > 0 || tgt.heroBlockUntil > 0)) dmg *= p.vsSlowed;
    // 🎯 헤드샷 — 평균은 ×1.8이지만 한 발 한 발이 흔들린다
    if (p.critChance > 0 && Math.random() < p.critChance) { dmg *= p.critMult; crit = true; }

    const dealt = hurtDefenseEnemy(tgt, dmg, p.pierceArmor, credit, aff, p.pierce);
    if (p.owner) p.owner.damageDealt += dealt;
    if (crit && typeof spawnFloaty === 'function') {
      spawnFloaty('치명타!', tgt.x, tgt.y - (tgt.radius || 8) - 12, '#f0abfc');
    }
    // 💀 대물 저격 — 여기까지 깎았으면 끝낸다. 보스의 마지막 한 토막을 지운다.
    if (p.execute > 0 && !tgt.dead && !tgt.reached && tgt.hp > 0
        && tgt.hp <= tgt.maxHp * p.execute) {
      const left = Math.ceil(tgt.hp);
      hurtDefenseEnemy(tgt, left, true, credit, 1, 0);
      if (p.owner) p.owner.damageDealt += left;
      if (typeof spawnFloaty === 'function') spawnFloaty('💀 처형', tgt.x, tgt.y - 14, '#ef4444');
      if (typeof FX !== 'undefined') FX.burst(tgt.x, tgt.y, '#ef4444', 12, 16);
    }
    // 🔋 과충전 — 감전. 스턴 전용 필드를 새로 만들지 않고 아주 센 감속으로 낸다.
    if (p.stunChance > 0 && !tgt.dead && Math.random() < p.stunChance) {
      tgt.slowFactor = Math.max(tgt.slowFactor, 0.95);
      tgt.slowTimer  = Math.max(tgt.slowTimer, p.stunDur);
      if (typeof FX !== 'undefined') FX.ring(tgt.x, tgt.y, '#facc15', 10);
    }
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
        const cAff = affinityOf(p.towerTypeId, next, p.branchId);
        const cd = hurtDefenseEnemy(next, p.dmg * 0.6, p.pierceArmor, credit, cAff, p.pierce);
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
                                     p.towerTypeId ? affinityOf(p.towerTypeId, e, p.branchId) : 1,
                                     p.pierce);
          if (p.owner) p.owner.damageDealt += d;
          // 🌨️ 눈보라 — 감속을 들고 있는 발사체는 범위에도 감속을 남긴다.
          // 이게 없으면 "착탄 범위 감속"이 그냥 범위 피해였다.
          if (p.slow > 0) {
            e.slowFactor = Math.max(e.slowFactor, p.slow);
            e.slowTimer  = Math.max(e.slowTimer, p.slowDur);
          }
        }
      }
      if (typeof FX !== 'undefined') FX.burst(tgt.x, tgt.y, p.color, 10, p.splash * 0.4);
    } else if (typeof FX !== 'undefined') {
      FX.burst(tgt.x, tgt.y, p.color, 3, 8);
    }

    projectiles.splice(i, 1);
  }
}
