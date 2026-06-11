'use strict';

const TUTORIAL_STEPS = [
  {
    title: '듀얼 프론티어에 오신걸 환영합니다!',
    text: '화면 상단에서는 적을 막고\n하단에서는 용병으로 전투를 벌입니다.\n\n화면을 탭하여 계속하세요.',
    highlight: null
  },
  {
    title: '상단: 타워 건설',
    text: '상단 격자의 초록색 칸을 탭하면\n타워를 건설할 수 있습니다.\n\n화살 타워: 골드 5개\n(초기 골드: 10개)',
    highlight: { zone: 'defense', msg: '여기를 탭하여 타워 건설' }
  },
  {
    title: '적의 경로',
    text: '적은 빨간 경로를 따라 이동합니다.\n좌측 나선과 우측 나선, 두 갈래로\n나뉘어 기지로 돌격합니다.',
    highlight: { zone: 'path' }
  },
  {
    title: '하단: 용병 구매',
    text: '화면 중앙 UI 바의\n[병력 구매] 버튼으로\n검사 용병을 구매하세요. (골드 10)\n\n용병은 자동으로 적과 싸웁니다.',
    highlight: { zone: 'battle_btn' }
  },
  {
    title: '스킬 사용',
    text: '하단 전투 중에 스킬 버튼으로\n아군을 강화할 수 있습니다.\n\n⚡결집 / 🛡방패막 / 💨돌격',
    highlight: { zone: 'skills' }
  },
  {
    title: '웨이브 시작!',
    text: '준비가 됐으면 중앙의\n[웨이브 시작] 버튼을 누르세요!\n\n웨이브당 60초, 총 3웨이브를\n모두 막으면 스테이지 클리어!',
    highlight: { zone: 'wave_btn' }
  }
];

function createTutorial() {
  return {
    active: false,
    step: 0,
    done: false,

    start() {
      const saved = localStorage.getItem('df_tutorial_done');
      if (saved === '1') { this.done = true; this.active = false; return; }
      this.active = true;
      this.step = 0;
    },

    next() {
      this.step++;
      if (this.step >= TUTORIAL_STEPS.length) {
        this.active = false;
        this.done = true;
        localStorage.setItem('df_tutorial_done', '1');
      }
    },

    current() {
      return TUTORIAL_STEPS[this.step] || null;
    }
  };
}
