// ─── 심연·악몽 결승선 회귀 검사 ───────────────────────────────────────────────
// 실행: node tools/abyss-check.mjs
//
// 테스터 보고: "악몽8에서 100층 보스를 깼는데 클리어가 안 되고 101층부터 진행된다."
// 원인은 결승선을 **마왕을 잡았는가**로만 봤다는 것이다. 못 잡으면 그냥 다음 층으로
// 넘어가 심연에 끝이 사라졌다(실측 126층).
//
// 눈으로 100층까지 내려가 볼 수는 없으므로 판을 그 자리에 세워 놓고 돌린다.
// 갈래(심연·악몽 1~10·무한) × 마왕 위치(상단·하단) × 결말(잡음·놓침)을 전부 센다.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8918;
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

// 층을 통째로 굴리는 대신 **결승선 판정만** 부른다.
// 60초짜리 웨이브를 100층까지 시뮬레이션하면 검사 한 번에 몇 분이 걸린다 —
// 여기서 깨진 것은 전투가 아니라 `endWave`/`updateIntermission`의 판단이다.
const decide = (opts) => pg.evaluate(({ mode, nightmare, tier, killed }) => {
  gs.stats.runs = 5; gs.nightmareOpen = NIGHTMARE_MAX + 1;
  startRun(mode, nightmare);
  const meta = { mode: gs.mode, unbounded: gs.unbounded, nightmare: gs.nightmare,
                 pacts: forcedPacts().length, gemMult: +pactGemMult().toFixed(2) };
  gs.wave = tier - 1;
  wm.init(gs.wave);
  gs.bossDefeated = !!killed;
  gs.battle.phase = 'fighting';        // 완주한 셈 친다
  wm.endWave(gs);
  // 다음 층이 있으면 강화 카드가 먼저 뜬다 — 플레이어가 한 장 고른 셈 친다
  const sawPick = wm.phase === 'upgradePick';
  if (sawPick) wm.confirmPick(gs);
  // 인터미션을 끝까지 돌린다 — 여기서 다음 층으로 갈지 판이 끝날지가 갈린다
  wm.intermissionTimer = 0;
  wm.updateIntermission(gs, 1);
  return { ...meta, tier: endlessTier(gs.wave), phase: wm.phase,
           cleared: !!gs.stageCleared, over: !!gs.gameOver, pick: sawPick,
           open: nightmareOpenLevel() };
}, opts);

const rows = [];
const F = 100;
const add = (name, ok, got) => rows.push({ name, ok, got });

