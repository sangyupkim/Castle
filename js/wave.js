'use strict';

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',            // 'idle' | 'active' | 'upgradePick' | 'intermission'
    timer: 0,
    elapsed: 0,
    intermissionTimer: 0,
    defenseQueues: [],
    wipedAt: null,            // 아군 전멸 시각(초). 돌파 지속시간 계산용

    init(idx) {
      this.waveIndex = idx;
      // 이 층의 이벤트를 먼저 정한다 — 아래 경로·스탯 계산이 이걸 참조한다
      if (typeof gs !== 'undefined' && gs) gs.floorEvent = floorEventOf(endlessTier(idx));
      // 이 층의 경로를 적용한다. 관문에서 바뀌면 새 경로에 깔린 타워를 옮긴다.
      if (typeof gs !== 'undefined' && gs && gs.towers) {
        // 안내는 바뀐 그 층에서만 — 다음 층으로 넘어가면 지운다
        if (gs.pathChanged && gs.pathChanged.wave !== idx) gs.pathChanged = null;
        const rel = applyPathForFloor(gs, idx);
        if (rel) {
          gs.pathChanged = { moved: rel.moved, refunded: rel.refunded, gold: rel.gold, wave: idx, at: Date.now() };
          if (rel.moved)    addLog(gs.battle, `🛤 경로가 바뀌었습니다 — 타워 ${rel.moved}기 이설`, '#38bdf8');
          if (rel.refunded) addLog(gs.battle, `🛤 자리가 없는 타워 ${rel.refunded}기 환불 +${rel.gold}💰`, COLORS.gold);
          if (typeof SFX !== 'undefined') SFX.upgrade();
        }
      }
      this.phase     = 'idle';
      this.timer     = waveDuration();
      this.elapsed   = 0;
      this.defenseQueues = [];
      this.wipedAt   = null;
      this.bountyTimer = null;   // 현상수배 등장까지 남은 시간
      maybeFloorTips(idx);
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;

      this.phase   = 'active';
      this.elapsed = 0;
      this.timer   = waveDuration();
      this.wipedAt = null;

      const def = waveDefFor(this.waveIndex);

      // ── 상단 스폰 편성 ──
      // 예전에는 웨이브 정의에 적힌 간격을 그대로 썼는데, 그러면 초반 웨이브가
      // 28초쯤에 상단을 다 비우고 남은 30초를 아레나만 돌았다. 두 전선의 길이가 달랐다.
      // 이제는 "마지막 한 마리가 60초에 기지에 닿는다"를 기준으로 역산한다 —
      // 웨이브 정의의 interval은 더 이상 쓰지 않고, 마릿수와 구성만 읽는다.
      const countMult = 1 + this.waveIndex * DEF_WAVE_COUNT_SCALE;
      // 스폰속도 보너스와 무한 밀도는 간격이 아니라 마릿수로 받는다.
      // 간격을 건드리면 도착 시각이 흐트러져 위 원칙이 깨진다.
      const spawnMult = BONUSES.spawnSpeedMult || 1;
      const density   = endlessDensityMult(this.waveIndex);
      this.defenseQueues = buildSpawnPlan(def.defenseEnemies, this.waveIndex, {
        duration:  waveDuration(),
        countMult: countMult,
        extraMult: spawnMult / Math.max(0.01, density)
      });

      // 예약해둔 현상수배는 웨이브 시작 조금 뒤에 등장한다
      this.bountyTimer = gs.bountyPending ? BOUNTY_SPAWN_DELAY : null;

      reapplyAllBonuses(gs);
      startFighting(gs.battle);
      startArena(gs, this.waveIndex);
      if (typeof SFX !== 'undefined') SFX.waveStart();
    },

    // 하단 아레나에서 물러난다. 병력과 적립 골드를 지키고 남은 시간은 상단만 진행.
    retreat(gs) {
      if (this.phase !== 'active') return false;
      if (gs.battle.phase !== 'fighting') return false;
      // 바닥에 남은 드랍은 절반만 챙긴다 — 후퇴가 손해만은 아니되,
      // 제때 주우러 간 것보다 이득일 수는 없다
      const left = Math.floor(gs.arena.drops.reduce((a, d) => a + d.amount, 0) * 0.5);
      if (left > 0) {
        gs.battle.goldEarned      += left;
        gs.battle.totalGoldEarned += left;
        addLog(gs.battle, `후퇴하며 드랍 회수 +${left}💰`, COLORS.gold);
      }
      clearArena(gs);
      gs.battle.phase = 'retreated';

      // 하단을 비운 대가 — 남은 시간만큼 몬스터가 성벽을 두드린다.
      // 일찍 뺄수록 비싸고, 거의 다 버티고 뺐다면 거의 공짜다.
      const cost = retreatCost(this.timer);
      if (cost > 0) {
        gs.baseHP = Math.max(0, gs.baseHP - cost);
        spawnFloaty(`후퇴 -${cost}HP`, CW / 2, DEFENSE_H - 40, '#f87171');
        addLog(gs.battle, `🛡 후퇴 — 남은 ${Math.ceil(this.timer)}초만큼 성벽 -${cost}HP`, '#f87171');
        if (typeof FX !== 'undefined') FX.shake(3, 0.25);
        if (gs.baseHP <= 0) { gs.gameOver = true; bankRunResult(); return true; }
      } else {
        addLog(gs.battle, '🛡 후퇴 — 병력을 보존했습니다', '#38bdf8');
      }
      if (typeof SFX !== 'undefined') SFX.click();
      return true;
    },

    update(gs, dt) {
      if (this.phase !== 'active') return;

      this.elapsed += dt;
      this.timer = Math.max(0, waveDuration() - this.elapsed);

      // 상단 적 스폰
      for (const q of this.defenseQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          gs.defenseEnemies.push(makeDefenseEnemy(q.type, this.waveIndex, { rewardMult: q.rewardMult }));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // 현상수배 등장
      if (this.bountyTimer !== null) {
        this.bountyTimer -= dt;
        if (this.bountyTimer <= 0) {
          this.bountyTimer = null;
          // 예약할 때 이미 1 올려뒀으므로, 첫 소환이 n=0이 되도록 되돌려 읽는다
          const n = Math.max(0, gs.bountyUsed - 1);
          const e = makeDefenseEnemy('bounty', this.waveIndex, {
            hp:     bountyHp(n, this.waveIndex),
            reward: bountyGold(n, this.waveIndex)
          });
          e.gems = bountyGems(n);
          gs.defenseEnemies.push(e);
          gs.bountyPending = false;
          spawnFloaty(`💰 현상수배 등장! 처치 시 보석 +${e.gems}`, CW/2, 60, '#fbbf24');
          addLog(gs.battle, `💰 현상수배 등장 — 놓치면 성벽 -${e.dmg}HP`, '#fbbf24');
          if (typeof FX  !== 'undefined') FX.shake(5, 0.35);
          if (typeof SFX !== 'undefined') SFX.waveStart();
        }
      }

      // 하단 아레나
      updateArena(gs, dt);

      // 아군 전멸 — 시각을 기록해 돌파 지속시간을 잰다
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
        this.wipedAt = this.elapsed;
        addLog(gs.battle, '⚠️ 병력 전멸 — 몬스터가 기지로 향합니다', '#ef4444');
      }
      // 돌파가 일정 시간 지나면 몬스터는 물러난다 (남은 시간은 상단만 진행)
      if (this.wipedAt !== null && this.elapsed - this.wipedAt >= BREAKTHROUGH_DURATION) {
        if (gs.arena.mobs.length) {
          clearArena(gs);
          addLog(gs.battle, '몬스터가 물러났습니다', '#64748b');
        }
      }

      // 종료 조건 — 웨이브는 타이머로만 끝난다.
      // 상단을 일찍 막았다고 해서 하단 자원 확보 시간까지 잘리면 안 된다.
      // 양쪽 다 더 진행될 여지가 없을 때만 조기 종료한다.
      const defDone = this.defenseQueues.every(q => q.remaining <= 0) &&
                      gs.defenseEnemies.every(e => e.dead || e.reached);
      const batOver = (gs.battle.phase === 'retreated') ||
                      (gs.battle.phase === 'idle_defeated' && gs.arena.mobs.length === 0);

      if (this.timer <= 0 || (defDone && batOver)) {
        this.endWave(gs);
      }
    },

    endWave(gs) {
      // 타이머 만료까지 'fighting'이었다면 완주다.
      const cleared   = (gs.battle.phase === 'fighting');
      const retreated = (gs.battle.phase === 'retreated');
      gs.battle.phase  = 'won';
      gs.battle.result = cleared ? 'cleared' : retreated ? 'retreated' : 'defeated';

      // 바닥에 남은 드랍은 절반만 회수된다
      const leftover = Math.floor(gs.arena.drops.reduce((a, d) => a + d.amount, 0) * 0.5);
      if (leftover > 0) {
        gs.battle.goldEarned      += leftover;
        gs.battle.totalGoldEarned += leftover;
      }

      const earned     = gs.battle.goldEarned;
      // 처치 보너스가 웨이브에 비례해 곱해지면 물량 증가와 이중으로 붙어 폭발한다.
      // 마릿수는 이미 웨이브에 따라 늘어나므로, 단가는 완만하게만 올린다.
      const killBonus  = Math.round(gs.battle.killCount * (1 + this.waveIndex * 0.12));
      const fullWin    = 8 + this.waveIndex * 4;
      // 후퇴는 승리 보너스를 절반만 받는다 — 하단을 끝까지 지킨 것이 아니므로
      const winBonus   = cleared ? fullWin : retreated ? Math.floor(fullWin * 0.5) : 0;
      const clearBonus = cleared ? clearBonusGold(this.waveIndex) : 0;
      // 드랍(earned)은 주울 때 이미 이벤트 배율이 붙었다 — 여기서 또 곱하면 두 번 적용된다
      const evGold = fev('goldMult', 1);
      gs.gold += earned + Math.round((killBonus + winBonus + clearBonus) * evGold);

      const parts = [];
      if (earned > 0)     parts.push(`드랍 +${earned}💰`);
      if (killBonus > 0)  parts.push(`처치 +${killBonus}💰`);
      if (winBonus > 0)   parts.push(`${retreated ? '후퇴' : '승리'} +${winBonus}💰`);
      if (clearBonus > 0) parts.push(`★완주 +${clearBonus}💰`);
      if (evGold !== 1)   parts.push(`${gs.floorEvent.icon}${gs.floorEvent.name} ×${evGold}`);
      addLog(gs.battle, `웨이브${this.waveIndex+1}: ${parts.join(' ')}`, COLORS.gold);

      // 완주하면 성벽을 조금 수리한다. 기지 HP가 내려가기만 하면
      // 공격적으로 굴리는 플레이가 구조적으로 지속 불가능해진다.
      if (cleared && !BONUSES.pactNoRepair && !fev('noRepair', false)) {
        const before = gs.baseHP;
        gs.baseHP = Math.min(baseHpMax(), gs.baseHP + clearRepair(this.waveIndex));
        const healed = Math.round(gs.baseHP - before);
        if (healed > 0) {
          addLog(gs.battle, `★ 완주 — 성벽 +${healed}HP 수리`, '#22c55e');
          spawnFloaty(`완주! +${healed}HP`, CW / 2, DEFENSE_H - 40, '#22c55e');
        }
        gs.stats.wavesFullCleared = (gs.stats.wavesFullCleared || 0) + 1;
      }

      if (typeof SFX !== 'undefined') {
        if (cleared) SFX.win(); else if (retreated) SFX.click(); else SFX.lose();
      }

      // 하단에 배치했던 영웅 상태를 되돌려 받는다
      const heroUnit = gs.battle.ourTeam.find(u => u.isHero);
      if (heroUnit) {
        if (heroUnit.dead) killHero(gs);
        else gs.hero.hp = Math.max(1, Math.round(heroUnit.hp));
      }

      // ── 잔존 침입자는 사라지지 않는다 ──────────────────────────────────
      // v2.5까지는 웨이브가 끝나면 걸어오던 적을 전부 지웠다. 그런데 ∞ 경로 완주에
      // 보스는 58초, 강철오크는 47초가 걸리고 웨이브는 60초다 — 무거운 적일수록
      // 타워에 죽는 게 아니라 "시계에 죽어" 기지에 닿지도 못했다.
      // 실측(∞-29, 적 ×44.7)에서 기지에 도달한 적이 0기였던 이유가 이것이고,
      // 적 체력을 아무리 올려도 상단이 위협이 되지 않던 근본 원인이다.
      // 이제는 남은 적이 그대로 다음 웨이브로 넘어간다 — 못 잡으면 쌓인다.
      const survivors = gs.defenseEnemies
        .filter(e => !e.dead && !e.reached)
        .sort((a, b) => (b.wpIdx || 0) - (a.wpIdx || 0))
        .slice(0, CARRYOVER_MAX);
      for (const e of survivors) { e.slowTimer = 0; e.slowFactor = 0; e.hitFlash = 0; e.carried = true; }
      if (survivors.length) {
        addLog(gs.battle, `⚠️ 잔존 침입자 ${survivors.length}기가 계속 진군합니다`, '#f59e0b');
      }
      gs.defenseEnemies    = survivors;
      gs.projectiles       = [];
      gs.bountyPending     = false;
      this.bountyTimer     = null;
      for (const t of gs.towers) t.overloadUntil = 0;
      gs.hero.moveX = gs.hero.moveY = null;
      clearArena(gs);
      gs.battle.ourTeam    = gs.battle.ourTeam.filter(u => !u.dead && !u.isHero);
      gs.battle.phase      = 'hire';
      gs.battle.result     = null;
      gs.battle.goldEarned = 0;
      gs.battle.floaties   = [];
      recalcMaxSlots(gs);

      gs.hero.placement = 'none';
      // 아래 절반이 아레나 → 준비 화면으로 바뀐다. 연타 중이던 손가락이
      // 새로 생긴 버튼을 그대로 누르지 않도록 잠깐 탭을 막는다.
      if (typeof lockTapsBriefly === 'function') lockTapsBriefly();
      tickHeroDown(gs);              // 전사한 영웅의 결장 층을 하나 센다
      restHealTeam(gs.battle);       // 생존 병력 휴식 회복
      refreshInnOffers(gs);          // 여관에 새 손님이 온다

      // 훈련 마지막 웨이브만 강화 없이 결과로 넘긴다. 무한은 매 층 강화를 고른다.
      const atCampaignEnd = (gs.mode !== 'endless') && (this.waveIndex + 1 >= TRAINING_WAVES);
      if (!atCampaignEnd) {
        this.phase = 'upgradePick';
        gs.upgradePick = { active: true, cards: rollUpgradeCards(gs.activeUpgrades, fev('cards', 3)) };
      } else {
        this.phase = 'intermission';
        this.intermissionTimer = 0;
      }

      gs.town.waveBuffs = [];
      reapplyAllBonuses(gs);

      // 무한은 층마다 보석이 쌓이고, 깊이 들어갈수록 층당 몫이 커진다
      const et = endlessTier(this.waveIndex);
      if (et > 0) {
        gs.endlessGems = (gs.endlessGems || 0) + endlessGemStep(et) * fev('gemMult', 1);
        gs.stats.bestEndless = Math.max(gs.stats.bestEndless || 0, et);
        // 관문(10층 단위) 최초 돌파는 일회성 보상
        if (isGateTier(et)) {
          gs.clearedGates = gs.clearedGates || [];
          if (!gs.clearedGates.includes(et)) {
            gs.clearedGates.push(et);
            const bonus = ENDLESS_GATE_BONUS + Math.floor(et / 10) * ENDLESS_GATE_BONUS_STEP;
            gs.soulStones += bonus;
            gs.stats.totalGems = (gs.stats.totalGems || 0) + bonus;
            addLog(gs.battle, `🏁 ${et}층 관문 최초 돌파! 보석 +${bonus}`, '#a78bfa');
            spawnFloaty(`🏁 ${et}층 돌파 · 💎+${bonus}`, CW/2, DEFENSE_H/2, '#a78bfa');
          }
        }
      }

      // 훈련 스테이지 진행 기록. 보석은 여기서 주지 않는다 —
      // 1-2쯤에서 17보석이 모여 영웅 스킬을 전부 찍을 수 있었다는 보고가 있었다.
      // 훈련은 손에 익히는 곳이지 성장을 버는 곳이 아니다. 정산은 완주할 때 한 번뿐이다.
      const stageIdx = Math.floor(this.waveIndex / 3);
      const isLastWaveOfStage = ((this.waveIndex + 1) % 3 === 0) && et === 0;
      if (isLastWaveOfStage) {
        if (!gs.clearedStages) gs.clearedStages = new Array(10).fill(false);
        gs.stats.bestStage = Math.max(gs.stats.bestStage || 0, stageIdx + 1);
        if (!gs.clearedStages[stageIdx]) {
          gs.clearedStages[stageIdx] = true;
          addLog(gs.battle, `★ 1-${stageIdx+1} 클리어!`, '#a78bfa');
        }
      }

      gs.stats.wavesCleared = Math.max(gs.stats.wavesCleared || 0, this.waveIndex + 1);
      SaveManager.save(gs);
    },

    confirmPick(gs) {
      gs.upgradePick = { active: false, cards: [] };
      this.phase = 'intermission';
      this.intermissionTimer = 0;
      if (typeof lockTapsBriefly === 'function') lockTapsBriefly();
    },

    updateIntermission(gs, dt) {
      if (this.phase !== 'intermission') return;
      this.intermissionTimer = Math.max(0, this.intermissionTimer - dt);

      if (this.intermissionTimer <= 0) {
        const next = this.waveIndex + 1;
        // 훈련은 TRAINING_WAVES에서 끝난다 (완주 = 심연 해금). 심연은 끝이 없다.
        if (gs.mode !== 'endless' && next >= TRAINING_WAVES) {
          gs.stageCleared = true;
          gs.stats.clears = (gs.stats.clears || 0) + 1;
          SaveManager.save(gs);
        } else {
          gs.wave = next;
          this.init(next);
        }
      }
    }
  };
}


