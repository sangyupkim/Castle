'use strict';

// ─── 🖼 스프라이트 매니페스트 ─────────────────────────────────────────────────
// 여기 적힌 파일만 읽습니다. 비어 있으면 요청이 한 건도 나가지 않고,
// 게임은 지금까지처럼 이모지와 도형으로 그려집니다.
//
// ⚠️ 지금 켜져 있는 22장은 자리를 잡아두려고 코드로 만든 **임시 그림**입니다.
//    같은 이름으로 덮어쓰면 그대로 바뀝니다 — 이 파일을 고칠 필요도 없습니다.
//    자세한 규격과 이름 규칙은 같은 폴더의 README.md를 보세요.
//
// 그림을 넣는 법
//   1. 파일을 assets/images/ 아래 알맞은 폴더에 넣습니다
//   2. 아래에서 해당 줄의 // 를 지웁니다
//   3. 새로고침 — 그게 전부입니다
//
// 크기는 @2x 기준입니다 (캔버스가 DPR 2로 렌더되므로).
// 넣지 않은 것은 자동으로 예전 그리기로 떨어지므로, 한 장씩 늘려가도 됩니다.

self.SPRITE_FILES = {

  // ── 상단 격자 타일 ────────────────────────────────────────────────────────
  // 한 칸 53 × 50 (@1x) → 파일은 106 × 100 (@2x)
  'tile.ground':      'tiles/ground.png',        // 타워를 놓는 빈 칸
  'tile.ground2':     'tiles/ground2.png',       // 선택 — 있으면 섞어서 깝니다
  'tile.path':        'tiles/path.png',          // 적이 지나는 길
  'tile.path_corner': 'tiles/path_corner.png',   // 선택 — 없으면 path를 씁니다
  'tile.path_cross':  'tiles/path_cross.png',    // 선택 — ∞자 교차 구간
  'tile.start':       'tiles/start.png',         // 적이 나오는 곳 (위쪽 가운데)
  'tile.base':        'tiles/base.png',          // 지켜야 하는 기지 (아래쪽 가운데)

  // ── 타워 ─────────────────────────────────────────────────────────────────
  // 48 × 56 (@1x) → 파일은 96 × 112 (@2x). 세로가 칸(50)보다 크므로 칸 위로 솟습니다.
  // 바닥이 칸 아래쪽에 닿도록 그려주세요 (발밑 기준으로 배치합니다).
  // 티어는 레벨 묶음입니다 — _1은 Lv1~2, _2는 Lv3~4, _3은 Lv5.
  // _1 한 장만 넣어도 모든 레벨에서 그 그림을 씁니다.
  'tower.arrow.1':  'towers/arrow_1.png',
  'tower.arrow.2':  'towers/arrow_2.png',
  'tower.arrow.3':  'towers/arrow_3.png',
  'tower.frost.1':  'towers/frost_1.png',
  'tower.frost.2':  'towers/frost_2.png',
  'tower.frost.3':  'towers/frost_3.png',
  'tower.cannon.1': 'towers/cannon_1.png',
  'tower.cannon.2': 'towers/cannon_2.png',
  'tower.cannon.3': 'towers/cannon_3.png',
  'tower.sniper.1': 'towers/sniper_1.png',
  'tower.sniper.2': 'towers/sniper_2.png',
  'tower.sniper.3': 'towers/sniper_3.png',
  'tower.tesla.1':  'towers/tesla_1.png',
  'tower.tesla.2':  'towers/tesla_2.png',
  'tower.tesla.3':  'towers/tesla_3.png',

};

// self는 브라우저에서 window와 같고, 서비스워커에서도 같은 파일을 읽을 수 있게 해준다.
// 위 목록을 일일이 켜는 대신, 규칙대로 파일을 떨궈놓고 전부 시도하게 하려면 true.
// 없는 파일마다 콘솔에 404가 한 줄씩 찍히는 것만 감수하면 됩니다.
self.SPRITE_AUTOLOAD = false;
