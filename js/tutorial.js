'use strict';

const TUTORIAL_STEPS = [
  {
    title: '듀얼 프론티어',
    text: '상단에서는 타워로 적을 막고\n하단에서는 병력을 지휘하여 전투합니다.\n\n탭하여 계속'
  },
  {
    title: '상단: 타워 건설',
    text: '빈 격자 칸을 탭하면 화살 타워가 세워집니다.\n화살 타워: 💰5골드 / 공격력 2 / 초당 1발\n\n초기 골드 10으로 2기 건설 가능!'
  },
  {
    title: '∞ 경로',
    text: '적은 ∞(8자) 모양의 경로를 따라 이동합니다.\n좌측 루프와 우측 루프로 나뉘어 기지로 향합니다.\n\n타워로 경로 주변을 막으세요!'
  },
  {
    title: '하단: 병력 고용',
    text: '웨이브 시작 전, 하단 카드를 탭하여\n병력을 고용하세요.\n\n검사💰8 / 궁수💰6 / 치유사💰10\n최대 4명 고용 가능 (탭하여 해제 가능)'
  },
  {
    title: '턴제 자동전투',
    text: '전투는 1초마다 자동으로 진행됩니다.\n5턴마다 스킬이 자동 발동됩니다.\n\n치유사는 아군을 치유하고\n검사/궁수는 강력한 스킬로 공격합니다!'
  },
  {
    title: '출발!',
    text: '병력을 고용한 후\n[웨이브 시작] 버튼을 누르세요.\n\n3웨이브를 모두 막으면 스테이지 클리어!'
  }
];

function createTutorial() {
  return {
    active: false, step: 0, done: false,
    start() {
      if (localStorage.getItem('df_tut2')===  '1') { this.done=true; return; }
      this.active = true; this.step = 0;
    },
    next() {
      this.step++;
      if (this.step >= TUTORIAL_STEPS.length) {
        this.active = false; this.done = true;
        localStorage.setItem('df_tut2','1');
      }
    },
    current() { return TUTORIAL_STEPS[this.step]||null; }
  };
}
