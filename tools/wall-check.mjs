// ─── 🪨 벽이 화살을 막는가 ────────────────────────────────────────────────────
// 실행: node tools/wall-check.mjs
//
// 테스터 보고: "미로에서 아군 궁수 공격이 벽을 뚫고 뒤에 있는 적을 맞는다.
// 전부는 아니고 일부만 맞는 느낌."
//
// '일부만'이 핵심이었다. 투사체는 **이번 스텝의 끝점 한 점**만 지형과 대조했다.
// 60fps에서 스텝은 7px, 미로 벽은 12px이라 보통은 걸린다 — 그런데 배속(x2·x3)이나
// 프레임이 한 번 튀면 스텝이 14~35px이 되어 벽을 통째로 건너뛴다.
// 그래서 같은 판에서도 어떤 화살은 막히고 어떤 화살은 통과했다.
//
// 눈으로는 절대 못 잡는 종류라 프레임 간격을 바꿔 가며 자로 잰다.
// 과차단도 같이 본다 — 벽이 없을 때 안 맞으면 그것도 고장이다.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8919;
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

// 아레나를 가로지르는 벽 하나를 세우고, 아군은 위·적은 아래에 못박아 둔다.
// 자리를 고정해야 '걸어가서 시야를 확보한 것'과 '벽을 뚫은 것'이 안 섞인다.
const trial = ({ dt, wall, unit }) => pg.evaluate(({ dt, wall, unit }) => {
  gs.stats.runs = 5; gs.nightmareOpen = NIGHTMARE_MAX + 1;
  startRun('endless', 0);
  gs.wave = 20; wm.init(gs.wave);
  gs.unlocked = UNLOCK_DEFS.map(u => u.id);
  gs.gold = 1e6; gs.battle.maxSlots = 6; gs.battle.ourTeam = [];
  gs.hero.placement = 'none';
  for (let i = 0; i < 3; i++) gs.gold = hireUnit(gs.battle, unit, gs.gold);
  startArena(gs, 20);
  wm.timer = 0;                     // 새 몹이 안 나오게 — 내가 놓은 것만 센다
  gs.battle.phase = 'fighting';     // 없으면 updateArena가 첫 줄에서 return
  const midY = ARENA_Y + ARENA_H / 2;
  gs.arena.terrain = wall
    ? [{ kind:'rock', x:ARENA_X, y:midY-6, w:ARENA_W, h:12, blocksMove:true, blocksShot:true }]
    : [];
  const allies = gs.battle.ourTeam.filter(u => !u.isHero);
  gs.arena.mobs = [];
  for (let i = 0; i < 3; i++) {
    const m = makeArenaMob('goblin', 20, 0);
    m.maxHp = 1e9; m.hp = 1e9; m.moveSpd = 0; m.atk = 0;
    gs.arena.mobs.push(m);
  }
  const place = () => {
    allies.forEach((u, i) => { u.x = ARENA_X+60+i*24; u.y = midY-40; u.hp = u.maxHp; u.dead = false; });
    gs.arena.mobs.forEach((m, i) => { m.x = ARENA_X+60+i*24; m.y = midY+40; });
  };
  place();
  const mine = gs.arena.mobs.slice(), hp0 = mine.map(m => m.hp);
  gs.arena.mode = 'auto'; gs.arena.rally = null;
  let shots = 0;
  for (let f = 0; f < 900; f++) {
    place();
    const before = gs.arena.shots.length;
    updateArena(gs, dt);
    if (gs.arena.shots.length > before) shots += gs.arena.shots.length - before;
  }
  return { dmg: Math.round(mine.reduce((a, m, i) => a + (hp0[i] - m.hp), 0)), shots };
}, { dt, wall, unit });

const FRAMES = [['60fps', 1/60], ['30fps', 1/30], ['x2 배속', 2/30], ['x3 배속', 3/30], ['프레임 튐', 0.12]];
const rows = [];
console.log('\n🪨 벽이 화살을 막는가\n');

console.log('■ 벽이 가로막고 있을 때 — 한 발도 통하면 안 된다');
for (const [nm, dt] of FRAMES) {
  const r = await trial({ dt, wall: true, unit: 'archer' });
  const ok = r.dmg === 0;
  rows.push(ok);
  console.log(`  ${ok ? '✅' : '❌'} ${nm.padEnd(8)} dt=${dt.toFixed(3)} · 벽 너머 피해 ${r.dmg} · 발사 ${r.shots}발`);
}
console.log('■ 벽이 없을 때 — 평소대로 맞아야 한다 (과차단 확인)');
for (const [nm, dt] of [FRAMES[0], FRAMES[2], FRAMES[4]]) {
  const r = await trial({ dt, wall: false, unit: 'archer' });
  const ok = r.dmg > 0;
  rows.push(ok);
  console.log(`  ${ok ? '✅' : '❌'} ${nm.padEnd(8)} dt=${dt.toFixed(3)} · 피해 ${r.dmg} · 발사 ${r.shots}발`);
}

await browser.close();
server.close();
const bad = rows.filter(x => !x).length + pageErrs.length;
if (pageErrs.length) console.log('\n페이지 오류:', pageErrs.slice(0, 3));
console.log(bad === 0 ? `\n✅ 전부 통과 — ${rows.length}/${rows.length}\n` : `\n❌ ${bad}건 실패\n`);
process.exit(bad ? 1 : 0);
