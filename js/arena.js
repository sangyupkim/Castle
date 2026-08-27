'use strict';

// ─── 실시간 아레나 ────────────────────────────────────────────────────────────
// v1.0의 1초 1틱 계산을 대체한다. 고정 크기(480×330) 아레나에서 몬스터가
// 가장자리에 랜덤 리젠되고, 아군은 사거리 안의 적을 자동으로 공격한다.
// 이동만 플레이어가 개입할 수 있다 (formation.js).

let _aid = 0;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// 사거리 안에서 가장 가까운 대상. range를 주지 않으면 무제한.
function nearestOf(list, from, range) {
  let best = null, bestD = range !== undefined ? range : Infinity;
  for (const e of list) {
    if (e.dead) continue;
    const d = dist(e, from) - (e.radius || 0);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

// 공격용 목표 선택 — 이미 죽을 만큼 피해가 예약된 적은 건너뛴다.
// 아군 넷이 같은 고블린에 몰려 화살을 낭비하는 것을 막는다.
function pickAttackTarget(list, from, range) {
  let best = null, bestD = range !== undefined ? range : Infinity;
  let fallback = null, fallbackD = bestD;
  for (const e of list) {
    if (e.dead) continue;
    const d = dist(e, from) - (e.radius || 0);
    if (d > (range !== undefined ? range : Infinity)) continue;
    if (d < fallbackD) { fallbackD = d; fallback = e; }
    if ((e.pendingDmg || 0) >= e.hp) continue;   // 곧 죽는다 — 다른 적을 노린다
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best || fallback;
}

// ─── 아군 개체를 아레나에 올린다 ──────────────────────────────────────────────
function spawnAllyIntoArena(arena, u, i, n) {
  const c = arenaCenter();
  const ang = (i / Math.max(1, n)) * Math.PI * 2;
  u.x = c.x + Math.cos(ang) * FORMATION_RADIUS;
  u.y = c.y + Math.sin(ang) * FORMATION_RADIUS;
  clampToArena(u, u.radius);
  u.atkCd = Math.random() * u.atkPeriod;   // 첫 공격 타이밍을 흩어 동시 발사를 막는다
  u.skillCdLeft = u.skillCd;
  u.noHitFor = ARENA_REGEN_DELAY;
  u.vx = 0; u.vy = 0;
  u.target = null;
  u.tauntedBy = null;
}

// ─── 몬스터 생성 ─────────────────────────────────────────────────────────────
function makeArenaMob(typeId, waveIndex, killCount, caveLevel, eliteBonus) {
  const t  = BATTLE_MOB_TYPES[typeId] || BATTLE_MOB_TYPES.goblin;
  const cv = CAVE_LEVELS[caveLevel] || CAVE_LEVELS[1];
  const isElite = Math.random() < ((BONUSES.eliteChance || 0) + (eliteBonus || 0));
  // 훈련은 웨이브 선형, 무한은 층 곡선. 처치 누적분은 두 모드 모두 적용된다.
  const endless = endlessTier(waveIndex) > 0;
  const base = endless ? endlessArenaMult(waveIndex)
                       : (1 + (waveIndex || 0) * WAVE_STAT_SCALE);
  const sm = base * (1 + (killCount || 0) * KILL_SCALE)
           * cv.statMult * (isElite ? ELITE_STAT_MULT : 1);
  const goldBase = endless ? (1 + endlessTier(waveIndex) * WAVE_GOLD_SCALE)
                           : (1 + (waveIndex || 0) * WAVE_GOLD_SCALE);
  const gm = goldBase * (1 + (killCount || 0) * KILL_SCALE)
           * cv.goldMult * (isElite ? ELITE_GOLD_MULT : 1);
  const hp = Math.max(1, Math.round(t.hp * sm * BONUSES.mobHpMult));

  return {
    id: ++_aid, typeId, isPlayer: false, isBoss: !!t.isBoss, isElite,
    name: isElite ? `정예 ${t.name}` : t.name,
    icon: t.icon, color: isElite ? '#f43f5e' : t.color,
    behavior: t.behavior, ranged: !!t.ranged,
    hp, maxHp: hp,
    atk: Math.max(1, Math.round(t.atk * sm)),
    def: Math.max(0, Math.round(t.def * sm)),
    atkPeriod: t.atkPeriod, atkCd: Math.random() * t.atkPeriod,
    range: t.range, moveSpd: t.moveSpd * (isElite ? 1.1 : 1),
    radius: t.radius * (isElite ? 1.25 : 1),
    goldReward: Math.max(1, Math.round(t.goldReward * gm)),
    x: 0, y: 0, vx: 0, vy: 0,
    target: null, dead: false, deadTimer: 0,
    flashTimer: 0, flashColor: '#fff',
    slowUntil: 0, dashCd: 3 + Math.random() * 2, dashing: 0
  };
}

// 가장자리 밴드에서, 아군 부대 중심으로부터 SPAWN_SAFE_RADIUS 밖에 자리를 잡는다
function pickSpawnPoint(arena, allies) {
  const cx = allies.length ? allies.reduce((a, u) => a + u.x, 0) / allies.length : arenaCenter().x;
  const cy = allies.length ? allies.reduce((a, u) => a + u.y, 0) / allies.length : arenaCenter().y;

  for (let tries = 0; tries < 24; tries++) {
    const side = Math.floor(Math.random() * 4);
    const b = ARENA_SPAWN_BAND;
    let x, y;
    if (side === 0)      { x = ARENA_X + Math.random() * ARENA_W;       y = ARENA_Y + Math.random() * b; }
    else if (side === 1) { x = ARENA_X + Math.random() * ARENA_W;       y = ARENA_Y + ARENA_H - Math.random() * b; }
    else if (side === 2) { x = ARENA_X + Math.random() * b;             y = ARENA_Y + Math.random() * ARENA_H; }
    else                 { x = ARENA_X + ARENA_W - Math.random() * b;   y = ARENA_Y + Math.random() * ARENA_H; }
    if (terrainAt(arena.terrain, x, y)) continue;   // 바위·가시 위에 소환하지 않는다
    if (Math.hypot(x - cx, y - cy) >= SPAWN_SAFE_RADIUS) return { x, y };
  }
  // 아군이 구석에 몰려 안전 반경을 만족할 수 없으면 가장 먼 모서리에 붙인다
  const corners = [
    { x: ARENA_X + 14,           y: ARENA_Y + 14 },
    { x: ARENA_X + ARENA_W - 14, y: ARENA_Y + 14 },
    { x: ARENA_X + 14,           y: ARENA_Y + ARENA_H - 14 },
    { x: ARENA_X + ARENA_W - 14, y: ARENA_Y + ARENA_H - 14 }
  ];
  corners.sort((a, b2) => Math.hypot(b2.x - cx, b2.y - cy) - Math.hypot(a.x - cx, a.y - cy));
  return corners[0];
}

// ─── 아레나 상태 ─────────────────────────────────────────────────────────────
function createArena() {
  return {
    mobs: [],
    drops: [],
    shots: [],       // 원거리 투사체
    bursts: [],      // 스킬 시각 효과 (원형 파동)
    mode: 'auto',    // 'auto' | 'manual'
    rally: null,     // 수동 집결 지점 {x,y}
    facing: { x: 0, y: -1 },
    elapsed: 0,
    spawnTimer: 0.6,
    waveIndex: 0,
    terrain: [],
    pool: [['goblin', 10]],
    eliteBonus: 0,
    spawnMult: 1,
    goldCollected: 0
  };
}

// ─── 스폰 ────────────────────────────────────────────────────────────────────
function updateArenaSpawn(gs, dt) {
  const a = gs.arena, b = gs.battle;
  if (b.phase !== 'fighting') return;

  a.spawnTimer -= dt;
  if (a.spawnTimer > 0) return;

  const live = a.mobs.filter(m => !m.dead).length;
  a.spawnTimer = spawnInterval(a.elapsed) * (a.spawnMult || 1);
  if (live >= ARENA_MAX_MOBS) return;   // 상한 초과 시 스폰 보류

  const allies = b.ourTeam.filter(u => !u.dead);
  const p = pickSpawnPoint(a, allies);
  const mob = makeArenaMob(rollArenaMob(a.pool), a.waveIndex, b.killCount, gs.caveLevel, a.eliteBonus);
  mob.x = p.x; mob.y = p.y;
  clampToArena(mob, mob.radius);
  a.mobs.push(mob);
  markMobSeen(gs, mob.typeId);
}

// ─── 메인 업데이트 ───────────────────────────────────────────────────────────
function updateArena(gs, dt) {
  const a = gs.arena, b = gs.battle;
  if (!a) return;

  // 효과는 전투가 끝난 뒤에도 잠깐 남는다
  updateArenaFx(a, dt);

  if (b.phase !== 'fighting') return;
  a.elapsed += dt;

  const allies = b.ourTeam.filter(u => !u.dead);
  const mobs   = a.mobs.filter(m => !m.dead);

  updateFormation(gs, allies, dt);
  for (const u of allies) updateAlly(gs, u, mobs, allies, dt);
  for (const m of mobs)   updateMob(gs, m, allies, dt);

  separate(allies.concat(mobs), dt);
  updateShots(gs, dt);
  updateDrops(gs, allies, dt);
  updateArenaSpawn(gs, dt);

  // 사망 정리
  for (const m of a.mobs) if (m.dead) m.deadTimer += dt;
  a.mobs = a.mobs.filter(m => !m.dead || m.deadTimer < 0.5);

  // 영웅 재생
  if (BONUSES.heroRegen > 0) {
    const h = allies.find(u => u.isHero);
    if (h) h.hp = Math.min(h.maxHp, h.hp + BONUSES.heroRegen * dt);
  }

  if (!b.ourTeam.some(u => !u.dead)) { b.phase = 'lost'; b.result = 'lost'; }
}

function updateArenaFx(a, dt) {
  for (let i = a.bursts.length - 1; i >= 0; i--) {
    const f = a.bursts[i];
    f.t += dt;
    if (f.t >= f.dur) a.bursts.splice(i, 1);
  }
}

// ─── 아군 ────────────────────────────────────────────────────────────────────
function updateAlly(gs, u, mobs, allies, dt) {
  if (u.flashTimer > 0) u.flashTimer = Math.max(0, u.flashTimer - dt);

  // 전투 이탈 회복 — 맞지 않고 버틴 시간에 값을 준다
  u.noHitFor = (u.noHitFor || 0) + dt;
  if (u.noHitFor >= ARENA_REGEN_DELAY && u.hp < u.maxHp) {
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * ARENA_REGEN_PCT * (BONUSES.pactRegenMult || 1) * dt);
  }

  // 목표: 사거리 안에서 가장 가까운 적
  const inRange = pickAttackTarget(mobs, u, u.range);
  u.target = inRange;

  // 공격
  u.atkCd -= dt;
  if (inRange && u.atkCd <= 0) {
    u.atkCd = u.atkPeriod / (BONUSES.unitAtkSpdMult || 1);
    allyAttack(gs, u, inRange);
  } else if (u.atkCd <= 0) {
    u.atkCd = 0;
  }

  // 스킬 — 쿨다운마다 자동 발동
  u.skillCdLeft -= dt;
  if (u.skillCdLeft <= 0 && (inRange || u.skillKind === 'heal' || u.skillKind === 'bulwark')) {
    u.skillCdLeft = u.skillCd;
    allySkill(gs, u, mobs, allies);
  }

  // 이동 — 수렁 위에서는 느려진다
  applyTerrainTick(gs, u, dt, true);
  if (u.dead) return;
  const spd = u.moveSpd * terrainSpeedMult(gs.arena.terrain, u);
  if (gs.arena.mode === 'manual' && gs.arena.rally) {
    moveToward(u, u.slotX, u.slotY, spd, dt, 3);
  } else if (!inRange) {
    // 자동: 사거리 밖이면 최근접 적 쪽으로 천천히 접근
    const near = nearestOf(mobs, u);
    if (near) moveToward(u, near.x, near.y, spd * AUTO_ADVANCE_PCT, dt, u.range * 0.8);
  } else if (u.ranged) {
    // 원거리는 너무 붙으면 물러난다 (카이팅)
    const d = dist(inRange, u);
    if (d < u.range * 0.45) {
      const ang = Math.atan2(u.y - inRange.y, u.x - inRange.x);
      u.x += Math.cos(ang) * spd * 0.7 * dt;
      u.y += Math.sin(ang) * spd * 0.7 * dt;
      clampToArena(u, u.radius);
      resolveTerrainCollision(gs.arena.terrain, u);
      clampToArena(u, u.radius);
    }
  }
}

function moveToward(e, tx, ty, spd, dt, stopDist) {
  const dx = tx - e.x, dy = ty - e.y;
  const d  = Math.hypot(dx, dy);
  if (d <= (stopDist || 0)) return false;
  const step = Math.min(d, spd * dt);
  const px = e.x, py = e.y;
  e.x += dx / d * step;
  e.y += dy / d * step;
  clampToArena(e, e.radius);
  const ter = (typeof gs !== 'undefined' && gs.arena) ? gs.arena.terrain : null;
  if (ter && ter.length) {
    resolveTerrainCollision(ter, e);
    clampToArena(e, e.radius);
    // 바위에 정면으로 막히면 옆으로 미끄러진다 — 붙어서 떠는 것을 막는다
    if (Math.hypot(e.x - px, e.y - py) < step * 0.25) {
      const sx = -(dy / d), sy = (dx / d);
      const side = ((e.slideDir = e.slideDir || (Math.random() < 0.5 ? -1 : 1)));
      e.x = px + sx * side * step; e.y = py + sy * side * step;
      clampToArena(e, e.radius);
      resolveTerrainCollision(ter, e);
      clampToArena(e, e.radius);
    } else {
      e.slideDir = 0;
    }
  }
  return true;
}

// 지형이 개체에 매 프레임 주는 효과 — 수렁은 이동에서, 가시는 여기서
function applyTerrainTick(gs, e, dt, isAlly) {
  const ter = gs.arena.terrain;
  if (!ter || !ter.length) return;
  const t = terrainAt(ter, e.x, e.y);
  if (!t || !t.dpsPct) return;
  const dmg = (e.maxHp || 1) * t.dpsPct * dt;
  e.hp -= dmg;
  e._spikeAccum = (e._spikeAccum || 0) + dmg;
  if (e._spikeAccum >= 1) {
    e._spikeAccum = 0;
    if (typeof FX !== 'undefined') FX.burst(e.x, e.y, '#f43f5e', 3, 7);
  }
  if (e.hp <= 0 && !e.dead) {
    e.hp = 0;
    if (isAlly) hurtAlly(gs, e, 0, '#f43f5e');
    else        hurtMob(gs, e, 0, '#f43f5e');
  }
}

function allyAttack(gs, u, target) {
  const crit = BONUSES.critChance > 0 && Math.random() < BONUSES.critChance;
  const dmg  = Math.max(1, Math.round((crit ? u.atk * 1.8 : u.atk) - target.def));
  if (u.ranged) {
    target.pendingDmg = (target.pendingDmg || 0) + dmg;
    gs.arena.shots.push({
      x: u.x, y: u.y, tx: target.x, ty: target.y, target,
      dmg, color: crit ? '#f43f5e' : u.color, spd: 420, fromAlly: true, life: 1.2
    });
  } else {
    hurtMob(gs, target, dmg, crit ? '#f43f5e' : '#fbbf24');
    if (typeof SFX !== 'undefined') SFX.hit();
  }
  if (BONUSES.comboChance > 0 && Math.random() < BONUSES.comboChance) {
    hurtMob(gs, target, Math.max(1, u.atk - target.def), '#fb923c');
  }
}

// ─── 아군 스킬 — 위치 기반 ───────────────────────────────────────────────────
function allySkill(gs, u, mobs, allies) {
  const a = gs.arena;
  const kind = u.skillKind;

  if (kind === 'heal') {
    let healed = 0;
    for (const t of allies) {
      if (dist(t, u) > u.skillRadius) continue;
      const amt = Math.min(t.maxHp - t.hp, u.healAmt);
      t.hp += amt; healed += amt;
    }
    if (!healed) { u.skillCdLeft = 1.5; return; }   // 다 찼으면 금방 다시 시도
    a.bursts.push({ x: u.x, y: u.y, r: u.skillRadius, color: '#34d399', t: 0, dur: 0.45 });
    addFloaty(gs.battle, `+${healed}`, u.x, u.y, '#34d399');
    if (typeof SFX !== 'undefined') SFX.heal();
    return;
  }

  if (kind === 'bulwark') {
    for (const t of allies) {
      if (dist(t, u) <= u.skillRadius) t.shield = (t.shield || 0) + u.shieldAmt;
    }
    // 도발: 주변 몹의 목표를 방패병으로 강제한다
    let taunted = 0;
    for (const m of mobs) {
      if (dist(m, u) <= u.skillRadius) { m.tauntTarget = u; m.tauntTimer = 3; taunted++; }
    }
    a.bursts.push({ x: u.x, y: u.y, r: u.skillRadius, color: COLORS.shield, t: 0, dur: 0.5 });
    addFloaty(gs.battle, `🛡+${u.shieldAmt}${taunted ? ` 도발${taunted}` : ''}`, u.x, u.y, COLORS.shield);
    if (typeof SFX !== 'undefined') SFX.skill();
    return;
  }

  if (kind === 'nova' || kind === 'spin' || kind === 'cleave') {
    const rad = u.skillRadius;
    let hits = 0;
    for (const m of mobs) {
      if (dist(m, u) > rad + m.radius) continue;
      hurtMob(gs, m, Math.max(1, u.skillAtk - m.def), u.skillColor);
      hits++;
    }
    a.bursts.push({ x: u.x, y: u.y, r: rad, color: u.skillColor, t: 0, dur: 0.4 });
    if (hits && typeof SFX !== 'undefined') SFX.cannon();
    if (!hits) u.skillCdLeft = 1.0;
    return;
  }

  if (kind === 'volley') {
    const targets = mobs.filter(m => dist(m, u) <= u.range && (m.pendingDmg||0) < m.hp)
                        .sort((m1, m2) => dist(m1, u) - dist(m2, u))
                        .slice(0, u.skillHits || 3);
    if (!targets.length) { u.skillCdLeft = 1.0; return; }
    targets.forEach((t, i) => {
      const dmg = Math.max(1, u.skillAtk - t.def);
      t.pendingDmg = (t.pendingDmg || 0) + dmg;
      a.shots.push({
        x: u.x, y: u.y, tx: t.x, ty: t.y, target: t,
        dmg, color: u.skillColor, spd: 520, fromAlly: true, life: 1.2, delay: i * 0.08
      });
    });
    if (typeof SFX !== 'undefined') SFX.skill();
    return;
  }
}

// ─── 몬스터 ──────────────────────────────────────────────────────────────────
function updateMob(gs, m, allies, dt) {
  if (m.flashTimer > 0) m.flashTimer = Math.max(0, m.flashTimer - dt);
  applyTerrainTick(gs, m, dt, false);
  if (m.dead) return;
  if (!allies.length) return;

  if (m.tauntTimer > 0) {
    m.tauntTimer -= dt;
    if (m.tauntTimer <= 0) m.tauntTarget = null;
  }

  // 목표: 도발 중이면 방패병, 아니면 최근접 아군
  let target = (m.tauntTarget && !m.tauntTarget.dead) ? m.tauntTarget : nearestOf(allies, m);
  if (!target) return;
  m.target = target;

  const d = dist(m, target) - target.radius;
  const slowMult = (m.slowUntil > 0 ? 0.55 : 1) * terrainSpeedMult(gs.arena.terrain, m);
  if (m.slowUntil > 0) m.slowUntil -= dt;

  // 돌진 패턴 (보스)
  if (m.behavior === 'dash') {
    m.dashCd -= dt;
    if (m.dashing > 0) m.dashing -= dt;
    else if (m.dashCd <= 0 && d > 40) { m.dashing = 0.6; m.dashCd = 5; }
  }
  const dashMult = m.dashing > 0 ? 3.2 : 1;

  // 이동
  if (m.behavior === 'kite') {
    // 거리 유지 원거리 — 너무 붙으면 물러나고 멀면 다가온다
    const want = m.range * 0.8;
    if (d > want)      moveToward(m, target.x, target.y, m.moveSpd * slowMult, dt, want);
    else if (d < want * 0.6) {
      const ang = Math.atan2(m.y - target.y, m.x - target.x);
      m.x += Math.cos(ang) * m.moveSpd * slowMult * dt;
      m.y += Math.sin(ang) * m.moveSpd * slowMult * dt;
      clampToArena(m, m.radius);
    }
  } else if (d > m.range) {
    moveToward(m, target.x, target.y, m.moveSpd * slowMult * dashMult, dt, m.range);
  }

  // 공격
  m.atkCd -= dt;
  if (d <= m.range && m.atkCd <= 0) {
    m.atkCd = m.atkPeriod;
    if (m.ranged) {
      gs.arena.shots.push({
        x: m.x, y: m.y, tx: target.x, ty: target.y, target,
        dmg: Math.max(1, m.atk - target.def), color: m.color, spd: 320, fromAlly: false, life: 1.5
      });
    } else if (m.behavior === 'slam') {
      // 마왕 — 광역 내려찍기
      const rad = 52;
      for (const t of allies) {
        if (dist(t, m) <= rad) hurtAlly(gs, t, Math.max(1, m.atk - t.def), '#db2777');
      }
      gs.arena.bursts.push({ x: m.x, y: m.y, r: rad, color: '#db2777', t: 0, dur: 0.4 });
      if (typeof FX !== 'undefined') FX.shake(3, 0.15);
    } else {
      hurtAlly(gs, target, Math.max(1, m.atk - target.def), '#fca5a5');
    }
  }
}

// ─── 개체 분리 — 완전히 겹치지 않게 밀어낸다 ─────────────────────────────────
let _terrainRef = null;
function separate(all, dt) {
  _terrainRef = (typeof gs !== 'undefined' && gs.arena) ? gs.arena.terrain : null;
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      const minD = a.radius + b.radius;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) * 0.5;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      clampToArena(a, a.radius); clampToArena(b, b.radius);
      if (_terrainRef && _terrainRef.length) {
        resolveTerrainCollision(_terrainRef, a); clampToArena(a, a.radius);
        resolveTerrainCollision(_terrainRef, b); clampToArena(b, b.radius);
      }
    }
  }
}

