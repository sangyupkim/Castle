'use strict';

let _uid = 0;

// ─── 유닛 생성 ────────────────────────────────────────────────────────────────
function makeUnit(typeId) {
  const t = UNIT_TYPES[typeId];
  const u = {
    id:++_uid, typeId, isPlayer:true, isHero:false,
    name:t.name, icon:t.icon, color:t.color,
    hp:0, maxHp:0, atk:0, def:0,
    mp:t.mp, maxMp:t.maxMp, shield:0,
    skillName:t.skillName, skillKind:t.skillKind, skillHits:t.skillHits||1,
    skillAtk:0, skillCost:t.skillCost, skillColor:t.skillColor,
    healAmt:0, shieldAmt:0,
    ticksSinceSkill:0, dead:false, undyingUsed:false,
    flashTimer:0, flashColor:'#fff',
    drawX: BATTLE_TEAM_X
  };
  applyUnitStats(u, 1);
  u.hp = u.maxHp;
  return u;
}

// 현재 BONUSES를 유닛 스탯에 반영. hpRatio를 주면 그 비율로 HP를 맞춘다.
function applyUnitStats(u, hpRatio) {
  const t = UNIT_TYPES[u.typeId];
  if (!t) return;
  const ratio = hpRatio !== undefined ? hpRatio : (u.maxHp > 0 ? u.hp / u.maxHp : 1);
  u.maxHp     = t.hp  + BONUSES.unitHp;
  u.atk       = t.atk + BONUSES.unitAtk;
  u.def       = t.def + BONUSES.unitDef + BONUSES.heroAura;
  u.skillAtk  = t.skillAtk ? t.skillAtk + BONUSES.unitAtk : 0;
  u.healAmt   = t.healAmt   ? t.healAmt   + BONUSES.healBonus   : 0;
  u.shieldAmt = t.shieldAmt ? t.shieldAmt + BONUSES.shieldBonus : 0;
  u.maxMp     = t.maxMp;
  u.hp        = Math.max(1, Math.min(u.maxHp, Math.round(u.maxHp * ratio)));
}

// 강화 카드를 뽑은 뒤 이미 고용된 병력에도 즉시 반영
function refreshTeamStats(battle) {
  for (const u of battle.ourTeam) {
    if (u.isHero || u.dead) continue;
    applyUnitStats(u);
  }
}

// 처치 수 + 케이브 레벨 반영 스케일링 몹
function makeScaledMob(typeId, killCount, caveLevel) {
  const t  = BATTLE_MOB_TYPES[typeId];
  const cv = CAVE_LEVELS[caveLevel] || CAVE_LEVELS[1];
  const km = 1 + killCount * KILL_SCALE;
  const sm = km * cv.statMult;
  const gm = km * cv.goldMult;
  const hp = Math.max(1, Math.round(t.hp * sm * BONUSES.mobHpMult));
  return {
    id:++_uid, typeId, isPlayer:false, isBoss:!!t.isBoss,
    name:t.name, icon:t.icon, color:t.color,
    hp, maxHp:hp,
    atk:     Math.max(1, Math.round(t.atk      * sm)),
    def:     Math.max(0, Math.round(t.def      * sm)),
    mp:t.mp, maxMp:t.maxMp, shield:0,
    skillAtk:Math.max(1, Math.round(t.skillAtk * sm)),
    skillCost:t.skillCost,
    goldReward: Math.max(1, Math.round(t.goldReward * gm)),
    ticksSinceSkill:0, dead:false,
    flashTimer:0, flashColor:'#fff',
    drawX: BATTLE_ENEMY_SPAWN_X, drawY: 0, slot: 0, deadTimer: 0
  };
}

function makeHeroUnit(hero) {
  const lv  = HERO_LEVELS[hero.level];
  const sm  = BONUSES.heroStatMult;
  const atk = Math.round((lv.atk + BONUSES.heroAtk) * sm);
  const hp  = Math.round(lv.hp * sm);
  const def = Math.round((lv.def + BONUSES.heroAura) * sm);
  return {
    id:++_uid, typeId:'hero', isPlayer:true, isHero:true,
    name:'영웅', icon:'👑', color:COLORS.hero,
    hp:Math.max(1, Math.min(hp, hero.hp)), maxHp:hp, atk, def,
    mp:30, maxMp:30, shield:0,
    skillName:'영웅 일격', skillKind:'strike', skillHits:1,
    skillAtk: Math.floor(atk * 2.2),
    skillCost:15, skillColor:'#fbbf24', healAmt:0, shieldAmt:0,
    ticksSinceSkill:0, dead:false, undyingUsed:false,
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
    runKills: 0,
    scrollX: 0,       // 배경 스크롤 (전진 연출)
    playerDrift: 0,   // 아군 전진 드리프트
    log: [],
    floaties: [],
    result: null
  };
}

