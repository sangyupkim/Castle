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
  // 🧱 던전 벽돌 — 바위 지형(미로·회랑 벽)을 이걸로 깐다.
  // 상하좌우 이음새가 맞는 칸을 골랐으므로 몇 장을 이어 붙여도 격자가 안 보인다.
  'terrain.wall': 'terrain/wall.png',

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
  // 사람만 갈아 끼우면 조합이 곱셈으로 늘어난다 — 이게 두 겹으로 가른 이유다.
  // 분기를 안 골랐으면 종류 기본값, 골랐으면 그 분기 전용 얼굴로 바뀐다.

  // ── 종류 기본 ──
  // 궁수
  'crew.arrow.0': 'crew/arrow_0.png',
  'crew.arrow.1': 'crew/arrow_1.png',
  'crew.arrow.2': 'crew/arrow_2.png',
  'crew.arrow.3': 'crew/arrow_3.png',
  // 마법사
  'crew.frost.0': 'crew/frost_0.png',
  'crew.frost.1': 'crew/frost_1.png',
  'crew.frost.2': 'crew/frost_2.png',
  'crew.frost.3': 'crew/frost_3.png',
  // 대장장이
  'crew.cannon.0': 'crew/cannon_0.png',
  'crew.cannon.1': 'crew/cannon_1.png',
  'crew.cannon.2': 'crew/cannon_2.png',
  'crew.cannon.3': 'crew/cannon_3.png',
  // 처형인
  'crew.sniper.0': 'crew/sniper_0.png',
  'crew.sniper.1': 'crew/sniper_1.png',
  'crew.sniper.2': 'crew/sniper_2.png',
  'crew.sniper.3': 'crew/sniper_3.png',
  // 마법 상인
  'crew.tesla.0': 'crew/tesla_0.png',
  'crew.tesla.1': 'crew/tesla_1.png',
  'crew.tesla.2': 'crew/tesla_2.png',
  'crew.tesla.3': 'crew/tesla_3.png',
  // 연금술사
  'crew.poison.0': 'crew/poison_0.png',
  'crew.poison.1': 'crew/poison_1.png',
  'crew.poison.2': 'crew/poison_2.png',
  'crew.poison.3': 'crew/poison_3.png',

  // ── ★5 분기 18갈래 ──
  // 💨 속사 — 도둑
  'crew.a_rapid.0': 'crew/a_rapid_0.png',
  'crew.a_rapid.1': 'crew/a_rapid_1.png',
  'crew.a_rapid.2': 'crew/a_rapid_2.png',
  'crew.a_rapid.3': 'crew/a_rapid_3.png',
  // 🎯 관통 — 궁수
  'crew.a_pierce.0': 'crew/a_pierce_0.png',
  'crew.a_pierce.1': 'crew/a_pierce_1.png',
  'crew.a_pierce.2': 'crew/a_pierce_2.png',
  'crew.a_pierce.3': 'crew/a_pierce_3.png',
  // 🏹 공성 — 대형 기사
  'crew.a_siege.0': 'crew/a_siege_0.png',
  'crew.a_siege.1': 'crew/a_siege_1.png',
  'crew.a_siege.2': 'crew/a_siege_2.png',
  'crew.a_siege.3': 'crew/a_siege_3.png',
  // 🧊 혹한 — 키 큰 수녀
  'crew.f_deep.0': 'crew/f_deep_0.png',
  'crew.f_deep.1': 'crew/f_deep_1.png',
  'crew.f_deep.2': 'crew/f_deep_2.png',
  'crew.f_deep.3': 'crew/f_deep_3.png',
  // 💎 서릿발 — 마법사
  'crew.f_shatter.0': 'crew/f_shatter_0.png',
  'crew.f_shatter.1': 'crew/f_shatter_1.png',
  'crew.f_shatter.2': 'crew/f_shatter_2.png',
  'crew.f_shatter.3': 'crew/f_shatter_3.png',
  // 🌨️ 눈보라 — 수녀
  'crew.f_blizzard.0': 'crew/f_blizzard_0.png',
  'crew.f_blizzard.1': 'crew/f_blizzard_1.png',
  'crew.f_blizzard.2': 'crew/f_blizzard_2.png',
  'crew.f_blizzard.3': 'crew/f_blizzard_3.png',
  // 💥 융단 — 백정
  'crew.c_carpet.0': 'crew/c_carpet_0.png',
  'crew.c_carpet.1': 'crew/c_carpet_1.png',
  'crew.c_carpet.2': 'crew/c_carpet_2.png',
  'crew.c_carpet.3': 'crew/c_carpet_3.png',
  // 🛡️ 철갑탄 — 중장 기사
  'crew.c_ap.0': 'crew/c_ap_0.png',
  'crew.c_ap.1': 'crew/c_ap_1.png',
  'crew.c_ap.2': 'crew/c_ap_2.png',
  'crew.c_ap.3': 'crew/c_ap_3.png',
  // 🚀 박격 — 대장장이
  'crew.c_mortar.0': 'crew/c_mortar_0.png',
  'crew.c_mortar.1': 'crew/c_mortar_1.png',
  'crew.c_mortar.2': 'crew/c_mortar_2.png',
  'crew.c_mortar.3': 'crew/c_mortar_3.png',
  // 🎯 헤드샷 — 처형인
  'crew.s_head.0': 'crew/s_head_0.png',
  'crew.s_head.1': 'crew/s_head_1.png',
  'crew.s_head.2': 'crew/s_head_2.png',
  'crew.s_head.3': 'crew/s_head_3.png',
  // 🔫 연사 — 전령
  'crew.s_auto.0': 'crew/s_auto_0.png',
  'crew.s_auto.1': 'crew/s_auto_1.png',
  'crew.s_auto.2': 'crew/s_auto_2.png',
  'crew.s_auto.3': 'crew/s_auto_3.png',
  // 💀 대물 — 정예 기사
  'crew.s_anti.0': 'crew/s_anti_0.png',
  'crew.s_anti.1': 'crew/s_anti_1.png',
  'crew.s_anti.2': 'crew/s_anti_2.png',
  'crew.s_anti.3': 'crew/s_anti_3.png',
  // ⛓️ 연쇄 — 마법 상인
  'crew.t_chain.0': 'crew/t_chain_0.png',
  'crew.t_chain.1': 'crew/t_chain_1.png',
  'crew.t_chain.2': 'crew/t_chain_2.png',
  'crew.t_chain.3': 'crew/t_chain_3.png',
  // 🔋 과충전 — 왕
  'crew.t_over.0': 'crew/t_over_0.png',
  'crew.t_over.1': 'crew/t_over_1.png',
  'crew.t_over.2': 'crew/t_over_2.png',
  'crew.t_over.3': 'crew/t_over_3.png',
  // 🛩️ 대공 — 공주
  'crew.t_aa.0': 'crew/t_aa_0.png',
  'crew.t_aa.1': 'crew/t_aa_1.png',
  'crew.t_aa.2': 'crew/t_aa_2.png',
  'crew.t_aa.3': 'crew/t_aa_3.png',
  // ☠️ 맹독 — 연금술사
  'crew.p_virul.0': 'crew/p_virul_0.png',
  'crew.p_virul.1': 'crew/p_virul_1.png',
  'crew.p_virul.2': 'crew/p_virul_2.png',
  'crew.p_virul.3': 'crew/p_virul_3.png',
  // 🌫️ 확산 — 뚱뚱한 수녀
  'crew.p_spread.0': 'crew/p_spread_0.png',
  'crew.p_spread.1': 'crew/p_spread_1.png',
  'crew.p_spread.2': 'crew/p_spread_2.png',
  'crew.p_spread.3': 'crew/p_spread_3.png',
  // 🧪 부식 — 상인
  'crew.p_corrode.0': 'crew/p_corrode_0.png',
  'crew.p_corrode.1': 'crew/p_corrode_1.png',
  'crew.p_corrode.2': 'crew/p_corrode_2.png',
  'crew.p_corrode.3': 'crew/p_corrode_3.png',

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

  // 😈 뿔귀 — 0x72 chort(16×23). 붉은 몸에 흰 뿔이라 지금 화면의 어떤 것과도 안 겹친다.
  // 처음엔 knight_m(방패 든 파란 기사)을 썼는데, 아군 수호병과 색·실루엣이 거의 같아
  // 적인지 아군인지 구별되지 않았다. 이름도 둘 다 '방패병'이었다.
  'mob.hornfiend.0': 'mobs2/hornfiend_0.png',
  'mob.hornfiend.1': 'mobs2/hornfiend_1.png',
  'mob.hornfiend.2': 'mobs2/hornfiend_2.png',
  'mob.hornfiend.3': 'mobs2/hornfiend_3.png',

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
  // 🎒 장비 아이콘 — Kyrise 16x16 RPG Icon Pack의 32×32판.
  // 지금까지 전부 이모지였는데, 이모지는 기기마다 그림이 다르고(안드로이드·iOS·PC가
  // 제각각) 픽셀 아트인 나머지 화면과 따로 논다. 등급이 색으로 읽히도록
  // 팩의 색 램프(갈색 → 은 → 파랑 → 금 → 빨강)를 부위마다 그대로 태웠다.
  'item.w_iron':   'items/w_iron.png',
  'item.w_silver': 'items/w_silver.png',
  'item.w_staff':  'items/w_staff.png',
  'item.w_dragon': 'items/w_dragon.png',
  'item.w_worldend':'items/w_worldend.png',

  'item.h_leather':'items/h_leather.png',
  'item.h_warrior':'items/h_warrior.png',
  'item.h_crown':  'items/h_crown.png',
  'item.h_halo':   'items/h_halo.png',

  'item.a_chain':  'items/a_chain.png',
  'item.a_plate':  'items/a_plate.png',
  'item.a_shadow': 'items/a_shadow.png',
  'item.a_aegis':  'items/a_aegis.png',

  'item.p_cloth':  'items/p_cloth.png',
  'item.p_guard':  'items/p_guard.png',
  'item.p_titan':  'items/p_titan.png',
  'item.p_stride': 'items/p_stride.png',

  'item.b_swift':  'items/b_swift.png',
  'item.b_wind':   'items/b_wind.png',
  'item.b_sky':    'items/b_sky.png',
  'item.b_void':   'items/b_void.png',

  'item.c_ringhp':  'items/c_ringhp.png',
  'item.c_ringgold':'items/c_ringgold.png',
  'item.c_amulet':  'items/c_amulet.png',
  'item.c_cross':   'items/c_cross.png',
  'item.c_tome':    'items/c_tome.png',
  'item.c_eye':     'items/c_eye.png',

  // 🪨 던전 돌바닥 — 아레나 바닥에 깐다. 상단은 밭, 하단은 던전으로 갈라
  // 두 전선이 다른 곳으로 보이게 한다.
  'tile.dungeon': 'terrain/floor.png',

  // 🖼 UI — Cryo's Mini GUI에서 잘라낸 9슬라이스 판과 막대 채움.
  // 패널은 8px 모서리 기준으로 늘린다(drawPanel9). 막대는 가로로 늘리면 된다.
  'ui.panel.dark':  'ui/panel_dark.png',    // 검정 + 옅은 남색 테두리 — 기본
  'ui.panel.gold':  'ui/panel_gold.png',    // 검정 + 주황 테두리 — 고른 것/중요한 것
  'ui.panel.navy':  'ui/panel_navy.png',    // 짙은 남색 채움
  'ui.panel.paper': 'ui/panel_paper.png',   // 양피지
  'ui.panel.wood':  'ui/panel_wood.png',    // 나무
  'ui.bar.red':     'ui/bar_red.png',
  'ui.bar.blue':    'ui/bar_blue.png',
  'ui.bar.green':   'ui/bar_green.png',
  'ui.bar.orange':  'ui/bar_orange.png',
};

