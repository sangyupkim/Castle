// ─── 🧭 미로에서 길을 찾는가 ──────────────────────────────────────────────────
// 실행: node tools/maze-check.mjs
//
// 테스터 보고(83층): "미로에서 자동전투 시 적들이랑 우리편이 서로 벽만 마주보고
// 공격이 안 돼서 이 상태로 계속 진행이 안 돼."
//
// 이동은 "적을 향해 직진, 막히면 옆으로 미끄러짐"이 전부였다. 벽이 짧으면
// 미끄러지다 결국 돌아가지만, 미로의 벽은 화면 폭의 절반이 넘고 통로는 줄마다
// 어긋나 있다. 어느 쪽으로 미끄러져야 통로가 나오는지는 국소 정보로 알 수 없다.
//
// 그래서 두 가지를 잰다.
//   ① 혼자 가로지르기 — 아레나 맨 위에서 맨 아래까지 실제로 도착하는가
//   ② 실제 교전       — 아군과 몹을 벽 반대편에 놓고 정말로 싸움이 붙는가
// 배치마다·프레임 간격마다 재고, 지형이 없는 개활지를 대조군으로 둔다
// (길찾기가 멀쩡한 직진까지 망치면 그것도 고장이다).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8921;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.png':'image/png', '.jpg':'image/jpeg', '.webmanifest':'application/manifest+json',
  '.json':'application/json', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404).end(); }
});

const chromium = (() => {
  const require = createRequire(import.meta.url);
  for (const base of ['/opt/node22/lib/node_modules/playwright', 'playwright']) {
    try { return require(base).chromium; } catch {}
  }
  return null;
})();
if (!chromium) { console.error('playwright를 찾지 못했습니다.'); process.exit(2); }

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const pg = await browser.newPage({ viewport: { width: 412, height: 915 } });
const pageErrs = [];
pg.on('pageerror', e => pageErrs.push(e.message));
await pg.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
await pg.waitForFunction(() => typeof Sprites !== 'undefined' && Sprites.ready, null, { timeout: 30000 });

// ── ① 혼자 가로지르기 ────────────────────────────────────────────────────────
// moveToward만 반복해서 부른다. 전투도 스폰도 끼지 않으므로, 실패하면 원인은
// 오직 이동뿐이다.
const crossTrial = (layout, tier, dt, secs) => pg.evaluate(({ layout, tier, dt, secs }) => {
  const L = ARENA_LAYOUTS.find(l => l.id === layout);
  const ter = (L.gen(tier) || []).filter(r => r.w > 6 && r.h > 6);
  if (!gs.arena) startArena(gs, tier);
  gs.arena.terrain = ter;
  const sx = ARENA_X + ARENA_W * 0.5, sy = ARENA_Y + 16;
  const gx = ARENA_X + ARENA_W * 0.5, gy = ARENA_Y + ARENA_H - 16;
  const u = { x: sx, y: sy, radius: 6, moveSpd: 70 };
  const n = Math.round(secs / dt);
  let best = Infinity, arrivedAt = -1;
  for (let f = 0; f < n; f++) {
    moveToward(u, gx, gy, 70, dt, 6);
    const d = Math.hypot(u.x - gx, u.y - gy);
    if (d < best) best = d;
    if (d <= 10 && arrivedAt < 0) { arrivedAt = f * dt; break; }
  }
  return { arrivedAt, best: Math.round(best), walls: ter.filter(r => r.blocksMove).length };
}, { layout, tier, dt, secs });

