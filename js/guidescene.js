'use strict';

// ─── 📖 가이드 삽화 ───────────────────────────────────────────────────────────
// 글로만 적힌 설명은 "그래서 그게 화면 어디에 있는데"를 못 알려 준다.
// '경로'라고 써 두면 이미 아는 사람만 알아본다. 짚어 줘야 안다.
//
// 그래서 삽화를 그림 파일로 넣지 않고 **게임 렌더러를 그대로 불러서** 그린다.
// PNG를 떠 두면 UI를 고치는 순간 가이드만 옛날 화면으로 남는다 — 그리고 그건
// 아무도 눈치채지 못한다. 여기서는 renderDefense·renderArenaPhase를 실제로
// 부르므로, 타워 그림이 바뀌면 가이드의 타워 그림도 같이 바뀐다.
//
// 방식:
//   1. newState()로 **데모 상태**를 하나 만든다 (진짜 gs는 건드리지 않는다)
//   2. 오프스크린 캔버스에 그 상태로 화면을 그린다
//   3. 필요한 부분만 잘라 두고, 그 위에 번호 핀을 얹는다
//
// 데모 상태를 쓰는 것이 핵심이다. 진짜 gs로 그리면 렌더러가 gs.ui.*에 버튼
// 자리를 다시 써 버려서, 가이드를 여는 순간 그 뒤 화면의 버튼이 엉뚱한 곳으로
// 옮겨 간다. 상태를 따로 만들면 그 사고가 원천적으로 안 난다.

const GUIDE_PIN_R = 10;

// 장면 캐시 — 한 번 그리면 그대로 쓴다. 가이드는 매 프레임 다시 그려지므로
// 캐시가 없으면 60fps로 전투 화면을 통째로 다시 그리게 된다.
let _guideSceneCache = {};
function guideSceneReset() { _guideSceneCache = {}; }

// ─── 데모 상태 만들기 ────────────────────────────────────────────────────────
// 실제 판을 돌리지 않고 "이런 순간"을 손으로 세워 둔다.
function _demoState() {
  const d = newState();
  d.page = 'battle'; d.inRun = true; d.waveActive = true;
  d.wave = 6; d.gold = 240; d.baseHP = 82;
  d.mode = 'campaign';
  d.battle = createBattle();
  d.battle.phase = 'fighting';
  return d;
}

// 경로 위 t(0~1) 지점의 좌표
function _pathAt(path, t) {
  const i = Math.max(0, Math.min(path.length - 2, Math.floor(t * (path.length - 1))));
  const f = t * (path.length - 1) - i;
  const a = cellCenter(path[i][0], path[i][1]);
  const b = cellCenter(path[i + 1][0], path[i + 1][1]);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, i };
}

// 경로도 타워도 아닌 빈 칸 — 데모에 타워를 세울 자리를 고른다
function _freeCells(taken) {
  const out = [];
  for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++) {
    if (PATH_CELLS.has(`${c},${r}`)) continue;
    if (taken.has(`${c},${r}`)) continue;
    out.push([c, r]);
  }
  return out;
}