// ① 마왕을 잡으면 100층에서 클리어 — 심연·악몽 어느 단계든
for (const nm of [0, 1, 5, 8, 10]) {
  const r = await decide({ mode:'endless', nightmare:nm, tier:F, killed:true });
  add(`${nm ? '악몽 '+nm : '심연'} · 100층 마왕 처치 → 클리어`,
      r.cleared && !r.over && !r.pick && r.tier === F,
      `${r.tier}층 clear=${r.cleared} over=${r.over} 강화카드=${r.pick}`);
}
// ② 못 잡으면 101층으로 넘어가지 않고 그 자리에서 끝난다 (테스터 보고)
for (const nm of [0, 8, 10]) {
  const r = await decide({ mode:'endless', nightmare:nm, tier:F, killed:false });
  add(`${nm ? '악몽 '+nm : '심연'} · 100층 마왕 놓침 → 판 종료`,
      r.over && !r.cleared && !r.pick && r.tier === F,
      `${r.tier}층 clear=${r.cleared} over=${r.over} 강화카드=${r.pick}`);
}
// ③ 100층 전에는 평소대로 다음 층으로 간다
for (const t of [1, 50, 99]) {
  const r = await decide({ mode:'endless', nightmare:8, tier:t, killed:false });
  add(`악몽 8 · ${t}층 → ${t+1}층으로`, r.tier === t + 1 && !r.over && !r.cleared,
      `${r.tier}층 over=${r.over}`);
}
// ④ ♾️ 무한은 결승선이 없다 — 100층도 그냥 지나간다
for (const t of [99, F, 130]) {
  const r = await decide({ mode:'unbounded', nightmare:0, tier:t, killed:false });
  add(`♾️ 무한 · ${t}층 → ${t+1}층으로`, r.unbounded && r.tier === t + 1 && !r.over && !r.cleared,
      `${r.tier}층 unbounded=${r.unbounded} over=${r.over}`);
}
// ⑤ 훈련은 TRAINING_WAVES에서 끝난다
{
  const last = await pg.evaluate(() => TRAINING_WAVES);
  const r = await decide({ mode:'campaign', nightmare:0, tier:last, killed:false });
  add(`훈련 ${last}웨이브 → 완주`, r.cleared && !r.over, `clear=${r.cleared} over=${r.over}`);
}
// ⑥ 악몽 N단계 = 강제 서약 N개, 단계가 오를수록 보석 배율이 오른다
{
  const seen = await pg.evaluate(() => {
    const out = [];
    gs.stats.runs = 5; gs.nightmareOpen = NIGHTMARE_MAX + 1;
    for (let nm = 0; nm <= NIGHTMARE_MAX; nm++) {
      startRun('endless', nm);
      out.push({ nm, pacts: forcedPacts().length, mult: +pactGemMult().toFixed(2), lv: gs.nightmare });
    }
    return out;
  });
  add('악몽 N단계 = 강제 서약 N개',
      seen.every(s => s.lv === s.nm && s.pacts === s.nm),
      seen.map(s => `${s.nm}:${s.pacts}`).join(' '));
  add('단계가 오를수록 보석 배율 상승',
      seen.every((s, i) => i === 0 || s.mult > seen[i-1].mult),
      seen.map(s => `×${s.mult}`).join(' '));
}
// ⑦ 한 갈래를 깨면 다음 문이 열리고, 10을 깨면 ♾️ 무한이 열린다
{
  const r = await pg.evaluate(() => {
    const out = [];
    const savedNm = gs.nightmare, savedUnb = gs.unbounded;
    for (let nm = 0; nm <= NIGHTMARE_MAX; nm++) {
      gs.nightmareOpen = nm;
      gs.nightmare = nm; gs.unbounded = false;
      clearAbyssRun(gs);                      // 진짜 gs로 부른다 — stats를 읽는다
      out.push([nm, nightmareOpenLevel()]);
    }
    gs.nightmare = savedNm; gs.unbounded = savedUnb;
    gs.nightmareOpen = NIGHTMARE_MAX + 1;
    return { steps: out, unbounded: unboundedUnlocked() };
  });
  add('악몽 N을 깨면 N+1이 열린다', r.steps.every(([nm, a]) => a === nm + 1),
      r.steps.map(([nm, a]) => `${nm}→${a}`).join(' '));
  add('악몽 10을 깨면 ♾️ 무한 개방', r.unbounded, String(r.unbounded));
}

// ⑧ 🏺 유물은 마왕만 떨군다 — 중간보스는 보석으로 준다
{
  const r = await pg.evaluate(() => {
    gs.stats.runs = 5; gs.nightmareOpen = NIGHTMARE_MAX + 1;
    startRun('endless', 0);
    const out = {};
    for (const kind of ['mid', 'lord']) {
      relicState(gs).owned.length = 0;
      const gem0 = gs.soulStones || 0;
      const b = bossState(gs);
      b.kind = kind; b.wasRandom = false; b.reward = null;
      grantBossReward(gs);
      out[kind] = { relics: relicState(gs).owned.length, gems: (gs.soulStones || 0) - gem0 };
    }
    relicState(gs).owned.length = 0;
    return out;
  });
  add('중간보스는 유물을 안 준다', r.mid.relics === 0, `유물 ${r.mid.relics}개 · 💎${r.mid.gems}`);
  add('중간보스도 보석은 준다',   r.mid.gems > 0,      `💎${r.mid.gems}`);
  add('마왕은 유물을 준다',       r.lord.relics === 1, `유물 ${r.lord.relics}개 · 💎${r.lord.gems}`);
}

await browser.close();
server.close();

console.log('\n심연·악몽 결승선 검사\n');
let bad = 0;
for (const r of rows) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(30)} ${r.got}`);
}
if (pageErrs.length) { console.log('\n페이지 오류:', pageErrs.slice(0, 3)); bad += pageErrs.length; }
console.log(bad === 0 ? `\n✅ 전부 통과 — ${rows.length}/${rows.length}\n` : `\n❌ ${bad}건 실패\n`);
process.exit(bad ? 1 : 0);