// ── ② 실제 교전 ──────────────────────────────────────────────────────────────
// 아군은 위쪽 끝, 몹은 아래쪽 끝. 사이에 벽이 몇 겹 있다. 둘 다 자유롭게 움직인다.
const fightTrial = (layout, tier, dt, secs) => pg.evaluate(({ layout, tier, dt, secs }) => {
  gs.stats.runs = 5; gs.nightmareOpen = NIGHTMARE_MAX + 1;
  startRun('endless', 0);
  gs.wave = tier; wm.init(gs.wave);
  gs.unlocked = UNLOCK_DEFS.map(u => u.id);
  gs.gold = 1e6; gs.battle.maxSlots = 6; gs.battle.ourTeam = [];
  gs.hero.placement = 'none';
  for (let i = 0; i < 3; i++) gs.gold = hireUnit(gs.battle, 'swordsman', gs.gold);
  for (let i = 0; i < 2; i++) gs.gold = hireUnit(gs.battle, 'archer', gs.gold);
  startArena(gs, tier);
  wm.timer = 0;                     // 새 몹이 안 나오게 — 내가 놓은 것만 센다
  gs.battle.phase = 'fighting';
  gs.arena.mode = 'auto'; gs.arena.rally = null;

  const L = ARENA_LAYOUTS.find(l => l.id === layout);
  gs.arena.terrain = (L.gen(tier) || []).filter(r => r.w > 6 && r.h > 6);

  const allies = gs.battle.ourTeam.filter(u => !u.isHero);
  allies.forEach((u, i) => {
    u.x = ARENA_X + 70 + i * 26; u.y = ARENA_Y + 18;
    u.hp = u.maxHp = 1e7; u.dead = false;      // 아군이 죽어 판이 끝나면 못 잰다
  });
  gs.arena.mobs = [];
  for (let i = 0; i < 5; i++) {
    const m = makeArenaMob('goblin', tier, 0);
    m.x = ARENA_X + 70 + i * 26; m.y = ARENA_Y + ARENA_H - 18;
    // 방어력까지 층 배율을 타면 83층에서는 한 대에 최소치만 들어가 30초로는
    // 못 죽인다 — 재려는 것은 화력이 아니라 '싸움이 붙는가'다.
    m.maxHp = 400; m.hp = 400; m.atk = 0; m.def = 0;
    gs.arena.mobs.push(m);
  }
  const mine = gs.arena.mobs.slice(), hp0 = mine.map(m => m.hp);

  const n = Math.round(secs / dt);
  for (let f = 0; f < n; f++) updateArena(gs, dt);

  // 지형 안에 박혀 있는 개체가 있으면 그것도 고장이다
  const inside = (e) => gs.arena.terrain.some(t =>
    t.blocksMove && e.x > t.x && e.x < t.x + t.w && e.y > t.y && e.y < t.y + t.h);
  const stuck = allies.filter(u => !u.dead && inside(u)).length
              + mine.filter(m => !m.dead && inside(m)).length;

  return {
    dmg:   Math.round(mine.reduce((a, m, i) => a + (hp0[i] - m.hp), 0)),
    kills: mine.filter(m => m.dead).length,
    stuck,
    walls: gs.arena.terrain.filter(r => r.blocksMove).length,
  };
}, { layout, tier, dt, secs });

const rows = [];
const say = (ok, line) => { rows.push(ok); console.log(`  ${ok ? '✅' : '❌'} ${line}`); };

console.log('\n🧭 미로에서 길을 찾는가\n');

console.log('■ 혼자 가로지르기 — 위 끝에서 아래 끝까지 (20초 안)');
for (const [layout, tier] of [['maze', 20], ['maze', 47], ['maze', 83], ['corridor', 30], ['lake', 25], ['rubble', 40]]) {
  const r = await crossTrial(layout, tier, 1 / 30, 20);
  say(r.arrivedAt >= 0,
      `${layout.padEnd(9)} ${String(tier).padStart(3)}층 · 벽 ${r.walls}개 · ` +
      (r.arrivedAt >= 0 ? `${r.arrivedAt.toFixed(1)}초에 도착` : `못 감 (최소 ${r.best}px까지)`));
}

console.log('■ 실제 교전 — 벽 반대편의 적과 싸움이 붙는가 (30초)');
for (const [layout, tier] of [['maze', 20], ['maze', 83], ['corridor', 30], ['lake', 25], ['rubble', 40]]) {
  const r = await fightTrial(layout, tier, 1 / 30, 30);
  say(r.kills >= 3 && !r.stuck,
      `${layout.padEnd(9)} ${String(tier).padStart(3)}층 · 벽 ${r.walls}개 · ` +
      `처치 ${r.kills}/5 · 피해 ${r.dmg} · 지형에 박힘 ${r.stuck}`);
}

console.log('■ 배속에서도 (프레임이 성기면 벽을 건너뛰거나 굳는다)');
for (const [nm, dt] of [['x2 배속', 2 / 30], ['x3 배속', 3 / 30], ['프레임 튐', 0.12]]) {
  const r = await fightTrial('maze', 83, dt, 30);
  say(r.kills >= 3 && !r.stuck,
      `${nm.padEnd(9)} dt=${dt.toFixed(3)} · 처치 ${r.kills}/5 · 피해 ${r.dmg} · 지형에 박힘 ${r.stuck}`);
}

console.log('■ 대조군 — 개활지는 예전 그대로여야 한다 (길찾기가 직진을 망치면 안 된다)');
{
  const r = await fightTrial('open', 20, 1 / 30, 30);
  say(r.kills === 5, `개활지    · 처치 ${r.kills}/5 · 피해 ${r.dmg}`);
}

await browser.close();
server.close();
const bad = rows.filter(x => !x).length + pageErrs.length;
if (pageErrs.length) console.log('\n페이지 오류:', pageErrs.slice(0, 3));
console.log(bad === 0 ? `\n✅ 전부 통과 — ${rows.length}/${rows.length}\n` : `\n❌ ${bad}건 실패\n`);
process.exit(bad ? 1 : 0);
