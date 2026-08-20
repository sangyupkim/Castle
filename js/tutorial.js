'use strict';

const TUTORIAL_STEPS = [
  {
    title: '듀얼 프론티어',
    text: '상단에서는 타워로 기지를 지키고\n하단에서는 병력을 지휘해 전투합니다.\n두 전선을 동시에 관리하세요.\n\n탭하여 계속'
  },
  {
    title: '상단: 타워 건설',
    text: '툴바에서 타워를 고른 뒤\n빈 격자 칸을 탭하면 건설됩니다.\n\n🏹화살탑 ❄️서리탑 💣대포탑 🎯저격탑\n각기 다른 역할을 가집니다.'
  },
  {
    title: '타워 업그레이드 / 판매',
    text: '이미 세운 타워를 탭하면\n툴바가 ⬆업그레이드 / 💰판매로 바뀝니다.\n\n타워는 최대 3레벨까지 강화됩니다.'
  },
  {
    title: '∞ 경로',
    text: '적은 ∞(8자) 경로를 따라 기지로 향합니다.\n같은 칸을 두 번 지나므로\n교차 지점 주변이 가장 효율적입니다.'
  },
  {
    title: '하단: 병력 고용',
    text: '웨이브 시작 전 카드를 탭해 병력을 고용하세요.\n\n🏹궁수 ⚔️검사 ✚치유사 🛡️방패병 ✨마법사\n슬롯을 탭하면 해고(환불)됩니다.'
  },
  {
    title: '턴제 자동전투',
    text: '전투는 1초마다 자동 진행되고\n5틱마다 스킬이 발동됩니다.\n\n방패병은 적의 표적을 끌고 보호막을,\n마법사는 광역 피해를 넣습니다.'
  },
  {
    title: '성장 3단계',
    text: '① 골드 — 타워/병력/케이브에 투자\n② 강화 픽 — 웨이브 클리어마다 3장 중 1장\n③ 영혼석 — 게임오버 후 영구 강화\n\n실패해도 반드시 강해집니다.'
  },
  {
    title: '출발!',
    text: `병력을 고용하고 [웨이브 시작]을 누르세요.\n\n총 ${STAGE_WAVES}웨이브를 막으면 스테이지 클리어!\n그 뒤엔 무한 모드가 열립니다.\n\n⏸ 일시정지 · ⏩ 배속 · 🔊 음소거`
  }
];

function createTutorial() {
  return {
    active: false, step: 0, done: false,
    start() {
      if (localStorage.getItem('df_tut3') === '1') { this.done = true; return; }
      this.active = true; this.step = 0;
    },
    replay() { this.active = true; this.step = 0; this.done = false; },
    next() {
      this.step++;
      if (this.step >= TUTORIAL_STEPS.length) {
        this.active = false; this.done = true;
        localStorage.setItem('df_tut3', '1');
      }
    },
    current() { return TUTORIAL_STEPS[this.step] || null; }
  };
}