// ─── 투사체 ──────────────────────────────────────────────────────────────────
function updateShots(gs, dt) {
  const a = gs.arena;
  const liveMobs = a.mobs.filter(m => !m.dead);

  for (let i = a.shots.length - 1; i >= 0; i--) {
    const s = a.shots[i];
    if (s.delay > 0) { s.delay -= dt; continue; }
    s.life -= dt;

    // 목표가 비행 중 죽으면 근처 다른 적으로 넘긴다.
    // 그냥 사라지면 원거리 유닛의 DPS가 통째로 새어나간다.
    if (s.target && s.target.dead) {
      if (s.fromAlly) {
        s.target.pendingDmg = Math.max(0, (s.target.pendingDmg || 0) - s.dmg);
        const alt = nearestOf(liveMobs, s, 70);
        if (alt) { s.target = alt; alt.pendingDmg = (alt.pendingDmg || 0) + s.dmg; }
        else     { a.shots.splice(i, 1); continue; }
      } else {
        a.shots.splice(i, 1); continue;
      }
    }

    const t = s.target;
    if (t && !t.dead) { s.tx = t.x; s.ty = t.y; }
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d  = Math.hypot(dx, dy);

    if (d < 8 || s.life <= 0) {
      if (t && !t.dead && d < 16) {
        if (s.fromAlly) { t.pendingDmg = Math.max(0, (t.pendingDmg||0) - s.dmg); hurtMob(gs, t, s.dmg, s.color); }
        else            hurtAlly(gs, t, s.dmg, s.color);
      } else if (t && s.fromAlly) {
        t.pendingDmg = Math.max(0, (t.pendingDmg||0) - s.dmg);
      }
      a.shots.splice(i, 1);
      continue;
    }
    const step = Math.min(d, s.spd * dt);
    // 바위는 화살을 막는다 — 엄폐물 뒤의 적은 돌아가서 쏴야 한다
    const ter = a.terrain;
    if (ter && ter.length && terrainBlocksShot(ter, s.x + dx / d * step, s.y + dy / d * step)) {
      if (s.fromAlly && t) t.pendingDmg = Math.max(0, (t.pendingDmg||0) - s.dmg);
      if (typeof FX !== 'undefined') FX.burst(s.x, s.y, '#94a3b8', 3, 6);
      a.shots.splice(i, 1);
      continue;
    }
    s.x += dx / d * step;
    s.y += dy / d * step;
  }
}

