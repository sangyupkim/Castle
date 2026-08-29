'use strict';

// ─── 🖼 스프라이트 매니페스트 ─────────────────────────────────────────────────
// 여기 적힌 것만 읽습니다. 비어 있으면 요청이 한 건도 나가지 않고,
// 게임은 지금까지처럼 이모지와 도형으로 그려집니다.
// 규격과 이름 규칙은 같은 폴더의 README.md에 있습니다.
//
// self는 브라우저에서 window와 같고, 서비스워커도 같은 파일을 읽을 수 있게 해줍니다.

// ── 낱장 그림 ───────────────────────────────────────────────────────────────
self.SPRITE_FILES = {

  // 밭 타일 — 타워를 놓는 빈 칸. 20종을 칸마다 섞어 깔아 격자가 안 보이게 한다.
  'tile.field.0':  'tiles/field_00.png',
  'tile.field.1':  'tiles/field_01.png',
  'tile.field.2':  'tiles/field_02.png',
  'tile.field.3':  'tiles/field_03.png',
  'tile.field.4':  'tiles/field_04.png',
  'tile.field.5':  'tiles/field_05.png',
  'tile.field.6':  'tiles/field_06.png',
  'tile.field.7':  'tiles/field_07.png',
  'tile.field.8':  'tiles/field_08.png',
  'tile.field.9':  'tiles/field_09.png',
  'tile.field.10': 'tiles/field_10.png',
  'tile.field.11': 'tiles/field_11.png',
  'tile.field.12': 'tiles/field_12.png',
  'tile.field.13': 'tiles/field_13.png',
  'tile.field.14': 'tiles/field_14.png',
  'tile.field.15': 'tiles/field_15.png',
  'tile.field.16': 'tiles/field_16.png',
  'tile.field.17': 'tiles/field_17.png',
  'tile.field.18': 'tiles/field_18.png',
  'tile.field.19': 'tiles/field_19.png',

  // 길 — 밭 사이로 난 잔디 길. 에셋을 만든 사람의 테스트 이미지가 딱 이 구성이다.
  'tile.path':  'tiles/grass.png',
  'tile.start': 'tiles/grass.png',

  // 타워 — 원본 비율 그대로 세운다 (16~18 × 23~35px 픽셀 아트)
  'tower.arrow.1':  'towers/arrow.png',
  'tower.frost.1':  'towers/frost.png',
  'tower.cannon.1': 'towers/cannon.png',
  'tower.sniper.1': 'towers/sniper.png',
  'tower.tesla.1':  'towers/tesla.png',
  // 독탑 그림은 처음부터 팩에 들어 있었는데(spr_tower_poison_wizard) 배선이 빠져
  // 여섯 타워 중 독탑만 이모지로 그려지고 있었다.
  'tower.poison.1': 'towers/poison.png',

  // 투사체
  'proj.arrow':  'proj/arrow.png',
  'proj.frost':  'proj/frost.png',
  'proj.cannon': 'proj/cannon.png',
  'proj.sniper': 'proj/sniper.png',
  'proj.tesla':  'proj/tesla.png',
  'proj.poison': 'proj/poison.png',

  // 👷 타워 점유자 — Fantasy RPG NPC 팩(32×32, 발끝이 프레임 바닥에 맞춰져 있다).
  // 타워 그림을 종류·티어·분기마다 새로 그리는 대신 '석대 + 사람'으로 나눈다.
  // 사람만 갈아 끼우면 조합이 곱셈으로 늘어난다.
  'crew.arrow':  'crew/arrow.png',      // 궁수
  'crew.frost':  'crew/frost.png',      // 마법사
  'crew.cannon': 'crew/cannon.png',     // 대장장이
  'crew.sniper': 'crew/sniper.png',     // 처형인
  'crew.tesla':  'crew/tesla.png',      // 마법 상인
  'crew.poison': 'crew/poison.png',     // 연금술사

  // 🧱 석대 — 0x72 던전 팩의 진짜 석재 타일. 예전에는 캔버스 도형으로 그렸는데
  // 사람만 픽셀 아트고 받침만 도형이라 재질이 따로 놀았다.
  'keep.wall':   'keep/wall.png',       // 벽돌 몸통 (16×16, 세로로 이어 붙인다)
  'keep.top.l':  'keep/top_l.png',      // 처마 왼쪽 끝
  'keep.top.m':  'keep/top_m.png',      // 처마 가운데
  'keep.top.r':  'keep/top_r.png',      // 처마 오른쪽 끝
  'keep.hole':   'keep/hole.png',       // 총안 구멍
  'keep.door':   'keep/door.png',       // 출입문 (32×32)
  // ★5 분기 깃발 — 분기 색에 가장 가까운 것을 건다
  'keep.banner.red':    'keep/banner_red.png',
  'keep.banner.blue':   'keep/banner_blue.png',
  'keep.banner.green':  'keep/banner_green.png',
  'keep.banner.yellow': 'keep/banner_yellow.png',

  // ⚔️ 용병 · 👑 영웅 · 👾 아레나 몹 — 전부 4프레임 걷기.
  // 훅(unit.* / hero.* / mob.*)은 예전부터 있었는데 그림이 없어서
  // 스무 종류가 전부 '색깔 원 + 이모지'로 그려지고 있었다.
  // 한 장짜리로 두면 실시간 아레나에서 죽은 것처럼 보여 프레임을 넣었다.

  // 기사
  'unit.swordsman.0': 'units/swordsman_0.png',
  'unit.swordsman.1': 'units/swordsman_1.png',
  'unit.swordsman.2': 'units/swordsman_2.png',
  'unit.swordsman.3': 'units/swordsman_3.png',
  // 궁수
  'unit.archer.0': 'units/archer_0.png',
  'unit.archer.1': 'units/archer_1.png',
  'unit.archer.2': 'units/archer_2.png',
  'unit.archer.3': 'units/archer_3.png',
  // 주교
  'unit.healer.0': 'units/healer_0.png',
  'unit.healer.1': 'units/healer_1.png',
  'unit.healer.2': 'units/healer_2.png',
  'unit.healer.3': 'units/healer_3.png',
  // 대형 기사
  'unit.guardian.0': 'units/guardian_0.png',
  'unit.guardian.1': 'units/guardian_1.png',
  'unit.guardian.2': 'units/guardian_2.png',
  'unit.guardian.3': 'units/guardian_3.png',
  // 마법사
  'unit.mage.0': 'units/mage_0.png',
  'unit.mage.1': 'units/mage_1.png',
  'unit.mage.2': 'units/mage_2.png',
  'unit.mage.3': 'units/mage_3.png',
  // 도둑
  'unit.rogue.0': 'units/rogue_0.png',
  'unit.rogue.1': 'units/rogue_1.png',
  'unit.rogue.2': 'units/rogue_2.png',
  'unit.rogue.3': 'units/rogue_3.png',
  // 백정
  'unit.berserker.0': 'units/berserker_0.png',
  'unit.berserker.1': 'units/berserker_1.png',
  'unit.berserker.2': 'units/berserker_2.png',
  'unit.berserker.3': 'units/berserker_3.png',
  // 정예 기사
  'unit.paladin.0': 'units/paladin_0.png',
  'unit.paladin.1': 'units/paladin_1.png',
  'unit.paladin.2': 'units/paladin_2.png',
  'unit.paladin.3': 'units/paladin_3.png',
  // 전령
  'unit.marksman.0': 'units/marksman_0.png',
  'unit.marksman.1': 'units/marksman_1.png',
  'unit.marksman.2': 'units/marksman_2.png',
  'unit.marksman.3': 'units/marksman_3.png',

  // 검성 — 중장 기사
  'hero.blade.0': 'hero/blade_0.png',
  'hero.blade.1': 'hero/blade_1.png',
  'hero.blade.2': 'hero/blade_2.png',
  'hero.blade.3': 'hero/blade_3.png',
  // 수호자 — 대형 정예 기사
  'hero.warden.0': 'hero/warden_0.png',
  'hero.warden.1': 'hero/warden_1.png',
  'hero.warden.2': 'hero/warden_2.png',
  'hero.warden.3': 'hero/warden_3.png',
  // 술사 — 마법 상인
  'hero.sorcerer.0': 'hero/sorcerer_0.png',
  'hero.sorcerer.1': 'hero/sorcerer_1.png',
  'hero.sorcerer.2': 'hero/sorcerer_2.png',
  'hero.sorcerer.3': 'hero/sorcerer_3.png',

  // 고블린
  'mob.goblin.0': 'mobs2/goblin_0.png',
  'mob.goblin.1': 'mobs2/goblin_1.png',
  'mob.goblin.2': 'mobs2/goblin_2.png',
  'mob.goblin.3': 'mobs2/goblin_3.png',
  // 사냥개
  'mob.hound.0': 'mobs2/hound_0.png',
  'mob.hound.1': 'mobs2/hound_1.png',
  'mob.hound.2': 'mobs2/hound_2.png',
  'mob.hound.3': 'mobs2/hound_3.png',
  // 오크
  'mob.orc.0': 'mobs2/orc_0.png',
  'mob.orc.1': 'mobs2/orc_1.png',
  'mob.orc.2': 'mobs2/orc_2.png',
  'mob.orc.3': 'mobs2/orc_3.png',
  // 암흑궁수
  'mob.darkarch.0': 'mobs2/darkarch_0.png',
  'mob.darkarch.1': 'mobs2/darkarch_1.png',
  'mob.darkarch.2': 'mobs2/darkarch_2.png',
  'mob.darkarch.3': 'mobs2/darkarch_3.png',
  // 오우거
  'mob.ogre.0': 'mobs2/ogre_0.png',
  'mob.ogre.1': 'mobs2/ogre_1.png',
  'mob.ogre.2': 'mobs2/ogre_2.png',
  'mob.ogre.3': 'mobs2/ogre_3.png',
  // 보스
  'mob.boss.0': 'mobs2/boss_0.png',
  'mob.boss.1': 'mobs2/boss_1.png',
  'mob.boss.2': 'mobs2/boss_2.png',
  'mob.boss.3': 'mobs2/boss_3.png',
  // 군주
  'mob.warlord.0': 'mobs2/warlord_0.png',
  'mob.warlord.1': 'mobs2/warlord_1.png',
  'mob.warlord.2': 'mobs2/warlord_2.png',
  'mob.warlord.3': 'mobs2/warlord_3.png',

  // 👹 마왕 — 0x72 던전 팩의 big_demon(32×36). 100층에 한 마리만 나오므로
  // 배우(SPRITE_ACTORS)로 등록하지 않고 낱장 8프레임을 시간으로 돌린다.
  'mob.demon.idle.0': 'mobs/demon/idle_0.png',
  'mob.demon.idle.1': 'mobs/demon/idle_1.png',
  'mob.demon.idle.2': 'mobs/demon/idle_2.png',
  'mob.demon.idle.3': 'mobs/demon/idle_3.png',
  'mob.demon.run.0':  'mobs/demon/run_0.png',
  'mob.demon.run.1':  'mobs/demon/run_1.png',
  'mob.demon.run.2':  'mobs/demon/run_2.png',
  'mob.demon.run.3':  'mobs/demon/run_3.png',
};

