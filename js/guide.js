'use strict';

// ─── 🧭 첫걸음 안내 ──────────────────────────────────────────────────────────
// 지금까지의 튜토리얼은 글 여섯 장이었다. "이 게임이 무엇인가"는 말해 주지만
// **손이 어디로 가야 하는지**는 말해 주지 않는다. 처음 켠 사람은 여섯 장을 넘긴 뒤
// 캠프 한복판에 혼자 남는다 — 버튼이 열몇 개인데 무엇부터 눌러야 하는지 모른 채로.
//
// 그래서 글이 아니라 **손가락**을 만든다.
//   · 눌러야 할 버튼을 화면에서 직접 짚는다 (그 자리만 밝히고 나머지는 어둡게)
//   · 설명은 한 줄. 읽는 것이 아니라 하는 것이 목적이다.
//   · **탭을 가로채지 않는다.** 진짜 버튼을 진짜로 누르게 한다.
//   · 시킨 일을 해내면 알아서 다음으로 넘어간다 (확인 버튼이 없다).
//
// 마지막 항목이 중요하다. "다음" 버튼을 누르게 하면 안내를 읽고 넘기는 것이
// 과제가 되어 버린다. 여기서는 **게임을 실제로 한 것**이 곧 다음 장이다.
//
// ─── 길을 잃었을 때 ──
// 처음 만들었을 때는 화면이 어긋나면 안내를 그냥 감췄다. 엉뚱한 곳을 짚지 않으려는
// 뜻이었는데, 실제로 해 보니 정반대로 굴렀다 — 마을에 들어가서 '🏰마을' 탭에 서 있는
// 초보에게 "병력을 고용하세요"는 보이지 않고, 화면은 그냥 캄캄해진다. 도와주려던
// 안내가 제일 헤매는 순간에 사라지는 셈이다.
// 그래서 감추는 대신 **되돌아가는 길**을 짚는다. 필요한 탭이 아니면 그 탭 버튼을,
// 건물 화면에 들어가 있으면 나가는 탭을, 목표가 스크롤 밖이면 밀어 보라는 말을 짚는다.
// 안내가 없어지는 경우는 이제 딱 하나 — 다른 페이지(전투/로비)에 있어서 짚을 것 자체가
// 이 화면에 없을 때뿐이다.

const GUIDE_KEY = 'df_guide_v1';

// 두 버튼을 한 번에 짚을 때 — 둘을 감싸는 사각형
// 단계의 문구는 상황에 따라 달라질 수 있다 (함수로도 적는다)
function _guideStr(v, gs) {
  if (typeof v !== 'function') return v;
  try { return v(gs); } catch (e) { return ''; }
}

function _guideUnion(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w:Math.max(a.x+a.w, b.x+b.w)-x, h:Math.max(a.y+a.h, b.y+b.h)-y };
}

const GUIDE_TAB_NAMES = { town:'🏰 마을', army:'⚔️ 출전준비', towers:'🗼 타워배치' };
const GUIDE_TAB_BTN   = { town:'tabTownBtn', army:'tabArmyBtn', towers:'tabTowersBtn' };