// ─── 장면들 ──────────────────────────────────────────────────────────────────
// y/h — 480×978 캔버스에서 잘라낼 세로 구간. 가로는 늘 전체(=원본 그대로).
// build(d) — 데모 상태를 이 장면에 맞게 채운다
// draw(cx, d) — 렌더러 호출
// pins(d) — [{x, y, n, t}] · x,y는 **자른 뒤**가 아니라 원본 캔버스 좌표
const GUIDE_SCENES = {

  // 🗺 한 화면 — 위아래가 동시에 굴러간다는 것부터 보여 준다.
  // 이 게임에서 가장 먼저 막히는 지점이 "왜 화면이 둘이지"이기 때문이다.
  overview: {
    y: 0, h: CH, scale: 0.60,
    build(d) {
      GUIDE_SCENES.defense.build(d);
      GUIDE_SCENES.arena.build(d);
    },
    draw(cx, d) {
      renderDefense(cx, d);
      // 가운데 띠는 wm(웨이브 관리자)의 시계를 읽는다 — 데모에는 없으니 세워 준다
      renderUIBar(cx, d, { phase: 'active', timer: 34, intermissionTimer: 0 });
      renderArenaPhase(cx, d);
    },
    pins(d) {
      return [
        { x: CW * 0.13, y: DEFENSE_H * 0.42, label: '위 — 수성',
          text: '타워를 놓아 **성으로 오는 길**을 막습니다. 손이 덜 갑니다.' },
        { x: CW * 0.30, y: UIBAR_Y + UIBAR_H / 2, label: '가운데',
          text: '남은 시간 · 골드 · 층. **두 전선이 같은 시계**를 씁니다.' },
        { x: CW * 0.13, y: ARENA_Y + ARENA_H * 0.62, label: '아래 — 아레나',
          text: '고용한 부대가 싸워 **골드를 법니다.** 그 골드로 위에 타워를 세웁니다.' },
      ];
    },
  },

  // 🏹 상단 수성 — 격자 · 경로 · 타워 · 성
  defense: {
    y: 0, h: DEFENSE_H,
    build(d) {
      applyPathVariant(0);
      const taken = new Set();
      const put = (c, r, type, lv, br) => {
        const t = makeTower(c, r, type);
        t.level = lv || 1; if (br) t.branch = br;
        d.towers.push(t); taken.add(`${c},${r}`);
        return t;
      };
      put(3, 2, 'arrow', 4);
      put(5, 2, 'cannon', 3);
      put(2, 3, 'frost', 3);
      put(6, 3, 'sniper', 2);
      put(4, 6, 'tesla', 3);

      // 경로 위 적 몇 마리 — 걸어오는 중인 것처럼
      const spots = [0.18, 0.34, 0.52, 0.66];
      const kinds = ['goblin', 'orc', 'runner', 'brute'];
      spots.forEach((t, i) => {
        const e = makeDefenseEnemy(ENEMY_TYPES[kinds[i]] ? kinds[i] : 'goblin', 5);
        const p = _pathAt(THE_PATH, t);
        e.x = p.x; e.y = p.y; e.wpIdx = p.i;
        e.hp = Math.round(e.maxHp * (0.55 + i * 0.12));
        d.defenseEnemies.push(e);
      });
      // 하늘길 한 마리 — 항로가 따로 있다는 걸 그림으로 보여 준다.
      // 항로 위 아무 데나 두면 타워 그림에 가려진다. 타워에서 가장 먼 지점을
      // 골라 앉힌다 — 그래야 '길이 따로 있다'가 그림으로 읽힌다.
      if (ENEMY_TYPES.bat) {
        const f = makeDefenseEnemy('bat', 5);
        let best = null;
        for (let k = 0; k <= 20; k++) {
          const p = _pathAt(f.path, 0.12 + k * 0.028);
          let near = 1e9;
          for (const tw of d.towers) {
            const c = cellCenter(tw.col, tw.row);
            near = Math.min(near, Math.hypot(c.x - p.x, c.y - p.y));
          }
          if (!best || near > best.near) best = { p, near };
        }
        f.x = best.p.x; f.y = best.p.y; f.wpIdx = best.p.i;
        d.defenseEnemies.push(f);
      }
      d.hero.placement = 'none';
    },
    draw(cx, d) { renderDefense(cx, d); },
    pins(d) {
      const p = _pathAt(THE_PATH, 0.26);
      const castle = cellCenter(CASTLE_C, CASTLE_R);
      const air = d.defenseEnemies.find(e => e.flying);
      const arr = [
        { x: p.x, y: p.y - 4, label: '경로',
          text: '몹은 **이 길만** 걷습니다. 길을 벗어나지 않으니, 길 옆이 곧 좋은 자리입니다.' },
        { x: cellCenter(3, 2).x, y: cellCenter(3, 2).y, label: '타워',
          text: '길이 **꺾이는 안쪽**에 세우면 한 마리를 두 번 지나가며 때립니다.' },
        { x: castle.x + 48, y: castle.y - 2, label: '성',   // 성 그림을 가리지 않게 옆에
          text: '몹이 여기 닿으면 **기지 HP**가 깎입니다. 0이면 판이 끝납니다.' },
        { x: cellCenter(1, 5).x, y: cellCenter(1, 5).y, label: '빈 칸',
          text: '누르면 「경로 N칸 사정권」이 뜹니다. **0칸이면 그 자리는 헛돈**입니다.' },
      ];
      // 핀은 그림을 가리지 않게 옆으로 조금 비켜 단다
      if (air) arr.push({ x: air.x + 26, y: air.y + 8, label: '하늘길',
        text: '🦇비행은 경로를 안 탑니다 — **다른 항로**로 질러옵니다. 대공을 따로 두세요.' });
      return arr;
    },
  },

  // ⚔️ 하단 아레나 — 우리 부대 · 몹 · 지형
  arena: {
    y: 0, h: 0,   // build 뒤에 계산 (ARENA_Y는 모드에 따라 움직인다)
    build(d) {
      const a = d.arena, b = d.battle;
      a.mode = 'auto'; a.elapsed = 22; a.waveIndex = 5;
      b.killCount = 14; b.goldEarned = 63;
      // 지형은 층(tier)과 씨앗이 함께 정한다. 아무 층이나 뽑으면 얕은 층이
      // 걸려 지형이 아예 안 깔리고, 그러면 '바위' 설명이 가리킬 것이 없어진다.
      // 바위와 수렁이 **둘 다** 있으면서 너무 어수선하지 않은(4개 이하) 조합을
      // 찾을 때까지 돌린다. 못 찾으면 핀이 그만큼 줄 뿐 그림은 멀쩡하다.
      let tier = 9, seed = 3;
      outer:
      for (let ti = 5; ti <= 14; ti++) {
        for (let sd = 1; sd <= 12; sd++) {
          const ter = generateArenaTerrain(ti, sd) || [];
          if (ter.length <= 4 &&
              ter.some(t => t.kind === 'rock') && ter.some(t => t.kind === 'mud')) {
            tier = ti; seed = sd; break outer;
          }
        }
      }
      a.terrain = generateArenaTerrain(tier, seed) || [];
      a.deco    = generateArenaDeco(tier, seed, a.terrain) || [];

      const cx0 = ARENA_X + ARENA_W / 2, cy0 = ARENA_Y + ARENA_H * 0.60;
      const team = ['guardian', 'swordsman', 'archer', 'healer'];
      // 몸집 배율이 1.85라 반경 40으로는 넷이 한 덩어리로 뭉쳐 보인다.
      // 앞줄(방패·검사) 뒷줄(궁수·치유사)로 벌려 역할이 그림에서 읽히게 한다.
      const slot = [[-30, -6], [16, -2], [-34, 34], [22, 32]];
      team.forEach((id, i) => {
        if (!UNIT_TYPES[id]) return;
        const u = makeUnit(id);
        u.x = cx0 + slot[i][0]; u.y = cy0 + slot[i][1];
        u.slotX = u.x; u.slotY = u.y;
        u.hp = Math.round(u.maxHp * (0.6 + i * 0.1));
        b.ourTeam.push(u);
      });
      const mobs = ['orc', 'goblin', 'hound', 'darkarch', 'goblin'];
      mobs.forEach((id, i) => {
        let m; try { m = makeArenaMob(id, 5, 0, 0, 0); } catch (e) { return; }
        if (!m) return;
        m.isElite = false;
        if (BATTLE_MOB_TYPES[id]) { m.name = BATTLE_MOB_TYPES[id].name; m.color = BATTLE_MOB_TYPES[id].color; }
        m.x = ARENA_X + 62 + i * 84; m.y = ARENA_Y + 54 + (i % 2) * 44;
        // 바위 위에 세우면 몹이 돌에 박힌 것처럼 보인다 — 겹치면 아래로 비킨다
        for (let k = 0; k < 8 && terrainAt(a.terrain, m.x, m.y); k++) m.y += 26;
        m.hp = Math.round(m.maxHp * (0.5 + i * 0.1));
        a.mobs.push(m);
      });
    },
    draw(cx, d) { renderArenaPhase(cx, d); },
    pins(d) {
      const arr = [];
      const ter = d.arena.terrain || [];
      const u = d.battle.ourTeam[0], m = d.arena.mobs[2];
      if (u) arr.push({ x: u.x - 26, y: u.y + 24, label: '우리 부대',
        text: '마을에서 고용한 용병입니다. **자동**이면 알아서, **수동**이면 눌러 준 곳으로 갑니다.' });
      if (m) arr.push({ x: m.x, y: m.y - 22, label: '몹',
        text: '가장자리에서 계속 나옵니다. **60초를 버티면** 완주입니다.' });
      // 지형은 **진짜로 깔린 것**을 짚는다. 없는 것을 설명하면 그림이 거짓말이 된다.
      const rock = ter.find(t => t.kind === 'rock');
      if (rock) arr.push({ x: rock.x + rock.w / 2, y: rock.y + rock.h / 2, label: '바위',
        text: '**원거리를 막습니다** — 우리 화살도, 적 화살도. 근접은 돌아가야 합니다.' });
      const mud = ter.find(t => t.kind === 'mud');
      if (mud) arr.push({ x: mud.x + mud.w / 2, y: mud.y + mud.h / 2, label: '수렁',
        text: '밟으면 **절반 가까이 느려집니다.** 여기로 몹을 끌고 오면 그만큼 더 때립니다.' });
      // 남은 시간은 상태 바의 막대다 — 바닥이 아니라 거기를 짚어야 한다
      arr.push({ x: ARENA_X + ARENA_W * 0.60, y: ARENA_Y - ARENA_STATUS_H / 2, label: '남은 시간',
        text: '0이 되면 완주. 중간에 후퇴하면 **남은 시간 × 0.2**만큼 성벽이 깎입니다.' });
      return arr;
    },
  },
  // 👑 영웅 — 어디에 세우느냐가 곧 어느 전선을 돕느냐다
  hero: {
    y: 0, h: DEFENSE_H,
    build(d) {
      GUIDE_SCENES.defense.build(d);
      d.hero.placement = 'defense';
      d.hero.level = 7;
      d.hero.hp = Math.round((HERO_LEVELS[7] ? HERO_LEVELS[7].hp : 100) * 0.72);
      d.hero.mp = 62;
      // 길 바로 옆, 타워가 없는 칸에 세운다 — '어디에 서 있느냐'가 이 그림의 전부다.
      // 타워 사이에 끼워 두면 영웅 그림이 성벽에 묻혀 무엇을 짚은 건지 안 보인다.
      const c = cellCenter(5, 5);
      d.hero.defX = c.x; d.hero.defY = c.y;
    },
    draw(cx, d) { renderDefense(cx, d); },
    pins(d) {
      const arr = [{ x: d.hero.defX + 26, y: d.hero.defY - 8, label: '영웅',
        text: '**직접 싸웁니다.** 끌어서 옮기고, 웨이브 중에도 자리를 바꿀 수 있습니다.' }];
      // 영웅에게 가장 가까운 길 위의 점 — '길 옆'이라는 말이 그림에서 보이게
      let near = null;
      for (let k = 0; k <= 60; k++) {
        const p = _pathAt(THE_PATH, k / 60);
        const dd = Math.hypot(p.x - d.hero.defX, p.y - d.hero.defY);
        if (!near || dd < near.d) near = { p, d: dd };
      }
      if (near) arr.push({ x: near.p.x - 26, y: near.p.y, label: '길 옆',
        text: '가까운 적을 알아서 칩니다. **길에서 멀면** 한 대도 못 때리고 서 있습니다.' });
      return arr;
    },
  },

  // 🏰 마을 — 판이 멈춰 있는 유일한 곳
  town: {
    y: 0, h: 470,
    build(d) {
      d.page = 'town'; d.gold = 420;
      d.battle = createBattle();
    },
    draw(cx, d) { renderTownPage(cx, d); },
    pins(d) {
      const arr = [];
      // 탭 한가운데에 달면 핀이 탭 이름을 덮어 무엇을 짚었는지 못 읽는다 — 왼쪽 여백에 단다
      const tab = (r, label, text) => { if (r) arr.push({ x: r.x + 15, y: r.y + r.h / 2, label, text }); };
      tab(d.ui.tabTownBtn,   '마을', '건물을 올립니다. **성채가 다른 건물의 레벨 상한**이니 여기부터 봅니다.');
      tab(d.ui.tabArmyBtn,   '병력', '아래에서 싸울 용병을 뽑습니다. 같은 종류를 겹칠수록 값이 오릅니다.');
      tab(d.ui.tabTowersBtn, '타워', '위에 세울 타워를 놓고 올립니다. **빈 칸을 먼저 눌러** 사정권을 보세요.');
      const card = (d.ui.buildingCards || [])[0];
      if (card) arr.push({ x: card.x + card.w - 17, y: card.y + 17, label: '건물 카드',
        text: '눌러 들어가면 그 건물의 **강화 트랙**이 보입니다.' });
      return arr;
    },
  },
};

