'use strict';

// ─── 🔄 최신판 확인 ───────────────────────────────────────────────────────────
// 배포는 올라갔는데 화면은 옛 판이 그대로인 일이 반복됐다. 실제로 게임이
// v0.26.0까지 간 동안 켜 보면 v0.25.1이 떴다. 길이 여럿이라 하나만 막아서는
// 안 된다 — 브라우저 HTTP 캐시, 서비스 워커 캐시, 그리고 **워커 자체가
// 안 바뀌는 것**(sw.js 바이트가 판마다 똑같으면 브라우저는 새 워커로 안 본다).
//
// 그래서 추측을 그만두고 **직접 물어본다.** 서버의 js/version.js를 캐시를
// 완전히 비켜서 받아 와, 지금 돌고 있는 GAME_VERSION과 글자로 맞춰 본다.
//   같으면  → 최신이다. 아무것도 안 한다.
//   다르면  → 워커를 등록 해제하고 캐시를 전부 지우고 한 번 갈아탄다.
//
// 두 가지를 조심해야 한다.
//   1) **무한 새로고침.** 서버가 이상해서 영영 안 맞는 경우가 있다. 한 버전에
//      대해 한 번만 시도하고, 그러고도 안 맞으면 콘솔에 남기고 멈춘다.
//   2) **판 도중에 끊는 것.** 세이브가 남아도 판을 빼앗긴 기분이다.
//      새 배포는 급할 것이 없으니 판 밖으로 나오는 순간에 간다.
//
// 한계는 분명히 해 둔다 — 이건 **손님 쪽이 낡았을 때만** 낫게 한다.
// 서버가 옛 파일을 주고 있으면(배포 실패 · 잘못된 브랜치) 여기서 할 수 있는
// 일은 없다. 그때는 두 버전이 '같다'고 나오고, 그게 맞는 대답이다.

(function () {
  if (typeof window === 'undefined') return;
  // file:// (데스크톱 Electron)에는 물어볼 서버가 없다. 비켜선다.
  if (!/^https?:$/.test(location.protocol)) return;

  var VER_URL = 'js/version.js';
  var TRY_KEY = 'df_update_try';        // 한 버전에 한 번만 — 새로고침 고리 방지
  var PERIOD  = 10 * 60 * 1000;         // 탭을 오래 열어 두는 사람을 위해

  var here = (typeof GAME_VERSION === 'string') ? GAME_VERSION : null;

  function parseVer(text) {
    var m = /GAME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(text || '');
    return m ? m[1] : null;
  }

  // 캐시를 세 겹으로 비켜선다 — no-store, 매번 다른 주소, 그리고 sw.js가
  // `_nocache`가 붙은 요청은 아예 손대지 않는다(캐시에 쌓이기만 하므로).
  function fetchServerVersion() {
    var url = VER_URL + '?_nocache=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.text() : null; })
      .then(parseVer)
      .catch(function () { return null; });
  }

  function purge() {
    var jobs = [];
    try {
      if ('serviceWorker' in navigator) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister(); }));
        }).catch(function () {}));
      }
    } catch (e) {}
    try {
      if (window.caches) {
        jobs.push(caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k); }));
        }).catch(function () {}));
      }
    } catch (e) {}
    return Promise.all(jobs).catch(function () {});
  }

  // 판 도중인지. gs가 아직 없을 수도 있다(부팅 직후) — 그때는 판 밖이다.
  function idle() {
    try { return !(window.gs && window.gs.inRun); } catch (e) { return true; }
  }

  // 주소에 버전을 붙여 문서 자체를 새로 받게 한다. 그냥 reload()는
  // 브라우저가 디스크 캐시의 index.html을 그대로 쓸 수 있다.
  function jumpTo(v) {
    purge().then(function () {
      var u;
      try {
        u = new URL(location.href);
        u.searchParams.set('_v', v);
        location.replace(u.toString());
      } catch (e) {
        location.reload();
      }
    });
  }

  var busy = false;
  function check() {
    if (busy) return Promise.resolve();
    busy = true;
    return fetchServerVersion().then(function (there) {
      busy = false;
      // 못 물어봤다(오프라인 등)면 아무 판단도 하지 않는다.
      if (!there || !here) return;
      if (there === here) {
        try { sessionStorage.removeItem(TRY_KEY); } catch (e) {}
        return;
      }
      var tried = null;
      try { tried = sessionStorage.getItem(TRY_KEY); } catch (e) {}
      if (tried === there) {
        // 이미 한 번 다 비우고 갈아탔는데도 그대로다 — 손님 쪽 문제가 아니다.
        console.warn('[듀얼 프론티어] 서버는 ' + there + ', 받은 것은 ' + here +
                     ' — 캐시를 비워도 그대로입니다. 배포 쪽을 확인해야 합니다.');
        return;
      }
      try { sessionStorage.setItem(TRY_KEY, there); } catch (e) {}
      console.info('[듀얼 프론티어] 새 판 ' + there + ' 발견 — ' + here + '에서 갈아탑니다');
      if (idle()) { jumpTo(there); return; }
      var t = setInterval(function () {
        if (idle()) { clearInterval(t); jumpTo(there); }
      }, 2000);
    }).catch(function () { busy = false; });
  }

  // 갈아탄 뒤 남는 ?_v=는 지운다 — 주소를 더럽히고, 공유했을 때 옛 버전을
  // 박아 둔 것처럼 보인다.
  try {
    var u0 = new URL(location.href);
    if (u0.searchParams.has('_v')) {
      u0.searchParams.delete('_v');
      history.replaceState(null, '', u0.pathname + (u0.search || '') + (u0.hash || ''));
    }
  } catch (e) {}

  // 손으로도 부를 수 있게 열어 둔다 — 콘솔에서 dfForceUpdate()
  window.dfForceUpdate = function () {
    try { sessionStorage.removeItem(TRY_KEY); } catch (e) {}
    return check();
  };
  // ?reset=1 — 무엇이 꼬였든 통째로 비우고 다시 받는 비상구
  try {
    if (new URL(location.href).searchParams.has('reset')) {
      purge().then(function () { location.replace(location.pathname); });
      return;
    }
  } catch (e) {}

  check();
  setInterval(check, PERIOD);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check();
  });
})();