// ─── 고용 / 해고 ─────────────────────────────────────────────────────────────
function hireCost(typeId) {
  return Math.max(1, UNIT_TYPES[typeId].cost - BONUSES.hireCostDiscount);
}

function hireUnit(battle, typeId, gold) {
  const t = UNIT_TYPES[typeId];
  if (!t) return gold;
  const cost = hireCost(typeId);
  const nonHero = battle.ourTeam.filter(u => !u.isHero).length;
  if (nonHero >= battle.maxSlots || gold < cost) return gold;
  battle.ourTeam.push(makeUnit(typeId));
  return gold - cost;
}

function fireUnit(battle, idx) {
  if (idx < 0 || idx >= battle.ourTeam.length) return 0;
  const u = battle.ourTeam[idx];
  if (u.isHero) return 0;
  const refund = Math.floor(hireCost(u.typeId) / 2);
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

// 전투에 참여 중인 적 (아직 걸어오는 중이면 제외)
function engagedFoes(battle) {
  return battle.enemyTeam.filter(u => !u.dead && u.drawX <= BATTLE_ENEMY_X + 10);
}

// ─── 전투 틱 ─────────────────────────────────────────────────────────────────
function battleTick(battle) {
  battle.tickCount++;

  const our = battle.ourTeam.filter(u => !u.dead);
  const foe = engagedFoes(battle);
  if (!our.length || !foe.length) return;

  // ── 아군 행동 ────────────────────────────────────────────────────────────
  for (const u of our) {
    if (u.dead) continue;
    u.ticksSinceSkill++;
    const useSkill = u.ticksSinceSkill >= SKILL_TICK_CD && u.mp >= u.skillCost;

    if (useSkill) {
      u.ticksSinceSkill = 0;
      u.mp -= u.skillCost;
      unitSkill(battle, u, our, foe);
    } else {
      const target = foe[Math.floor(Math.random() * foe.length)];
      if (target) {
        const crit = BONUSES.critChance > 0 && Math.random() < BONUSES.critChance;
        const raw  = crit ? u.atk * 1.8 : u.atk;
        const dmg  = Math.max(1, Math.round(raw - target.def));
        applyDamage(target, dmg, battle, crit ? '#f43f5e' : '#fbbf24', true);
        if (crit) addLog(battle, `${u.name} 치명타! ${dmg}피해`, '#f43f5e');
      }
      // 연속 공격 (콤보)
      if (BONUSES.comboChance > 0 && Math.random() < BONUSES.comboChance) {
        const foe2 = engagedFoes(battle);
        if (foe2.length) {
          const t2 = foe2[Math.floor(Math.random() * foe2.length)];
          applyDamage(t2, Math.max(1, u.atk - t2.def), battle, '#fb923c', true);
        }
      }
    }
    u.mp = Math.min(u.maxMp, u.mp + MP_REGEN_TICK + BONUSES.mpRegenBonus);
  }

  // ── 적 행동 ──────────────────────────────────────────────────────────────
  const alive = () => battle.ourTeam.filter(u => !u.dead);
  for (const mob of foe) {
    if (mob.dead) continue;
    const pool = alive();
    if (!pool.length) break;
    mob.ticksSinceSkill++;
    const useSkill = mob.ticksSinceSkill >= SKILL_TICK_CD && mob.mp >= mob.skillCost;
    // 방패병이 있으면 적이 우선 노린다 (탱커 역할)
    const guards = pool.filter(u => u.typeId === 'guardian');
    const pickFrom = (guards.length && Math.random() < 0.6) ? guards : pool;
    const target = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    if (useSkill) {
      mob.ticksSinceSkill = 0;
      mob.mp -= mob.skillCost;
      const dmg = Math.max(1, mob.skillAtk - target.def);
      applyDamage(target, dmg, battle, '#ef4444', false);
      addLog(battle, `${mob.name} 스킬! ${dmg}피해`, '#ef4444');
      if (typeof SFX !== 'undefined') SFX.skill();
    } else {
      const dmg = Math.max(1, mob.atk - target.def);
      applyDamage(target, dmg, battle, '#fca5a5', false);
    }
    mob.mp = Math.min(mob.maxMp, mob.mp + MP_REGEN_TICK);
  }

  if (!battle.ourTeam.some(u => !u.dead)) { battle.phase = 'lost'; battle.result = 'lost'; }
}

// ─── 아군 스킬 ────────────────────────────────────────────────────────────────
function unitSkill(battle, u, our, foe) {
  const kind = u.skillKind || 'strike';

  if (kind === 'heal') {
    const target = our.slice().sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    const healed = Math.min(target.maxHp - target.hp, u.healAmt);
    target.hp += healed;
    addFloaty(battle, `+${healed}`, target.drawX, unitY(battle.ourTeam.indexOf(target)), '#34d399');
    addLog(battle, `${u.name}의 ${u.skillName}! +${healed}회복`, u.skillColor);
    if (typeof SFX !== 'undefined') SFX.heal();
    return;
  }

  if (kind === 'shield') {
    for (const a of our) a.shield = (a.shield || 0) + u.shieldAmt;
    addFloaty(battle, `🛡+${u.shieldAmt}`, u.drawX, unitY(battle.ourTeam.indexOf(u)), COLORS.shield);
    addLog(battle, `${u.name}의 ${u.skillName}! 전체 보호막 +${u.shieldAmt}`, u.skillColor);
    if (typeof SFX !== 'undefined') SFX.skill();
    return;
  }

  if (kind === 'aoe') {
    let total = 0;
    for (const t of foe) {
      const dmg = Math.max(1, u.skillAtk - t.def);
      applyDamage(t, dmg, battle, u.skillColor, true);
      total += dmg;
    }
    addLog(battle, `${u.name}의 ${u.skillName}! 전체 ${total}피해`, u.skillColor);
    if (typeof SFX !== 'undefined') SFX.cannon();
    return;
  }

  if (kind === 'multi') {
    let total = 0;
    for (let i = 0; i < (u.skillHits || 3); i++) {
      const live = engagedFoes(battle);
      if (!live.length) break;
      const t = live[Math.floor(Math.random() * live.length)];
      const dmg = Math.max(1, u.skillAtk - t.def);
      applyDamage(t, dmg, battle, u.skillColor, true);
      total += dmg;
    }
    addLog(battle, `${u.name}의 ${u.skillName}! ${u.skillHits}연타 ${total}피해`, u.skillColor);
    if (typeof SFX !== 'undefined') SFX.skill();
    return;
  }

  // strike (기본 단일 강타)
  const target = foe[Math.floor(Math.random() * foe.length)];
  if (!target) return;
  const dmg = Math.max(1, u.skillAtk - target.def);
  applyDamage(target, dmg, battle, u.skillColor, true);
  addLog(battle, `${u.name}의 ${u.skillName}! ${dmg}피해`, u.skillColor);
  if (typeof SFX !== 'undefined') SFX.skill();
}

// ─── 피해 적용 ────────────────────────────────────────────────────────────────
function applyDamage(target, dmg, battle, color, isMobTarget) {
  const arr = isMobTarget ? battle.enemyTeam : battle.ourTeam;
  const idx = arr.indexOf(target);
  const x   = isMobTarget ? (target.drawX || BATTLE_ENEMY_X) : (target.drawX || BATTLE_TEAM_X);
  const y   = isMobTarget ? (target.drawY || unitY(idx)) : unitY(idx);

  // 보호막이 먼저 소모된다
  let remain = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remain);
    target.shield -= absorbed;
    remain -= absorbed;
    addFloaty(battle, `🛡-${absorbed}`, x, y - 10, COLORS.shield);
  }

  target.hp -= remain;
  target.flashTimer = 0.25; target.flashColor = color;
  if (remain > 0) addFloaty(battle, `-${remain}`, x, y, color);
  if (typeof FX !== 'undefined' && remain > 0) FX.burst(x, y, color, 3, 7);
  if (typeof SFX !== 'undefined' && remain > 0) SFX.hit();

  if (target.hp <= 0) {
    // 불굴의 의지: 최초 사망 시 HP 1로 생존
    if (!isMobTarget && BONUSES.undying && !target.undyingUsed) {
      target.undyingUsed = true;
      target.hp = 1;
      addFloaty(battle, '불굴!', x, y - 22, '#fbbf24');
      return;
    }
    target.dead = true; target.hp = 0;
    if (typeof FX !== 'undefined') FX.burst(x, y, target.color, 14, 16);
    if (typeof SFX !== 'undefined') SFX.kill();

    if (isMobTarget) {
      battle.killCount++;
      battle.runKills = (battle.runKills || 0) + 1;
      if (target.goldReward) {
        const reward = Math.round(target.goldReward * BONUSES.battleGoldMult);
        battle.goldEarned      += reward;
        battle.totalGoldEarned += reward;
        addFloaty(battle, `+${reward}💰`, x, y - 22, COLORS.gold);
      }
      if (target.isBoss) {
        addLog(battle, `🔥 ${target.name} 격파!`, '#fbbf24');
        if (typeof FX !== 'undefined') { FX.ring(x, y, '#fbbf24', 22); FX.shake(6, 0.35); }
      }
      // 처치 시 아군 회복
      if (BONUSES.killHeal > 0) {
        for (const u of battle.ourTeam.filter(u => !u.dead)) {
          u.hp = Math.min(u.maxHp, u.hp + BONUSES.killHeal);
        }
      }
    } else {
      addLog(battle, `☠️ ${target.name} 전사`, '#ef4444');
    }
  }
}

