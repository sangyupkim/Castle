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
// 분기 객체에서 id만 — towerStats 안에서 여러 번 쓰므로 짧게
function st_branchId(br) { return br ? br.id : null; }

function towerStats(t) {
  const tpl = TOWER_TYPES[t.typeId];
  const m   = TOWER_LEVEL_MULT[towerStatLevel(t)] || TOWER_LEVEL_MULT[1];
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
    // 🔥 캠프 단련 — 종류별(campTower)과 분기별(campBranch) 배율이 여기서 붙는다.
    // "저격탑을 주력으로 쓰겠다"가 캠프에서부터 시작되는 결정이 되게 하는 자리다.
    dmg:   sealed ? 0 : Math.round((tpl.dmg + BONUSES.towerDmg) * m.dmg * (bm.dmg || 1)
             * (BONUSES.towerDmgMult || 1)
             * campTowerMult(t.typeId, 'dmg') * campBranchMult(st_branchId(br), 'dmg')
             * (BONUSES.pactTowerDmgMult || 1) * fev('towerDmgMult', 1)),
    spd:   tpl.spd   * m.spd   * (bm.spd || 1) * BONUSES.towerSpdMult
             * campTowerMult(t.typeId, 'spd') * campBranchMult(st_branchId(br), 'spd')
             * (overloaded ? OVERLOAD_SPD_MULT : 1)
             // 🌫 중간보스의 흐림 — 잠깐 굼떠진다. 부수는 게 아니라 무르게 하는 정도다.
             * ((typeof midBossDulled === 'function' && typeof gs !== 'undefined'
                 && midBossDulled(gs)) ? 0.75 : 1),
    range: sealed ? 0 : tpl.range * m.range * (bm.range || 1) * BONUSES.towerRangeMult
             * campTowerMult(t.typeId, 'range') * fev('towerRangeMult', 1),
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
  // ✦ ★6부터 붙은 특수능력을 얹는다. 분기(sp) 위에 더해지므로
  // "저격탑 대공 분기 + 연쇄 + 처형" 같은 조합이 나온다.
  applyTowerPerks(t, st);
  return st;
}