// where: 이 단계가 유효한 화면
// tab:   마을 안에서 이 탭이어야 한다 (아니면 그 탭 버튼을 짚는 우회 안내)
// target: 짚을 사각형 (없으면 화면 가운데에 말풍선만)
// done:   이걸 만족하면 다음 단계로. 확인 버튼은 없다.
const GUIDE_STEPS = [
  { id:'train', where:'lobby',
    title:'먼저 훈련 한 판',
    text:'⚔️ [훈련] 버튼을 누르세요.\n30웨이브짜리 연습판입니다.',
    target: gs => gs.ui.trainBtn || gs.ui.sortieBtn,
    done:   gs => !!gs.inRun },

  { id:'town', where:'battle',
    title:'준비는 마을에서',
    text:'타워도 병력도 전부 🏰마을에서 준비합니다.\n[🏰 마을]을 누르세요.',
    target: gs => gs.ui.briefTownBtn,
    done:   gs => gs.page === 'town' },

  // 두 박자짜리 단계다. 자리를 집기 전에는 격자를, 집고 나면 확인 버튼을 짚는다.
  // 처음엔 계속 격자만 짚었는데, 그러면 말풍선이 [여기에 세운다]를 그대로 덮어
  // "누르라고 한 버튼을 안내가 가리는" 꼴이 됐다.
  { id:'tower', where:'town', tab:'towers',
    title: gs => gs.ui.planConfirmBtn ? '이 자리가 맞나요?' : '타워부터 한 기',
    text:  gs => gs.ui.planConfirmBtn
      ? '◎초록 원 안이 사정권입니다. 경로를 몇 칸 덮는지 보고\n[여기에 세운다]를 누르세요. 아니면 ✕취소.'
      : '격자의 빈 칸을 탭하면 ◎사거리가 보입니다.\n경로를 덮는 자리를 고르세요. (화살탑 5골드)',
    target: gs => {
      if (gs.ui.planConfirmBtn) return _guideUnion(gs.ui.planConfirmBtn, gs.ui.planCancelBtn);
      const mg = gs.ui.towerMiniGrid; if (!mg) return null;
      return { x:mg.x, y:mg.y, w:GRID_COLS*mg.cellW, h:GRID_ROWS*mg.cellH };
    },
    done:   gs => gs.towers.length > 0 },

  { id:'hero', where:'town', tab:'army',
    title:'👑 영웅을 아래로',
    text:'영웅은 위(타워 곁)나 아래(아레나) 중 한쪽에 섭니다.\n[하단 전투 배치]를 눌러 아래로 보내세요.',
    target: gs => gs.ui.heroBatBtn,
    done:   gs => gs.hero.placement !== 'none' },

  { id:'deploy', where:'town', tab:'army',
    title:'출전',
    text:'타워가 섰고 영웅이 자리를 잡았습니다.\n[출전! 웨이브 시작]을 누르세요.',
    target: gs => gs.ui.deployBtn,
    done:   gs => typeof wm !== 'undefined' && wm.phase === 'active' },

  { id:'fight', where:'battle',
    title:'두 전선이 함께 굴러갑니다',
    text:'위는 타워가 막고, 아래는 영웅이 혼자 버팁니다.\n아레나를 탭하면 부대가 그 자리로 갑니다.\n쓰러져도 한 층 쉬었다 돌아오니 괜찮습니다.',
    target: null,
    done:   gs => typeof wm !== 'undefined' && wm.phase !== 'active',
    hold:   3.0 },   // 최소 이만큼은 띄워 둔다 — 바로 사라지면 읽을 새가 없다

  // 고용은 맨 뒤다. 시작 골드는 10인데 화살탑이 5, 제일 싼 궁수가 6이라
  // 첫 판 전에 둘 다 사는 것은 애초에 불가능하다. 실제로 재 보면 10골드로 할 수 있는
  // 두 가지 — 타워 먼저(성벽 83) / 궁수 먼저(성벽 68) — 어느 쪽이든 영웅은 첫 웨이브에
  // 쓰러진다. 그러면 숨기지 말고 가르치는 편이 낫다: 혼자 버티는 것이 한계라는 사실
  // 자체가 "왜 병력을 고용하는가"의 답이다. 그래서 성벽이 덜 깎이는 타워 먼저로 두고,
  // 한 웨이브 번 골드로 곧장 곁을 채우게 한다.
  { id:'hire', where:'town', tab:'army',
    title:'혼자로는 벅찹니다',
    text:'영웅 하나로 아레나를 버티기는 어렵습니다.\n한 웨이브 벌었으니 곁에 설 병력을 삽니다.\n카드를 탭하면 고용됩니다.',
    target: gs => (gs.ui.hireCards || [])[0],
    done:   gs => gs.battle.ourTeam.filter(u => !u.isHero).length > 0 },
];

// 마을 본문이 보이는 세로 구간 (탭 바 아래). renderTownPage의 contentY와 맞춘다.
const GUIDE_TOWN_TOP = 92;