// ── 이어 붙인 프레임 ────────────────────────────────────────────────────────
self.SPRITE_SHEETS = {
  // 지켜야 하는 기지. 4프레임짜리 깃발 애니메이션이다.
  'tile.base': { file:'tiles/castle.png', fw:52, fh:38, frames:4, fps:4 },

  // ✨ 스킬 연출 — Effect and FX Pixel All Free. 원본은 64px 격자에
  // 가로=프레임 / 세로=색 9종인데, **채도가 0인 흰 행만** 한 줄 뽑아 왔다.
  // 색은 게임에서 입힌다(Sprites의 tint가 곱하기라 흰 그림이 제일 잘 물든다).
  // 스킬마다 파일을 따로 두면 20종 × 색이 곱셈으로 늘어난다.
  'fx.nova':   { file:'fx/nova.png',   fw:64, fh:64, frames:16, fps:26 },  // 사방으로 뻗는 광선
  'fx.slashx': { file:'fx/slashx.png', fw:64, fh:64, frames:9,  fps:22 },  // X자 베기
  'fx.spin':   { file:'fx/spin.png',   fw:64, fh:64, frames:22, fps:34 },  // 회전하는 칼날 넷
  'fx.burst':  { file:'fx/burst.png',  fw:64, fh:64, frames:10, fps:24 },  // 꽃처럼 터지는 폭발
  'fx.rune':   { file:'fx/rune.png',   fw:64, fh:64, frames:13, fps:20 },  // 마법진
  'fx.streak': { file:'fx/streak.png', fw:64, fh:64, frames:11, fps:26 },  // 길게 늘어지는 섬광

  // 🗺 아레나 지형 타일 — free 2D top-down pixel dungeon 팩(16px 격자).
  // 손으로 그린 물결·톱니 대신 진짜 타일을 깐다. 둘 다 애니메이션이라
  // '지금 위험하다'가 움직임으로 읽힌다.
  //   가시 — 5프레임: 바닥 구멍 → 창이 솟았다가 다시 들어간다.
  //          그래서 fps를 낮게 잡았다. 빠르면 함정이 아니라 지직거림으로 보인다.
  'terrain.spikes': { file:'terrain/spikes.png', fw:16, fh:16, frames:5, fps:5 },
  'terrain.water':  { file:'terrain/water.png',  fw:16, fh:16, frames:5, fps:4 },
  // 🐊 수렁 — 같은 물 프레임을 늪의 누런 초록으로 색만 돌려 구워 뒀다.
  // 실행 중에 곱하기로 물들여 봤더니 무늬가 뭉개져 단색 판이 됐다.
  // 미리 만들어 두면 밝고 어두운 결이 그대로 남는다. fps를 물의 절반으로 떨어뜨려
  // '흐르는 물'과 '고인 물'을 가른다.
  'terrain.bog':    { file:'terrain/bog.png',    fw:16, fh:16, frames:5, fps:2 },

  // 🔥 화톳불 — 같은 팩의 fire_animation2. 원본은 32px 격자에 가로=불꽃 크기 3종 /
  // 세로=6프레임이라, **제일 큰 0열만** 가로로 펴 왔다. 몸통이 흰색이라
  // 그릴 때 주황을 곱해 쓴다(흰 그림이 tint를 제일 잘 받는다).
  'fx.fire': { file:'fx/fire.png', fw:32, fh:32, frames:6, fps:9 },

  // 🛢 바닥 장식 — 같은 팩의 Objects. 통·상자·항아리·금무더기 8종을
  // 16×32 칸에 **바닥 정렬**해 담았다. 그래서 발밑 y 하나만 주면 놓인다.
  // 판정에는 관여하지 않는다 — 빈 바닥이 덜 심심해 보이라고 두는 것뿐이다.
  'terrain.deco': { file:'terrain/deco.png', fw:16, fh:32, frames:8, fps:0 },
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
