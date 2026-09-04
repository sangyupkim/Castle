// @netlify/blobs 대역 — 메모리에 담는다.
//
// 진짜 Blobs를 붙이면 시험이 네트워크와 계정에 묶인다. 여기서 확인하려는 것은
// 저장소가 아니라 **우리 코드의 규칙**이다 — 무엇을 받아 주고, 무엇을 막고,
// 저장소가 흔들릴 때 어떻게 구는가. 실패를 마음대로 흉내 낼 수 있어야 하므로
// 대역이 필요하다(⑧번 시험이 그것 하나 때문에 있다).
const mem = new Map();
let FAIL_GET = false, FAIL_SET = false;

export function setFail(get, set) { FAIL_GET = !!get; FAIL_SET = !!set; }
export function reset() { mem.clear(); FAIL_GET = false; FAIL_SET = false; }

export function getStore() {
  return {
    async get(key, opts) {
      if (FAIL_GET) throw new Error('blobs get 실패');
      const v = mem.get(key);
      if (v === undefined) return null;              // 없는 키는 null (실패가 아니다)
      return (opts && opts.type === 'json') ? JSON.parse(v) : v;
    },
    async setJSON(key, val) {
      if (FAIL_SET) throw new Error('blobs set 실패');
      mem.set(key, JSON.stringify(val));
    },
  };
}