function createGuide() {
  return {
    active: false,
    step: 0,
    held: 0,          // 이 단계를 띄운 시간 (hold용)

    start() {
      if (this.seen()) { this.active = false; return; }
      this.active = true; this.step = 0; this.held = 0;
    },
    seen() {
      try { return localStorage.getItem(GUIDE_KEY) === '1'; } catch (e) { return true; }
    },
    finish() {
      this.active = false;
      try { localStorage.setItem(GUIDE_KEY, '1'); } catch (e) {}
    },
    reset() {
      try { localStorage.removeItem(GUIDE_KEY); } catch (e) {}
      this.start();
    },
    current() { return this.active ? (GUIDE_STEPS[this.step] || null) : null; },

    // 매 프레임 — 시킨 일을 해냈으면 다음으로. 확인 버튼은 없다.
    update(gs, dt) {
      if (!this.active) return;
      const s = GUIDE_STEPS[this.step];
      if (!s) { this.finish(); return; }
      this.held += dt || 0;
      let ok = false;
      try { ok = !!s.done(gs); } catch (e) { ok = false; }
      if (ok && this.held >= (s.hold || 0)) {
        this.step++; this.held = 0;
        if (this.step >= GUIDE_STEPS.length) this.finish();
      }
    },

    // 지금 이 화면에서 무엇을 짚고 무엇을 말할지 — 한 군데서 정한다.
    // null이면 이 화면에는 안내가 없다. 그 외에는 항상 할 말이 있다.
    view(gs) {
      const s = this.current(); if (!s) return null;

      // 1) 페이지가 다르면 — 마을로 돌아가면 되는 경우에는 그 문을 짚어 준다.
      if (s.where && s.where !== '*' && gs.page !== s.where) {
        if (s.where === 'town' && gs.page === 'battle' && gs.ui.briefTownBtn) {
          return { step:s, rect:gs.ui.briefTownBtn, detour:true,
                   title:'마을로 돌아가세요',
                   text:`[🏰 마을]을 누르세요.\n다음 할 일 — ${_guideStr(s.title, gs)}` };
        }
        return null;   // 짚을 것이 이 화면에 정말 없을 때만 감춘다
      }

      if (gs.page === 'town') {
        const t = gs.town || {};
        const wantTab = s.tab || t.tab;
        // 2) 건물 안에 들어가 있으면 먼저 나와야 한다. 탭 버튼이 곧 나가는 문이다.
        if (t.screen && t.screen !== 'main') {
          return this._detour(gs, wantTab,
            '먼저 마을 화면으로', `[${GUIDE_TAB_NAMES[wantTab] || '마을'}] 탭을 눌러\n마을 화면으로 돌아가세요.`, s);
        }
        // 3) 탭이 어긋났으면 그 탭을 짚는다.
        if (s.tab && t.tab !== s.tab) {
          return this._detour(gs, s.tab,
            '탭을 옮기세요', `[${GUIDE_TAB_NAMES[s.tab]}] 탭을 누르세요.\n다음 할 일 — ${_guideStr(s.title, gs)}`, s);
        }
      }

      let rect = null;
      if (s.target) { try { rect = s.target(gs); } catch (e) { rect = null; } }
      if (rect && !(rect.w > 0 && rect.h > 0)) rect = null;

      // 4) 짚을 것이 스크롤 밖으로 밀려 있으면 밀어 보라고 말한다.
      if (rect && gs.page === 'town') {
        const below = rect.y > CH - 12;
        const above = rect.y + rect.h < GUIDE_TOWN_TOP + 12;
        if (below || above) {
          return { step:s, rect:null, detour:true,
                   title:_guideStr(s.title, gs),
                   text:`${below ? '▼ 화면을 위로 밀어' : '▲ 화면을 아래로 밀어'} 아래 항목을 찾으세요.\n${_guideStr(s.text, gs).split('\n')[0]}` };
        }
      }
      return { step:s, rect, detour:false,
               title:_guideStr(s.title, gs), text:_guideStr(s.text, gs) };
    },

    _detour(gs, tabId, title, text, s) {
      const r = gs.ui[GUIDE_TAB_BTN[tabId] || ''] || null;
      return { step:s, rect:(r && r.w > 0) ? r : null, detour:true, title, text };
    },

    // 렌더러 호환 — 예전 이름들
    spot(gs)     { const v = this.view(gs); return v ? v.rect : null; },
    onScreen(gs) { return !!this.view(gs); }
  };
}
