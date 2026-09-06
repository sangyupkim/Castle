// ─── 🏆 랭킹 시험 ─────────────────────────────────────────────────────────────
// 실행: node tools/rank-test.mjs   (저장소 어디서든)
//
// 랭킹은 배포된 뒤에야 처음 돌아 보는 코드였다. 그러면 잘못은 사람이 기록을
// 올리는 순간에야 드러나고, 그때는 이미 남의 표가 망가진 뒤다.
// 여기서 저장소를 대역으로 바꿔 끼우고 실제 함수를 그대로 부른다.
//
// 시험이 헛돌지 않게 하는 규칙 하나: **값들을 서로 맞춰서 만든다.**
// 처음엔 wallSec을 400으로 고정했더니 높은 층 기록이 개연성 검사에 먼저 걸려
// 저장소까지 가 보지도 못했다 — ⑦⑧이 통과한 것처럼 보였지만 아무것도 안 봤다.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FN   = join(HERE, '..', 'netlify', 'functions');

register(pathToFileURL(join(HERE, '_stub-hooks.mjs')));

const stub  = await import(pathToFileURL(join(HERE, '_blobs-stub.mjs')).href);
const score = (await import(pathToFileURL(join(FN, 'score.mjs')).href)).default;
const rank  = (await import(pathToFileURL(join(FN, 'rank.mjs')).href)).default;

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : fail++; console.log((cond ? '  ✅' : '  ❌') + ' ' + msg); };

const post = (body, ip = '1.2.3.4') => score(new Request('https://x/api/score', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
  body: JSON.stringify(body),
}), {});
const get = q => rank(new Request('https://x/api/rank?' + q));
const j   = async r => [r.status, await r.json()];

// 층수에 맞는 시간을 함께 만든다 — 한 층 60초, ×5 배속으로 돈 판
const rec = (o = {}) => {
  const tier    = o.tier ?? 30;
  const gameSec = o.gameSec ?? tier * 60;
  return {
    board: 'abyss', name: '테스터', tier, bossDown: false,
    gems: 120, kills: 900, version: 'v0.24.6',
    cid: '11111111-2222-3333-4444-555555555555',
    ...o,
    gameSec, wallSec: o.wallSec ?? gameSec / 5,
  };
};

let s, d;

console.log('\n① 등록하면 조회된다');
stub.reset();
[s, d] = await j(await post(rec()));
ok(s === 200 && d.ok && d.replaced && d.rank === 1, `등록 200 · 1위 (실제 ${s} / ${d.rank})`);
[s, d] = await j(await get('board=abyss'));
ok(d.ok && d.rows.length === 1 && d.rows[0].name === '테스터', `조회 1건 (실제 ${d.rows?.length})`);
ok(d.rows[0].cid === undefined, 'cid는 밖으로 안 나간다');
ok(typeof d.rows[0].at === 'number' && d.rows[0].at > 0, '시각은 서버가 찍는다');

console.log('\n② limit이 비어 있어도 기본값을 쓴다 (Number(null)은 0이다)');
[s, d] = await j(await get('board=abyss&limit='));
ok(d.ok && d.rows.length === 1, `빈 limit에도 안 잘림 (${d.rows?.length})`);

console.log('\n③ 한 기기에 갈래당 한 줄, 더 좋은 기록만 교체');
[s, d] = await j(await post(rec({ tier: 20 })));
ok(d.ok && d.replaced === false, '더 낮은 층은 그대로 둔다');
[s, d] = await j(await post(rec({ tier: 45, gems: 300 })));
ok(d.ok && d.replaced === true, '더 높은 층은 교체한다');
[s, d] = await j(await get('board=abyss'));
ok(d.total === 1 && d.rows[0].tier === 45, `한 줄 유지 · 45층 (실제 ${d.total}줄 ${d.rows[0]?.tier}층)`);