// ─── 그리기 ──────────────────────────────────────────────────────────────────
// 실패하면 null. 가이드는 삽화가 없으면 그 자리를 건너뛴다 —
// 삽화 하나 때문에 문서 전체가 안 열리는 쪽이 훨씬 나쁘다.
function guideScene(id) {
  if (_guideSceneCache[id] !== undefined) return _guideSceneCache[id];
  const sc = GUIDE_SCENES[id];
  if (!sc) return (_guideSceneCache[id] = null);
  // 삽화를 그리려고 **전역을 건드린다** — 경로 변형(THE_PATH)과 아레나 크기가
  // 그렇다. 판이 굴러가는 중에 가이드를 열면 그 전역이 그대로 남아, 3번 경로에서
  // 놀던 사람의 판이 갑자기 기본 경로로 바뀐다. 빌려 쓴 것은 반드시 돌려놓는다.
  const prevPath = (typeof activePathIdx === 'function') ? activePathIdx() : null;
  const prevRaid = (typeof _arenaRaidMode !== 'undefined') ? _arenaRaidMode : null;
  let out = null;
  try {
    if (prevRaid !== null) applyArenaBounds(false);   // 삽화는 늘 보통 배치로 그린다
    const d = _demoState();
    sc.build(d);
    const y = sc.h ? sc.y : (ARENA_Y - ARENA_STATUS_H);
    const h = sc.h || (ARENA_H + ARENA_STATUS_H);

    const full = document.createElement('canvas');
    full.width = CW; full.height = CH;
    const fx = full.getContext('2d');
    fx.fillStyle = '#0b1220'; fx.fillRect(0, 0, CW, CH);
    sc.draw(fx, d);

    // 한 화면을 통째로 보여 주는 장면은 그대로 넣으면 문서 한 쪽을 다 먹는다.
    // 줄여서 넣되 핀은 줄인 **뒤** 얹는다 — 같이 줄이면 숫자를 못 읽는다.
    const k = sc.scale || 1;
    out = document.createElement('canvas');
    out.width = Math.round(CW * k); out.height = Math.round(h * k);
    const ox = out.getContext('2d');
    ox.imageSmoothingEnabled = true;
    ox.drawImage(full, 0, y, CW, h, 0, 0, out.width, out.height);

    // 핀 — 자른 만큼 위로 당겨서 얹는다.
    // 번호와 풀이를 따로 적어 두면 반드시 어긋난다(핀 하나가 빠지는 층이 있다).
    // 번호는 여기서 순서대로 매기고, 풀이는 그 핀이 들고 있던 것을 그대로 쓴다.
    const pins = (sc.pins ? sc.pins(d) : []) || [];
    pins.forEach((p, i) => _drawPin(ox, p.x * k, (p.y - y) * k, i + 1));
    out._legend = pins.map(p => [p.label || '', p.text || '']);
    out._pinCount = pins.length;
  } catch (e) {
    out = null;
  } finally {
    if (prevPath !== null) applyPathVariant(prevPath);
    if (prevRaid !== null) applyArenaBounds(prevRaid);
  }
  _guideSceneCache[id] = out;
  return out;
}

function _drawPin(cx, x, y, n) {
  const r = GUIDE_PIN_R;
  cx.save();
  // 어떤 배경 위에도 읽히게 — 바깥에 어두운 테를 한 겹 두른다
  cx.beginPath(); cx.arc(x, y, r + 2.5, 0, Math.PI * 2);
  cx.fillStyle = 'rgba(4,7,14,0.72)'; cx.fill();
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
  cx.fillStyle = '#fbbf24'; cx.fill();
  cx.lineWidth = 1.5; cx.strokeStyle = '#78350f'; cx.stroke();
  cx.fillStyle = '#1c1206'; cx.font = 'bold 12px sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(String(n), x, y + 0.5);
  cx.restore();
}

// 풀이는 장면을 그릴 때 핀에서 뽑아 둔 것을 준다 — 번호가 어긋날 길이 없다.
function guideSceneLegend(id) {
  const c = guideScene(id);
  return (c && c._legend) || [];
}