// ── 이어 붙인 프레임 ────────────────────────────────────────────────────────
self.SPRITE_SHEETS = {
  // 지켜야 하는 기지. 4프레임짜리 깃발 애니메이션이다.
  'tile.base': { file:'tiles/castle.png', fw:52, fh:38, frames:4, fps:4 },
};

// ── 배우 (방향 × 동작 × 프레임) ─────────────────────────────────────────────
// <path><방향>_<동작>.png 로 펼쳐집니다. 방향은 S(옆) · D(아래) · U(위).
// foot — 48px 프레임 안에서 발이 닿는 y. 이 값을 몸 아래쪽에 맞춥니다.
// head — 그림이 실제로 시작하는 y. 체력바와 등급 표시를 여기 위에 놓습니다.
//        (프레임은 48px이지만 캐릭터는 그 안에서 13~22px밖에 안 차지합니다)
self.SPRITE_ACTORS = {
  slime: { path:'mobs/slime/', fw:48, fh:48, frames:6, fps:7,  foot:38, head:24, anims:['Walk'] },
  orc:   { path:'mobs/orc/',   fw:48, fh:48, frames:6, fps:9,  foot:37, head:15, anims:['Walk','Attack'] },
  wolf:  { path:'mobs/wolf/',  fw:48, fh:48, frames:6, fps:11, foot:39, head:17, anims:['Walk','Attack'] },
  bee:   { path:'mobs/bee/',   fw:48, fh:48, frames:6, fps:13, foot:36, head:14, anims:['Walk'] },
};

// 매니페스트를 안 켜고 규칙대로 파일만 떨궈놓고 쓰려면 true.
// 없는 파일마다 콘솔에 404가 한 줄씩 찍히는 것만 감수하면 됩니다.
self.SPRITE_AUTOLOAD = false;