console.log('\n④ 내 순위');
const other = '99999999-8888-7777-6666-555555555555';
await post(rec({ cid: other, name: '다른사람', tier: 60 }), '5.6.7.8');
[s, d] = await j(await get('board=abyss&cid=' + other));
ok(d.myRank === 1, `내 순위 1위 (실제 ${d.myRank})`);
ok(d.rows.find(r => r.name === '다른사람')?.mine === true, '내 줄에 표시가 붙는다');
[s, d] = await j(await get('board=abyss'));
ok(d.myRank === null, 'cid가 없으면 myRank는 null');

console.log('\n⑤ 말이 안 되는 기록은 막는다');
for (const [label, body] of [
  ['층수 0',             rec({ tier: 0 })],
  ['층수 1000',          rec({ tier: 1000 })],
  ['이름 없음',           rec({ name: '  ' })],
  ['이름 13자',          rec({ name: '가나다라마바사아자차카타파' })],
  ['이름에 줄바꿈',       rec({ name: '가\n나' })],
  ['30층인데 10초',       rec({ tier: 30, gameSec: 10, wallSec: 10 })],
  ['실시간이 안 맞음',     rec({ wallSec: 1 })],
  ['버전 표기 이상',       rec({ version: 'abc' })],
  ['cid 이상',           rec({ cid: '짧음' })],
  ['모르는 갈래',         rec({ board: '없는표' })],
  ['보석 과다',           rec({ gems: 30 * 5000 + 50001 })],
]) {
  const [st, dd] = await j(await post(body, '9.9.9.' + Math.random()));
  ok(st === 400 && !dd.ok, `${label} → 400 · ${dd.err || ''}`);
}
[s, d] = await j(await get('board=없는표'));
ok(s === 400 && !d.ok, '조회도 모르는 갈래는 400');

console.log('\n⑥ 같은 IP는 시간당 20번까지');
stub.reset();
let blocked = 0;
for (let i = 0; i < 25; i++) {
  const [st] = await j(await post(rec({
    cid: `aaaaaaaa-bbbb-cccc-dddd-${String(i).padStart(12, '0')}`, tier: 10 + i,
  }), '7.7.7.7'));
  if (st === 429) blocked++;
}
ok(blocked === 5, `25번 중 5번 막힘 (실제 ${blocked})`);
[, d] = await j(await get('board=abyss&limit=100'));
ok(d.total === 20, `20건만 올라감 (실제 ${d.total})`);

console.log('\n⑦ 정렬 — 층 > 마왕 처치 > 보석 > 먼저 세운 쪽');
stub.reset();
const mk = (n, o) => post(rec({
  cid: `cccccccc-0000-0000-0000-${String(n).padStart(12, '0')}`, name: 'P' + n, ...o,
}), '8.8.8.' + n);
await mk(1, { tier: 50, gems: 100 });
await mk(2, { tier: 50, gems: 500 });
await mk(3, { tier: 50, gems: 100, bossDown: true });
await mk(4, { tier: 80, gems: 1 });
[, d] = await j(await get('board=abyss'));
ok(d.rows.map(r => r.name).join(',') === 'P4,P3,P2,P1',
   `P4,P3,P2,P1 (실제 ${d.rows.map(r => r.name).join(',')})`);

console.log('\n⑧ 저장소가 잠깐 죽어도 표를 날리지 않는다');
stub.reset();
await mk(1, { tier: 50 });
await mk(2, { tier: 40 });
stub.setFail(true, false);                       // 읽기만 실패시킨다
[s] = await j(await mk(9, { tier: 99 }));
stub.setFail(false, false);
const [, after] = await j(await get('board=abyss&limit=100'));
ok(s === 503, `읽기 실패는 503으로 알린다 (실제 ${s}) — 400이면 앞단에서 튕겨 이 시험이 헛돈 것이다`);
ok(after.total === 2, `기존 2건이 그대로 남는다 (실제 ${after.total})`);

console.log(`\n${fail === 0 ? '✅ 전부 통과' : '❌ ' + fail + '건 실패'} — ${pass}/${pass + fail}\n`);
process.exit(fail ? 1 : 0);
