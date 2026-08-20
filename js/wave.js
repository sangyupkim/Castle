'use strict';

function createWaveManager() {
  return {
    waveIndex: 0,
    phase: 'idle',
    timer: 0,
    elapsed: 0,
    intermissionTimer: 0,
    defenseQueues: [],
    battleSpawnQueues: [],
    maxLive: 2,

    init(idx) {
      this.waveIndex = idx;
      this.phase = 'idle';
      this.timer = WAVE_DURATION;
      this.elapsed = 0;
      this.defenseQueues = [];
      this.battleSpawnQueues = [];
      this.maxLive = maxLiveEnemies(idx);
    },

    startWave(gs) {
      if (this.phase !== 'idle') return;
      if (!gs.battle.ourTeam.length) return; // 병력 필수

      this.phase   = 'active';
      this.elapsed = 0;
      this.timer   = WAVE_DURATION;
      this.maxLive = maxLiveEnemies(this.waveIndex);

      const def = getWaveDef(this.waveIndex);
      const spawnMult = BONUSES.spawnSpeedMult || 1;

      // 상단 스폰 큐
      // 웨이브가 오를수록 상단 물량도 늘어난다
      const countMult = 1 + this.waveIndex * DEF_WAVE_COUNT_SCALE;
      this.defenseQueues = def.defenseEnemies.map(d => ({
        type:d.type, remaining: Math.max(1, Math.round(d.count * countMult)),
        interval:d.interval / 1000, nextSpawn:0.5
      }));

      // 하단 연속 스폰 큐
      this.battleSpawnQueues = def.battleSpawns.map(b => ({
        type:b.type,
        interval: b.interval / spawnMult,
        nextSpawn: b.offset / spawnMult
      }));

      gs.battle.enemyTeam = [];
      startFighting(gs.battle);
      if (typeof SFX !== 'undefined') SFX.waveStart();
    },

    // 비어 있는 전투 슬롯 번호를 찾는다 (겹쳐 그려지는 문제 방지)
    // 사망 후 페이드아웃 중인 적이 남아 있는 슬롯도 비어 있지 않은 것으로 본다
    freeSlot(battle) {
      const used = new Set(battle.enemyTeam.map(e => e.slot));
      for (let i = 0; i < this.maxLive; i++) if (!used.has(i)) return i;
      return -1;
    },

    update(gs, dt) {
      if (this.phase !== 'active') return;

      this.elapsed += dt;
      this.timer = Math.max(0, WAVE_DURATION - this.elapsed);

      // 상단 적 스폰
      for (const q of this.defenseQueues) {
        if (q.remaining <= 0) continue;
        q.nextSpawn -= dt;
        if (q.nextSpawn <= 0) {
          gs.defenseEnemies.push(makeDefenseEnemy(q.type, this.waveIndex));
          q.remaining--;
          q.nextSpawn = q.interval;
        }
      }

      // 하단 연속 스폰 (전투 중일 때만, 빈 슬롯이 있을 때만)
      if (gs.battle.phase === 'fighting') {
        for (const q of this.battleSpawnQueues) {
          q.nextSpawn -= dt;
          if (q.nextSpawn > 0) continue;
          if (this.elapsed <= WAVE_DURATION) {
            const slot = this.freeSlot(gs.battle);
            if (slot >= 0) {
              const mob = makeScaledMob(q.type, gs.battle.killCount, gs.caveLevel);
              mob.slot  = slot;
              mob.drawY = unitY(slot);
              gs.battle.enemyTeam.push(mob);
              q.nextSpawn = q.interval;
            } else {
              q.nextSpawn = 0.4;   // 슬롯이 빌 때까지 짧게 재시도
            }
          } else {
            q.nextSpawn = q.interval;
          }
        }
      }

      // 아군 전멸 시 전투만 중단, 타이머는 계속
      if (gs.battle.phase === 'lost') {
        gs.battle.phase = 'idle_defeated';
      }

      // 종료 조건: 타이머 종료 or (상단 클리어 + 아군 전멸)
      const defDone = this.defenseQueues.every(q => q.remaining <= 0) &&
                      gs.defenseEnemies.every(e => e.dead || e.reached);
      const batDone = gs.battle.phase === 'idle_defeated';
      if (this.timer <= 0 || (defDone && batDone)) {
        this.endWave(gs);
      }
    },

    endWave(gs) {
      // 승패 판정
      if (gs.battle.phase === 'fighting') {
        gs.battle.phase  = 'won';
        gs.battle.result = 'won';
      }

      // 자원 지급
      const earned    = gs.battle.goldEarned;
      const killBonus = Math.round(gs.battle.killCount * (1 + this.waveIndex * 0.25));
      const winBonus  = (gs.battle.result === 'won') ? (12 + this.waveIndex * 6) : 0;
      const total     = earned + killBonus + winBonus;
      gs.gold += total;

      const parts = [];
      if (earned > 0)    parts.push(`처치 +${earned}💰`);
      if (killBonus > 0) parts.push(`처치보너스 +${killBonus}💰`);
      if (winBonus > 0)  parts.push(`승리 +${winBonus}💰`);
      addLog(gs.battle, `웨이브${this.waveIndex + 1}: ${parts.join(' ')}`, COLORS.gold);

      if (typeof SFX !== 'undefined') {
        if (gs.battle.result === 'won') SFX.win(); else SFX.lose();
      }

      // 영웅을 하단에 배치했다면 상태를 되돌려 받는다
      const heroUnit = gs.battle.ourTeam.find(u => u.isHero);
      if (heroUnit) {
        if (heroUnit.dead) killHero(gs);
        else gs.hero.hp = Math.max(1, Math.round(heroUnit.hp));
      }

      // 정리
      gs.defenseEnemies    = [];
      gs.projectiles       = [];
      gs.battle.enemyTeam  = [];
      gs.battle.ourTeam    = gs.battle.ourTeam.filter(u => !u.dead && !u.isHero);
      gs.battle.phase      = 'hire';
      gs.battle.result     = null;
      gs.battle.goldEarned = 0;
      gs.battle.floaties   = [];
      gs.battle.maxSlots   = 4 + BONUSES.maxSlotBonus;
      setBattleSlotCount(gs.battle.maxSlots);
      gs.hero.placement    = 'none';

      // 생존 병력 휴식 회복
      restHealTeam(gs.battle);

      // 기록 갱신
      gs.stats.wavesCleared = Math.max(gs.stats.wavesCleared, this.waveIndex + 1);

      // 웨이브 클리어 강화 픽 (스테이지 최종 웨이브 제외)
      const isFinal = !gs.endless && (this.waveIndex + 1 >= STAGE_WAVES);
      if (!isFinal) {
        this.phase = 'upgradePick';
        gs.upgradePick = { active: true, cards: rollUpgradeCards(gs.activeUpgrades) };
      } else {
        this.phase = 'intermission';
        this.intermissionTimer = INTERMISSION;
      }

      SaveManager.save(gs);
    },

    confirmPick(gs) {
      gs.upgradePick = { active: false, cards: [] };
      this.phase = 'intermission';
      this.intermissionTimer = INTERMISSION;
    },

    // 인터미션을 즉시 건너뛴다 (준비가 끝났을 때)
    skipIntermission() {
      if (this.phase === 'intermission') this.intermissionTimer = 0;
    },

    updateIntermission(gs, dt) {
      if (this.phase !== 'intermission') return;
      this.intermissionTimer = Math.max(0, this.intermissionTimer - dt);

      if (this.intermissionTimer <= 0) {
        const next = this.waveIndex + 1;
        if (!gs.endless && next >= STAGE_WAVES) {
          gs.stageCleared = true;
          SaveManager.save(gs);
        } else {
          gs.wave = next;
          this.init(next);
        }
      }
    }
  };
}