// ─── 업데이트 ─────────────────────────────────────────────────────────────────
function updateBattle(battle, dt) {
  if (battle.phase !== 'fighting') return;

  for (const u of [...battle.ourTeam, ...battle.enemyTeam]) {
    if (u.flashTimer > 0) u.flashTimer = Math.max(0, u.flashTimer - dt);
  }
  for (let i = battle.floaties.length - 1; i >= 0; i--) {
    const f = battle.floaties[i];
    f.y += f.vy * dt; f.life -= dt;
    if (f.life <= 0) battle.floaties.splice(i, 1);
  }
  for (let i = battle.log.length - 1; i >= 0; i--) {
    battle.log[i].timer -= dt;
    if (battle.log[i].timer <= 0) battle.log.splice(i, 1);
  }

  // 적 걷기 애니메이션: 오른쪽에서 왼쪽으로 이동
  for (const e of battle.enemyTeam) {
    if (e.dead) e.deadTimer += dt;
    else e.drawX = Math.max(BATTLE_ENEMY_X, e.drawX - BATTLE_ENEMY_WALK_SPD * dt);
  }
  battle.enemyTeam = battle.enemyTeam.filter(e => !e.dead || e.deadTimer < 0.7);

  // 아군 전진 연출: 생존 적이 없을 때 배경 스크롤 + 아군 드리프트
  const hasLiveEnemies = battle.enemyTeam.some(e => !e.dead);
  if (!hasLiveEnemies && battle.ourTeam.some(u => !u.dead)) {
    battle.scrollX    += BATTLE_MARCH_SPD * dt;
    battle.playerDrift = Math.min(55, battle.playerDrift + 75 * dt);
  } else if (hasLiveEnemies) {
    battle.playerDrift = Math.max(0, battle.playerDrift - 250 * dt);
  }

  // 영웅 유닛 HP 재생
  if (BONUSES.heroRegen > 0) {
    const heroUnit = battle.ourTeam.find(u => u.isHero && !u.dead);
    if (heroUnit) heroUnit.hp = Math.min(heroUnit.maxHp, heroUnit.hp + BONUSES.heroRegen * dt);
  }

  battle.tickTimer += dt;
  if (battle.tickTimer >= TICK_INTERVAL) {
    battle.tickTimer -= TICK_INTERVAL;
    battleTick(battle);
  }
}

// ─── 웨이브 종료 후 휴식 회복 ─────────────────────────────────────────────────
function restHealTeam(battle) {
  const pct = REST_HEAL_PCT + BONUSES.restHealBonus;
  for (const u of battle.ourTeam) {
    if (u.dead) continue;
    u.shield = 0;
    u.mp = u.maxMp;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + Math.ceil(u.maxHp * pct));
    if (u.hp > before) addLog(battle, `${u.name} 휴식 +${u.hp - before}HP`, '#34d399');
  }
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
function addLog(battle, text, color) {
  battle.log.unshift({ text, color, timer: 2.5 });
  if (battle.log.length > 5) battle.log.pop();
}

function addFloaty(battle, text, x, y, color) {
  battle.floaties.push({ text, x, y: y - BATTLE_UNIT_R, vy: -40, life: 1.2, color });
}