// ─── 드랍 ────────────────────────────────────────────────────────────────────
// 몹이 죽은 자리에 골드가 떨어지고, 아군이 반경 안에 들어가야 획득된다.
// 이 규칙이 수동 모드에 존재 이유를 준다 — 움직이면 더 번다.
function updateDrops(gs, allies, dt) {
  const a = gs.arena;
  for (let i = a.drops.length - 1; i >= 0; i--) {
    const dp = a.drops[i];
    dp.life -= dt;
    if (dp.life <= 0) { a.drops.splice(i, 1); continue; }

    let picker = null;
    for (const u of allies) {
      if (dist(u, dp) <= DROP_PICKUP_RADIUS) { picker = u; break; }
    }
    if (!picker) continue;

    gs.battle.goldEarned      += dp.amount;
    gs.battle.totalGoldEarned += dp.amount;
    a.goldCollected           += dp.amount;
    addFloaty(gs.battle, `+${dp.amount}💰`, dp.x, dp.y, COLORS.gold);
    if (typeof SFX !== 'undefined') SFX.coin ? SFX.coin() : SFX.click();
    a.drops.splice(i, 1);
  }
}

// ─── 피해 ────────────────────────────────────────────────────────────────────
function hurtMob(gs, m, dmg, color) {
  if (m.dead) return;
  m.hp -= dmg;
  m.flashTimer = 0.18; m.flashColor = color;
  addFloaty(gs.battle, `-${dmg}`, m.x, m.y - m.radius, color);
  if (typeof FX !== 'undefined') FX.burst(m.x, m.y, color, 2, 6);
  if (m.hp > 0) return;

  m.dead = true; m.hp = 0; m.deadTimer = 0; m.pendingDmg = 0;
  gs.battle.killCount++;
  gs.battle.runKills = (gs.battle.runKills || 0) + 1;
  gs.stats.totalKills++;
  if (typeof FX  !== 'undefined') FX.burst(m.x, m.y, m.color, 10, 14);
  if (typeof SFX !== 'undefined') SFX.kill();

  // 드랍
  let amount = Math.round((m.goldReward || 1) * BONUSES.battleGoldMult * fev('goldMult', 1));
  if (BONUSES.dropChance > 0 && Math.random() < BONUSES.dropChance) {
    amount += 6 + Math.floor(Math.random() * 10);
  }
  // 드랍은 처치 지점에서 바깥으로 튄다.
  // 그냥 발밑에 떨어지면 제자리를 지키는 자동 모드가 전부 주워버려
  // "움직이면 더 번다"는 규칙이 성립하지 않는다.
  const ang  = Math.random() * Math.PI * 2;
  const away = DROP_SCATTER_MIN + Math.random() * (DROP_SCATTER_MAX - DROP_SCATTER_MIN);
  const dp = clampToArena({ x: m.x + Math.cos(ang) * away, y: m.y + Math.sin(ang) * away }, 6);
  gs.arena.drops.push({
    x: dp.x, y: dp.y, amount, life: DROP_LIFETIME, big: !!m.isBoss || !!m.isElite
  });

  if (m.isBoss) {
    if (typeof FX !== 'undefined') { FX.ring(m.x, m.y, '#fbbf24', 22); FX.shake(5, 0.3); }
  }
  if (BONUSES.killHeal > 0) {
    for (const u of gs.battle.ourTeam) {
      if (!u.dead) u.hp = Math.min(u.maxHp, u.hp + BONUSES.killHeal);
    }
  }
}

