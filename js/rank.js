'use strict';

// ─── 🏆 랭킹 ──────────────────────────────────────────────────────────────────
// 재미로 보는 순위표다. 브라우저에서 도는 게임이라 기록을 증명할 방법은 없고,
// 서버는 **말이 되는 값인지만** 본다. 그래서 이름도 '경쟁 랭킹'이 아니라 기록판이다.
//
// 날짜는 서버가 받은 순간을 찍는다. 클라이언트 시각을 쓰면 시간대가 섞이고
// 고치기도 쉬워서, 표에 적히는 날짜가 아무 뜻이 없어진다.

const RANK_API      = '/api/';
const RANK_CID_KEY  = 'df_rank_cid';
const RANK_NAME_KEY = 'df_rank_name';
const RANK_DONE_KEY = 'df_rank_done';   // 이미 올린 판 (중복 등록 방지)

// ── 갈래 ─────────────────────────────────────────────────────────────────────
// 서버의 BOARDS와 같아야 한다. 난이도가 다른 판을 한 표에 섞으면 순위가 뜻을 잃는다.
const RANK_BOARDS = [
  { id:'abyss',     label:'∞ 심연',   color:'#a78bfa' },
  { id:'unbounded', label:'♾️ 무한',   color:'#fbbf24' },
  ...Array.from({ length: 10 }, (_, i) => ({
    id:`nm${i + 1}`, label:`🌑 악몽 ${i + 1}`, color:'#f43f5e' })),
];
function rankBoardLabel(id) {
  const b = RANK_BOARDS.find(x => x.id === id);
  return b ? b.label : id;
}
// 이 판이 어느 표에 올라가는가
function rankBoardOf(r) {
  if (!r || !r.endless) return null;           // 훈련(캠페인)은 순위에 넣지 않는다
  if (r.unbounded)      return 'unbounded';
  if (r.nightmare > 0)  return `nm${r.nightmare}`;
  return 'abyss';
}

// ── 기기 식별자 ──────────────────────────────────────────────────────────────
// 계정이 없으므로 "한 기기에 갈래별 기록 하나"가 도배를 막는 유일한 수단이다.
// 지우면 새 사람이 되지만, 재미용 표에 그 이상은 과하다.
function rankClientId() {
  let v = null;
  try { v = localStorage.getItem(RANK_CID_KEY); } catch (e) {}
  if (v && /^[a-z0-9-]{8,64}$/i.test(v)) return v;
  v = (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem(RANK_CID_KEY, v); } catch (e) {}
  return v;
}
function rankName() {
  try { return localStorage.getItem(RANK_NAME_KEY) || ''; } catch (e) { return ''; }
}
function setRankName(v) {
  try { localStorage.setItem(RANK_NAME_KEY, String(v || '').slice(0, 12)); } catch (e) {}
}

// 같은 판을 두 번 올리지 않게 — 결과 화면에 머무는 동안 버튼을 여러 번 누를 수 있다
function rankRunKey(r) {
  return `${rankBoardOf(r)}|${r.endlessTier}|${r.gameSec}|${r.gems}`;
}
function rankAlreadySent(r) {
  try { return localStorage.getItem(RANK_DONE_KEY) === rankRunKey(r); } catch (e) { return false; }
}
function markRankSent(r) {
  try { localStorage.setItem(RANK_DONE_KEY, rankRunKey(r)); } catch (e) {}
}

// ── 화면이 읽는 상태 ─────────────────────────────────────────────────────────
const rankState = {
  board:  'abyss',
  rows:   [],
  total:  0,
  myRank: null,
  phase:  'idle',      // idle | loading | ready | error
  err:    '',
  fetchedAt: 0,
  submit: { phase:'idle', msg:'', color:'#94a3b8' },   // idle | sending | done | error
};

function rankSetSubmit(phase, msg, color) {
  rankState.submit = { phase, msg, color: color || '#94a3b8' };
}

// ── 조회 ─────────────────────────────────────────────────────────────────────
function fetchRank(board, force) {
  const id = board || rankState.board;
  if (rankState.phase === 'loading') return;
  // 30초 안에 같은 표를 다시 부르지 않는다 — 탭을 오갈 때마다 때릴 이유가 없다
  if (!force && rankState.phase === 'ready' && rankState.board === id
      && Date.now() - rankState.fetchedAt < 30000) return;

  rankState.board = id;
  rankState.phase = 'loading';
  rankState.err   = '';

  const url = `${RANK_API}rank?board=${encodeURIComponent(id)}&limit=50&cid=${encodeURIComponent(rankClientId())}`;
  fetch(url, { headers: { accept: 'application/json' } })
    .then(res => res.json())
    .then(d => {
      if (rankState.board !== id) return;      // 그 사이 다른 표로 옮겼다
      if (!d || !d.ok) throw new Error((d && d.err) || '순위표를 읽을 수 없습니다');
      rankState.rows      = Array.isArray(d.rows) ? d.rows : [];
      rankState.total     = d.total || 0;
      rankState.myRank    = d.myRank || null;
      rankState.phase     = 'ready';
      rankState.fetchedAt = Date.now();
    })
    .catch(e => {
      if (rankState.board !== id) return;
      rankState.phase = 'error';
      rankState.err   = (e && e.message) || '연결할 수 없습니다';
    });
}

// ── 등록 ─────────────────────────────────────────────────────────────────────
function submitRank(r, name) {
  const board = rankBoardOf(r);
  if (!board) { rankSetSubmit('error', '훈련 기록은 순위에 올리지 않습니다', '#ef4444'); return; }

  const nm = String(name || '').trim().slice(0, 12);
  if (!nm) { rankSetSubmit('error', '이름을 입력하세요', '#ef4444'); return; }
  setRankName(nm);

  rankSetSubmit('sending', '올리는 중…', '#94a3b8');

  fetch(`${RANK_API}score`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      board,
      name:     nm,
      tier:     r.endlessTier,
      bossDown: !!r.bossDown,
      gems:     r.gems || 0,
      kills:    r.kills || 0,
      gameSec:  r.gameSec || 0,
      wallSec:  r.wallSec || 0,
      version:  (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : 'v0.0.0',
      cid:      rankClientId(),
    }),
  })
    .then(res => res.json())
    .then(d => {
      if (!d || !d.ok) throw new Error((d && d.err) || '등록에 실패했습니다');
      markRankSent(r);
      rankSetSubmit('done',
        d.replaced ? `🏆 ${d.rank}위로 올랐습니다` : `이미 ${d.rank}위 기록이 있습니다`,
        d.replaced ? '#22c55e' : '#94a3b8');
      // 방금 올린 표를 바로 다시 읽어 온다
      rankState.board = board;
      fetchRank(board, true);
    })
    .catch(e => rankSetSubmit('error', (e && e.message) || '연결할 수 없습니다', '#ef4444'));
}

// ── 날짜 ─────────────────────────────────────────────────────────────────────
// 서버가 찍은 시각을 한국 시간 기준 날짜로. 오늘·어제는 글자로 적는다.
function rankDateText(ms) {
  if (!ms) return '';
  const opt = { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' };
  const d   = new Date(ms);
  const fmt = s => new Intl.DateTimeFormat('ko-KR', opt).format(s);
  const today = fmt(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const cur = fmt(d);
  if (cur === today)   return '오늘';
  if (cur === fmt(y))  return '어제';
  // 2026. 08. 31. → 26.08.31
  const m = cur.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})/);
  return m ? `${m[1].slice(2)}.${m[2]}.${m[3]}` : cur;
}
