'use strict';

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',            // 'idle' | 'active' | 'upgradePick' | 'intermission'
    midBossSide: null,        // 🐲 이번 층 중간보스가 나오는 곳 ('defense' | 'arena')
    midBossPending: null,     // 하단 중간보스는 아레나가 열린 뒤에 넣는다
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
      this.cleanup   = 0;
      this.elapsed   = 0;
      this.defenseQueues = [];
      this.wipedAt   = null;
      this.bountyTimer = null;   // 현상수배 등장까지 남은 시간

      // 편성 슬롯을 여기서 다시 센다.
      // gs.battle.maxSlots는 계산해서 넣어두는 값인데, 그 입력 중 하나가
      // 👥증원 같은 층 이벤트(fev('slotBonus'))다. 그런데 재계산은 웨이브가
      // '끝날 때' 돌았고 층 이벤트는 그 뒤 여기 init에서 바뀌었다 — 즉 준비 화면 내내
      // 슬롯 수가 '지난 층'의 이벤트를 들고 있었다. 그래서
      //   · 증원 층에 들어와도 4칸 그대로였다가, 마을에서 아무 강화나 사면
      //     (그게 재계산을 부르므로) 갑자기 6칸으로 튀었고
      //   · 증원 층을 지나 다음 층에 가도 6칸이 그대로 남았다.
      // 이벤트가 슬롯의 입력이면, 이벤트가 정해지는 자리에서 같이 세야 한다.
      if (typeof gs !== 'undefined' && gs && typeof recalcMaxSlots === 'function') {
        recalcMaxSlots(gs);
        releaseOverCapUnits(gs);
      }
      maybeFloorTips(idx);
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;

      // ⚡ 액티브 — 층이 시작될 때 MP를 절반 얹어 준다.
      // 0에서 시작하면 매 층 첫 30초가 늘 빈손이고, 가득 주면 시작하자마자 다 쏟는다.
      if (gs.hero) gs.hero.mp = Math.max(gs.hero.mp || 0, Math.round(heroMaxMp() * 0.5));
      this.phase   = 'active';
      this.elapsed = 0;
      this.timer   = waveDuration();
      this.cleanup = 0;      // 스폰이 끝난 뒤 흐른 시간
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

      // 👹 100층 — 마왕. 잡몹 대신 한 마리만 오고, 그 한 마리가 곧 결승선이다.
      this.bossPhase = 0;
      if (isBossFloor(gs, this.waveIndex)) {
        this.defenseQueues = [];       // 일반 스폰은 없다
        spawnDemonLord(gs, this.waveIndex);
      } else if (isMidBossFloor(gs, this.waveIndex)) {
        // 🐲 10층마다 중간보스 — 상단이냐 하단이냐는 층이 정하고, 미리 예고돼 있다.
        // 마왕과 달리 잡몹 스폰을 막지 않는다. 평소의 층 위에 벽이 하나 얹히는 것.
        const tier = endlessTier(this.waveIndex);
        this.midBossSide = midBossSide(tier);
        if (this.midBossSide === 'defense') spawnMidBoss(gs, this.waveIndex);
        else this.midBossPending = tier;     // 하단은 아레나가 열린 뒤에 넣는다
      }

      // 예약해둔 현상수배는 웨이브 시작 조금 뒤에 등장한다
      this.bountyTimer = gs.bountyPending ? BOUNTY_SPAWN_DELAY : null;

      reapplyAllBonuses(gs);
      // 지난 웨이브에서 달려들던 것들은 여기서 정리한다 — 넘어오면 두 번 물린다
      gs.chargers = [];
      startFighting(gs.battle);
      startArena(gs, this.waveIndex);
      if (this.midBossPending) {
        spawnMidBossMob(gs, this.midBossPending);
        this.midBossPending = null;
      }
      if (typeof SFX !== 'undefined') SFX.waveStart();
    },

    // 👹 마왕 진행 — 페이즈 전환만. 처치 판정은 onDefenseKill이 죽는 순간에 한다
    // (죽은 적은 그 프레임에 배열에서 걸러지므로 여기서 '찾아' 판정할 수 없다).
    updateBoss(gs, dt) {
      if (gs.bossDefeated) return;
      const boss = (gs.defenseEnemies || []).find(e => e.isBoss && !e.dead && !e.reached);
      if (!boss) return;
      // 체력이 1/3씩 깎일 때마다 한 번씩
      const frac = boss.hp / Math.max(1, boss.maxHp);
      const want = Math.min(BOSS_PHASES - 1, Math.floor((1 - frac) * BOSS_PHASES));
      while (this.bossPhase < want) {
        this.bossPhase++;
        boss.spd *= 1.10;                       // 갈수록 빨라진다 (총 ×1.21)
        for (let i = 0; i < BOSS_ESCORT_EVERY; i++) {
          const pick = i % 3 === 0 ? 'brute' : i % 3 === 1 ? 'orc' : 'runner';
          const esc = makeDefenseEnemy(pick, this.waveIndex, { rewardMult: 0.4 });
          esc.spawnDelay = i * 0.35;            // 한꺼번에 쏟지 않고 줄지어 나온다
          gs.defenseEnemies.push(esc);
        }
        spawnFloaty(`👹 마왕 각성 ${this.bossPhase}/${BOSS_PHASES - 1} — 호위 소환!`,
                    CW/2, DEFENSE_H/2, '#ef4444');
        addLog(gs.battle, `👹 마왕이 호위 ${BOSS_ESCORT_EVERY}기를 불렀습니다`, '#ef4444');
        if (typeof FX  !== 'undefined') FX.shake(7, 0.5);
        if (typeof SFX !== 'undefined') SFX.baseHit();
      }
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
      // 하단을 비운 대가 — 남은 시간만큼 성벽이 깎인다.
      // 일찍 뺄수록 비싸고, 거의 다 버티고 뺐다면 거의 공짜다.
      // 값은 예전 그대로지만 이제 눈에 보인다 — 남은 무리가 성문으로 달려들고,
      // 한 마리가 닿을 때마다 HP가 깎인다.
      const cost = retreatCost(this.timer);
      if (cost > 0) launchCharge(gs, cost, 'retreat');
      else addLog(gs.battle, '🛡 후퇴 — 병력을 보존했습니다', '#38bdf8');
      clearArena(gs);
      gs.battle.phase = 'retreated';
      if (typeof SFX !== 'undefined') SFX.click();
      return true;
    },

    update(gs, dt) {
      if (this.phase !== 'active') return;

      this.elapsed += dt;
      this.timer = Math.max(0, waveDuration() - this.elapsed);
      const spawnOver = this.timer <= 0;
      if (spawnOver) this.cleanup += dt;

      // 상단 적 스폰
      for (const q of this.defenseQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          // 깊은 층은 한 번에 여러 마리씩 나온다 — 일정을 늘리는 대신 뭉쳐서 낸다
          const n = Math.min(q.remaining, Math.max(1, q.batch || 1));
          for (let i = 0; i < n; i++) {
            gs.defenseEnemies.push(makeDefenseEnemy(q.type, this.waveIndex, { rewardMult: q.rewardMult }));
          }
          q.remaining -= n;
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
          e.gems = Math.round(bountyGems(n) * (BONUSES.summonRewardMult || 1));
          gs.defenseEnemies.push(e);
          gs.bountyPending = false;
          spawnFloaty(`💰 현상수배 등장! 처치 시 보석 +${e.gems}`, CW/2, 60, '#fbbf24');
          addLog(gs.battle, `💰 현상수배 등장 — 놓치면 성벽 -${e.dmg}HP`, '#fbbf24');
          if (typeof FX  !== 'undefined') FX.shake(5, 0.35);
          if (typeof SFX !== 'undefined') SFX.waveStart();
        }
      }

      // 👹 마왕 — 체력이 한 토막씩 깎일 때마다 호위를 부른다.
      // 한 번 세운 배치로 끝까지 가지 못하게 하려는 것이다.
      if (isBossFloor(gs, this.waveIndex)) {
        this.updateBoss(gs, dt);
        // 마왕을 잡으면 그 층은 거기서 끝난다. 100층의 목적은 마왕이지 시간 때우기가 아니다 —
        // 잡고 나서 남은 40초를 아레나만 돌게 하면 최종전이 최종전으로 안 읽힌다.
        if (gs.bossDefeated) {
          clearArena(gs);
          addLog(gs.battle, `🏆 ${ABYSS_FINAL_FLOOR}층 돌파`, '#fbbf24');
          this.endWave(gs);
          return;
        }
      }

      // 하단 아레나
      updateArena(gs, dt);

      // 아군 전멸 — 남은 무리가 성으로 달려든다.
      // 예전에는 화면 밖에서 DPS로 성벽이 갉였는데, 얼마나 못 막았는지가 보이지 않았다.
      // 이제는 달려드는 것이 보이고, 한 마리 닿을 때마다 HP가 떨어진다.
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
        this.wipedAt = this.elapsed;
        addLog(gs.battle, '☠️ 병력 전멸 — 하단이 뚫렸습니다', '#ef4444');
        launchCharge(gs, wipeCost(this.timer, this.waveIndex), 'wipe');
        clearArena(gs);
      }

      // ── 종료 조건 ──
      // 타이머는 "몹이 나오는 시간"이다. 그 시간이 끝나도 판에 몹이 남아 있으면
      // 웨이브는 계속된다 — 양쪽 다 비어야 끝난다.
      //   상단: 스폰이 끝나고 경로 위에 살아 있는 적이 없다 (죽었거나 기지에 닿았다)
      //   하단: 몹이 다 죽었거나, 후퇴했거나, 전멸해서 더 진행될 여지가 없다
      const defClear = this.defenseQueues.every(q => q.remaining <= 0) &&
                       !gs.defenseEnemies.some(e => !e.dead && !e.reached) &&
                       !(gs.chargers || []).some(c => !c.dead);   // 달려드는 무리도 결말이 나야 한다
      const arenaClear = !gs.arena.mobs.some(m => !m.dead);
      const batClear = (gs.battle.phase === 'retreated') ||
                       (gs.battle.phase === 'idle_defeated' && arenaClear) ||
                       (spawnOver && arenaClear);

      // 안 죽는 조합에 걸려도 영원히 끌지는 않는다
      if (this.cleanup >= WAVE_CLEANUP_MAX) {
        for (const e of gs.defenseEnemies) if (!e.dead && !e.reached) e.reached = true;
        if (gs.arena.mobs.length) clearArena(gs);
        addLog(gs.battle, '⏱ 정리 시간이 끝났습니다', '#64748b');
        this.endWave(gs);
        return;
      }

      if (spawnOver && defClear && batClear) this.endWave(gs);
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
      gs.poisonPools       = [];
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
      // 마지막으로 고른 자리를 그대로 다시 적용한다 — 매 층 같은 버튼을 누르지 않아도 되게
      if (typeof applyHeroPlacePref === 'function') applyHeroPlacePref(gs);
      // 아래 절반이 아레나 → 준비 화면으로 바뀐다. 연타 중이던 손가락이
      // 새로 생긴 버튼을 그대로 누르지 않도록 잠깐 탭을 막는다.
      if (typeof lockTapsBriefly === 'function') lockTapsBriefly();
      tickHeroDown(gs);              // 전사한 영웅의 결장 층을 하나 센다
      restHealTeam(gs.battle);       // 생존 병력 휴식 회복
      refreshInnOffers(gs);          // 여관에 새 손님이 온다
      refreshHeroShop(gs);           // 상점 매대도 새로 깐다 (장비 · 스킬)

      // 훈련 마지막 웨이브만 강화 없이 결과로 넘긴다. 무한은 매 층 강화를 고른다.
      // 👹 마왕을 잡은 층도 마찬가지다 — 다음 층이 없는데 강화를 고르게 할 이유가 없다.
      const atCampaignEnd = ((gs.mode !== 'endless') && (this.waveIndex + 1 >= TRAINING_WAVES))
                          || (runHasFinish(gs) && gs.bossDefeated);
      if (!atCampaignEnd) {
        this.phase = 'upgradePick';
        gs.upgradePick = { active: true, cards: rollUpgradeCards(gs.activeUpgrades, fev('cards', 3)) };
        gs.pickScroll = 0;   // 새 패는 언제나 왼쪽 끝에서 본다
      } else {
        this.phase = 'intermission';
        this.intermissionTimer = 0;
      }

      gs.town.waveBuffs = [];
      reapplyAllBonuses(gs);

      // 무한은 층마다 보석이 쌓이고, 깊이 들어갈수록 층당 몫이 커진다
      const et = endlessTier(this.waveIndex);
      if (et > 0) {
        // 처음 닿은 깊이인지 되짚는 층인지에 따라 몫이 다르다.
        // 기준은 '판을 시작할 때의 최고 기록'이다 — 판이 진행되며 갱신되는 값을 쓰면
        // 매 층이 자기 자신을 갱신해서 전부 첫 돌파가 돼 버린다.
        const first = et > (gs.runBestAtStart || 0);
        // 🌑 악몽은 같은 100층을 다시 내려가는 것이라, 단계가 값을 만들어야 한다.
        // 그러지 않으면 1단계를 깬 사람이 2단계로 갈 이유가 없다.
        const step  = endlessGemStepFor(et, gs.runBestAtStart)
                    * fev('gemMult', 1) * (BONUSES.gemMult || 1)
                    * (gs.unbounded ? unboundedGemMult() : nightmareGemMult(gs.nightmare || 0));
        gs.endlessGems = (gs.endlessGems || 0) + step;
        if (first) gs.endlessGemsNew = (gs.endlessGemsNew || 0) + step;
        else       gs.endlessGemsOld = (gs.endlessGemsOld || 0) + step;
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
        // 훈련은 TRAINING_WAVES에서 끝난다 (완주 = 심연 해금).
        // 심연·악몽은 100층 마왕에서 끝난다. ♾️ 무한만 끝이 없다.
        const trainDone = gs.mode !== 'endless' && next >= TRAINING_WAVES;
        const abyssDone = runHasFinish(gs) && gs.bossDefeated;
        if (trainDone || abyssDone) {
          gs.stageCleared = true;
          gs.stats.clears = (gs.stats.clears || 0) + 1;
          if (abyssDone) clearAbyssRun(gs);
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