// 타워에 붙은 특수능력을 실효 스탯에 반영한다.
// 배율은 곱하고, 확률·범위 같은 것은 이미 있는 값과 큰 쪽을 쓴다 —
// 분기가 이미 급소를 주는데 능력이 그것을 덮어써 낮추면 승급이 손해가 된다.
function applyTowerPerks(t, st) {
  const ids = (t && Array.isArray(t.perks)) ? t.perks : null;
  if (!ids || !ids.length || typeof towerPerkDef !== 'function') return st;
  for (const id of ids) {
    const p = towerPerkDef(id);
    if (!p) continue;
    if (p.mult) for (const k of Object.keys(p.mult)) st[k] = (st[k] || 0) * p.mult[k];
    if (p.add)  for (const k of Object.keys(p.add))  st[k] = (st[k] || 0) + p.add[k];
    if (p.set)  for (const k of Object.keys(p.set))  st[k] = Math.max(st[k] || 0, p.set[k]);
    if (p.pierceMul) st.piercePct = Math.min(0.90, (st.piercePct || 0) + p.pierceMul);
  }
  st.dmg  = Math.round(st.dmg);
  st.slow = Math.min(0.85, st.slow);
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
              * (BONUSES.pactDefHpMult || 1) * fev('hpMult', 1)
              // ♾️ 무한 — 층마다 한 겹씩 더 무거워진다. 악몽 10과 같은 층에서
              // 시작해 갈수록 벌어지므로, 무한이 언제나 가장 어려운 갈래로 남는다.
              * (typeof gs !== 'undefined' && gs && gs.unbounded
                 ? unboundedFloorMult(endlessTier(w)) : 1);
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
    // 👹 마왕은 층 이동속도 곡선을 타지 않는다.
    // 100층 곡선을 그대로 먹이면 '느리고 거대한 것'이 35초 만에 기지에 닿아,
    // 보스전의 제한 시간이 층마다 흔들린다. 보스가 걸어오는 시간은 고정이어야
    // "언제까지 잡아야 하나"가 읽힌다. 서약·층 이벤트는 그대로 받는다.
    spd: tpl.spd * ENEMY_CELL_SPD * (BONUSES.pactEnemySpdMult || 1)
         * (tpl.isBoss ? 1 : endlessSpdMult(w) * (mods ? (mods.spdBonus || 1) : 1))
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

// 👹 마왕 — 100층에 한 마리만. 체력을 직접 정해 준다.
function spawnDemonLord(gsp, waveIndex) {
  const hp = demonLordHp(gsp.nightmare || 0);
  const e = makeDefenseEnemy('demonlord', waveIndex, { hp, reward: ENEMY_TYPES.demonlord.reward });
  e.isBoss = true;
  gsp.defenseEnemies.push(e);
  if (typeof spawnFloaty === 'function')
    spawnFloaty('👹 마왕이 나타났다', CW/2, DEFENSE_H/2, '#dc2626');
  if (typeof addLog === 'function')
    addLog(gsp.battle, `👹 마왕 — HP ${hp.toLocaleString()} · 기지에 닿으면 그대로 끝납니다`, '#dc2626');
  if (typeof FX  !== 'undefined') FX.shake(9, 0.8);
  if (typeof SFX !== 'undefined') SFX.lose();
  return e;
}

// 🐲 상단 중간보스 — 잡몹과 함께 온다. 마왕과 달리 일반 스폰을 막지 않는다.
// 마왕은 '그 한 마리가 곧 결승선'이지만, 중간보스는 **평소의 층 위에 얹힌 벽**이다.
function spawnMidBoss(gsp, waveIndex) {
  const tier = endlessTier(waveIndex);
  const hp   = midBossHp(tier, gsp.nightmare || 0);
  const e = makeDefenseEnemy('brute', waveIndex, { hp, reward: 60 + tier * 4 });
  e.isMidBoss = true;
  e.name   = midBossName(tier);
  e.color  = '#f43f5e';
  e.radius = Math.round((e.radius || 14) * 1.7);
  e.spd    = (e.spd || 1) * 0.72;          // 느리고 무겁다
  e.armor  = Math.round((e.armor || 0) + 6 + tier * 0.16);
  e.dmg    = Math.round((e.dmg || 1) * 3);  // 놓치면 성벽이 크게 깎인다
  // 예전에는 잡몹이 먼저 오고 보스가 6초 뒤에 왔다. 지금은 중간보스 층도
  // 한쪽 전선만 쓰므로 잡몹 자체가 없다 — 기다릴 이유가 사라져서 0으로 뒀다.
  e.spawnDelay = 0;
  // 잡으면 보석 — 하단 중간보스와 같은 값을 준다. 어느 쪽에 나오든 값은 같아야
  // "이번엔 상단이라 손해"가 되지 않는다.
  e.gems = Math.round((2 + Math.floor(tier / 20)) * (BONUSES.summonRewardMult || 1));
  gsp.defenseEnemies.push(e);
  if (typeof addLog === 'function')
    addLog(gsp.battle, `🐲 ${e.name} — 상단에 나타납니다 (HP ${Math.round(hp).toLocaleString()})`, '#f43f5e');
  return e;
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
  // 관통은 두 겹이다. 비율(towerPiercePct)이 먼저 방어력을 깎고, 그 뒤에 정액이 빠진다.
  // 정액만 있던 시절엔 60층 몹 방어력이 세 자리라 '방어 12 무시'가 사실상 0이었다.
  const pct   = Math.min(0.90, Math.max(0, BONUSES.towerPiercePct || 0));
  // 🪨 중간보스의 단단해짐 — 잠깐 방어가 두꺼워진다
  const hard  = (enemy.hardenUntil || 0) > 0 ? 1.6 : 1;
  const armor = Math.max(0, (enemy.armor || 0) * hard * (1 - pct) - (pierce || 0));
  return Math.max(1, Math.round(base - armor));
}

// 👹 기믹이 이 적에게 걸려 있나 — 보스 본인에게만 적용된다.
// 잡몹까지 면역이 되면 그건 기믹이 아니라 그냥 층이 하나 더 어려워지는 것이다.
function bossImmune(e, id) {
  return !!(e && (e.isBoss || e.isMidBoss) && typeof bossEffect === 'function'
            && typeof gs !== 'undefined' && bossEffect(gs, id));
}

function hurtDefenseEnemy(e, dmg, pierceArmor, onKill, affinity, pierce) {
  if (e.dead || e.reached) return 0;
  // 🛡 경화 — 대형 특화(상성 1.2 이상) 공격이 통하지 않는다
  if (bossImmune(e, 'antibig') && (affinity === undefined ? 1 : affinity) >= 1.2) {
    if (typeof spawnFloaty === 'function' && Math.random() < 0.2)
      spawnFloaty('🛡 무효', e.x, e.y - 18, '#94a3b8');
    return 0;
  }
  let real = defDamage(e, dmg, pierceArmor, affinity, pierce);
  // 🎯 사냥 표식(신궁) — 표식이 붙은 동안 받는 피해가 늘어난다.
  // 상단은 아레나처럼 경과 시간(elapsed)이 없어서 남은 초를 직접 깎는다.
  if ((e.markedUntil || 0) > 0) real = Math.round(real * 1.6);
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
    // 🐲 중간보스가 건 것들 — 시간이 지나면 풀린다
    if (e.rallyUntil  > 0) e.rallyUntil  = Math.max(0, e.rallyUntil  - dt);
    if (e.hardenUntil > 0) e.hardenUntil = Math.max(0, e.hardenUntil - dt);
    // 🧪 부식 — 장판을 벗어나면 곧 풀린다 (장판이 매 프레임 다시 채워 준다)
    if (e.corrodeUntil > 0) { e.corrodeUntil = Math.max(0, e.corrodeUntil - dt); if (!e.corrodeUntil) e.corrodeAmt = 0; }
    // 🌱 재생 — 꾸준히 깎지 못하면 원점으로 돌아간다. 단발 화력보다 지속 화력을 요구한다.
    if (e.regen > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regen * dt);
    if (e.markedUntil > 0) e.markedUntil = Math.max(0, e.markedUntil - dt);

    let mult = 1;
    // 📣 포효 — 중간보스가 북돋운 잡몹이 잠깐 빨라진다
    if (e.rallyUntil > 0) mult *= 1.35;
    // 💨 질주 — 보스만 빨라진다
    if ((e.isBoss || e.isMidBoss) && typeof bossEffect === 'function' && bossEffect(gs, 'haste'))
      mult *= 1.6;
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

    if (e.wpIdx >= e.path.length - 1) {
      // 👹 보스는 끝에 닿아도 바로 성으로 박지 않는다 — 정해진 바퀴를 다 돌아야 한다.
      // 그 안에 못 잡으면 그때 성으로 간다. 못 막으면 클리어가 안 되는 구조다.
      if ((e.isBoss || e.isMidBoss) && typeof bossLapDone === 'function'
          && typeof bossActive === 'function' && bossActive(gs) && gs.boss.side === 'top') {
        const done = bossLapDone(gs);
        if (!done) {                      // 다시 출발점으로 — 한 바퀴 더
          e.wpIdx = 0;
          const s0 = cellCenter(e.path[0][0], e.path[0][1]);
          e.x = s0.x; e.y = s0.y;
          continue;
        }
      }
      e.reached = true; continue;
    }

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
    // 아직 들어오지 않은 적에게 쏘면 그 탄은 버려진다 — enemyActive와 기준을 맞춘다
    if (!enemyActive(e)) continue;
    const d = Math.hypot(e.x - center.x, e.y - center.y);
    if (d > range) continue;
    const aff = affinityOf(towerTypeId, e, branchId);
    // 거의 안 통하는 상대는 다른 표적이 있으면 넘긴다
    let score = aff * 100;
    // 'strongest'의 체력 항이 예전엔 hp * 0.05였다. 체력이 세 자리이던 시절의 값이라
    // 35층(808~4660)만 가도 상성 항(최대 160)을 완전히 덮어버렸고, 모든 저격탑이
    // 체력 1등 하나에게만 몰려 쏘는 동안 나머지는 무피해로 지나갔다.
    // 로그로 눌러서 "센 놈 우선"은 유지하되 상성이 끝까지 의미를 갖게 한다.
    if (mode === 'strongest') score += Math.min(60, Math.log10(Math.max(1, e.hp)) * 12);
    else                      score += (range - d) * 0.02;
    if (e.isBounty) score += 40;          // 현상수배는 놓치면 손해가 크다
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function updateTowers(towers, enemies, projectiles, dt) {
  for (const tower of towers) {
    if (tower.muzzle > 0) tower.muzzle = Math.max(0, tower.muzzle - dt);
    // ✦ 영구 기관 — 한 번 걸린 과부하가 풀리지 않는다
    if (tower.overloadUntil > 0 && !BONUSES.overloadEternal)
      tower.overloadUntil = Math.max(0, tower.overloadUntil - dt);
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
      piercePct: st.piercePct || 0,
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

    // 🔩 철갑탄(★6 능력)은 비율 관통이다. 그 자리에서 상대의 방어력을 보고
    // 정액으로 환산해 더한다 — 계산 함수의 모양을 바꾸지 않으면서 값은 정확하다.
    const pierceAll = (p.pierce || 0) + (tgt.armor || 0) * (p.piercePct || 0);
    const dealt = hurtDefenseEnemy(tgt, dmg, p.pierceArmor, credit, aff, pierceAll);
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
      if (!bossImmune(tgt, 'unslow')) {
        tgt.slowFactor = Math.max(tgt.slowFactor, 0.95);
        tgt.slowTimer  = Math.max(tgt.slowTimer, p.stunDur);
      }
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

    if (p.slow > 0 && !bossImmune(tgt, 'unslow')) {
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
          if (p.slow > 0 && !bossImmune(e, 'unslow')) {
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