// ─── 층에 딸린 상황별 쪽지 ────────────────────────────────────────────────────
// 설명을 시작 화면에 몰아 두는 대신, 그 일이 처음 벌어지는 층에서 한 장씩 띄운다.
// 하나씩만 뜨므로 (tut.showTip이 겹침을 막는다) 나머지는 다음 층으로 미뤄진다.
function maybeFloorTips(idx) {
  if (typeof tut === 'undefined' || !tut || !tut.showTip) return;
  if (typeof gs === 'undefined' || !gs) return;
  const tier = endlessTier(idx);

  if (tier >= DEEP_FLOOR_FROM)                          { if (tut.showTip('deep'))    return; }
  if (tier && isGateTier(tier))                         { if (tut.showTip('gate'))    return; }
  if (gs.pathChanged && gs.pathChanged.wave === idx)    { if (tut.showTip('path'))    return; }
  if (gs.floorEvent)                                    { if (tut.showTip('event'))   return; }
  if (tier && terrainCountFor(tier) > 0)                { if (tut.showTip('terrain')) return; }
  if (idx >= 1)                                         { if (tut.showTip('endwave')) return; }
  if (idx >= 1)                                         { if (tut.showTip('overload'))return; }
  if (idx >= 0)                                         { if (tut.showTip('grade'))   return; }
  if (bountyCharges(idx) > (gs.bountyUsed || 0))        { if (tut.showTip('bounty'))  return; }
}