function hurtAlly(gs, u, dmg, color) {
  if (u.dead) return;
  let remain = dmg;
  if (u.shield > 0) {
    const absorbed = Math.min(u.shield, remain);
    u.shield -= absorbed; remain -= absorbed;
    addFloaty(gs.battle, `🛡-${absorbed}`, u.x, u.y - u.radius - 8, COLORS.shield);
  }
  if (remain <= 0) return;

  u.hp -= remain;
  u.noHitFor = 0;
  u.flashTimer = 0.2; u.flashColor = color;
  addFloaty(gs.battle, `-${remain}`, u.x, u.y - u.radius, color);
  if (typeof SFX !== 'undefined') SFX.hit();
  if (u.hp > 0) return;

  // 불굴의 의지
  if (BONUSES.undying && !u.undyingUsed) {
    u.undyingUsed = true; u.hp = 1;
    addFloaty(gs.battle, '불굴!', u.x, u.y - u.radius - 14, '#fbbf24');
    return;
  }
  u.dead = true; u.hp = 0;
  if (typeof FX !== 'undefined') FX.burst(u.x, u.y, u.color, 12, 14);
  addLog(gs.battle, `☠️ ${u.name} 전사`, '#ef4444');
}

// ─── 웨이브 시작/종료 훅 ─────────────────────────────────────────────────────
function startArena(gs, waveIndex) {
  const a = gs.arena, def = waveDefFor(waveIndex) || {};
  a.mobs = []; a.drops = []; a.shots = []; a.bursts = [];
  a.elapsed = 0;
  a.spawnTimer = 0.6;
  a.waveIndex  = waveIndex;
  a.pool       = def.arenaPool || [['goblin', 10]];
  a.eliteBonus = def.eliteBonus || 0;
  a.spawnMult  = def.spawnMult  || 1;
  a.rally = null;
  a.goldCollected = 0;
  // 지형은 층마다 새로 생성된다 (훈련에는 없다 — 배우는 곳이므로 판을 비워둔다)
  a.terrain = (endlessTier(waveIndex) > 0) ? generateArenaTerrain(endlessTier(waveIndex)) : [];

  const allies = gs.battle.ourTeam.filter(u => !u.dead);
  allies.forEach((u, i) => spawnAllyIntoArena(a, u, i, allies.length));
}

function clearArena(gs) {
  const a = gs.arena;
  a.mobs = []; a.drops = []; a.shots = []; a.bursts = [];
  a.rally = null;
}

// 도감 — 만나본 몹을 기록한다
function markMobSeen(gs, typeId) {
  if (!gs.seenMobs) gs.seenMobs = [];
  if (!gs.seenMobs.includes(typeId)) gs.seenMobs.push(typeId);
}
