'use strict';

// ─── 절차적 사운드 (외부 에셋 없이 WebAudio로 합성) ──────────────────────────
const SFX = (() => {
  let actx = null, master = null;
  let muted = localStorage.getItem('df_muted') === '1';

  function ensure() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.3;
      master.connect(actx.destination);
    } catch (e) { return false; }
    return true;
  }

  function tone(f0, f1, dur, type, vol, delay) {
    if (muted || !ensure()) return;
    const t0 = actx.currentTime + (delay || 0);
    const osc = actx.createOscillator(), g = actx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.25), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (muted || !ensure()) return;
    const t0 = actx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(actx.sampleRate * dur));
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = actx.createBufferSource(); src.buffer = buf;
    const flt = actx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = freq || 1200;
    const g = actx.createGain(); g.gain.value = vol || 0.2;
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0);
  }

  return {
    unlock()     { ensure(); },
    isMuted()    { return muted; },
    // BGM이 같은 컨텍스트를 쓰도록 연다 — 두 개를 만들면 모바일에서 하나가 잠긴다
    ctx()        { return ensure() ? actx : null; },
    dest()       { return ensure() ? actx.destination : null; },
    toggleMute() {
      muted = !muted;
      localStorage.setItem('df_muted', muted ? '1' : '0');
      if (!muted) { ensure(); tone(880, 1320, 0.08, 'triangle', 0.2); }
      return muted;
    },
    click()    { tone(660, 880, 0.06, 'triangle', 0.18); },
    build()    { tone(300, 620, 0.12, 'square', 0.2); noise(0.08, 0.12, 900); },
    sell()     { tone(620, 260, 0.14, 'triangle', 0.2); },
    upgrade()  { tone(520, 780, 0.09, 'square', 0.2); tone(780, 1180, 0.11, 'square', 0.18, 0.08); },
    hire()     { tone(440, 660, 0.10, 'triangle', 0.2); },
    denied()   { tone(220, 130, 0.16, 'sawtooth', 0.18); },
    shoot()    { tone(1500, 700, 0.045, 'square', 0.05); },
    cannon()   { noise(0.22, 0.26, 500); tone(150, 60, 0.24, 'sawtooth', 0.15); },
    hit()      { noise(0.06, 0.12, 1800); },
    kill()     { tone(520, 180, 0.14, 'square', 0.15); noise(0.1, 0.12, 800); },
    skill()    { tone(700, 1400, 0.14, 'triangle', 0.2); },
    heal()     { tone(660, 990, 0.16, 'sine', 0.22); },
    baseHit()  { tone(200, 80, 0.28, 'sawtooth', 0.3); noise(0.2, 0.22, 400); },
    levelUp()  { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.13, 'triangle', 0.2, i * 0.075)); },
    win()      { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.22, i * 0.1)); },
    lose()     { [440, 349, 277, 196].forEach((f, i) => tone(f, f * 0.9, 0.28, 'sawtooth', 0.22, i * 0.16)); },
    advance()  { tone(392, 587, 0.18, 'triangle', 0.18); },
    waveStart(){ tone(330, 660, 0.2, 'square', 0.24); tone(660, 990, 0.22, 'square', 0.2, 0.16); }
  };
})();


// ─── 🎵 BGM (외부 음원 없이 WebAudio로 합성) ─────────────────────────────────
// 음원 파일을 받아 붙이면 용량이 몇 MB씩 늘고, 라이선스도 따로 챙겨야 한다.
// 이 게임은 이미 효과음을 전부 합성해서 쓰고 있으니 배경음도 같은 방식으로 만든다.
//
// 구조는 흔한 룩어헤드 스케줄러다. 25ms마다 깨어나 앞으로 0.2초 안에 울릴 음만
// 미리 예약한다 — setInterval로 음을 직접 울리면 탭이 뒤로 갔을 때 박자가 무너진다.
//
// 곡은 셋이다. 캠프는 느리게, 전투는 몰아치게, 심층은 어둡게.
const BGM = (() => {
  let bus = null, timer = null;
  let step = 0, nextAt = 0, cur = null, curName = null;
  let on = localStorage.getItem('df_bgm') !== '0';

  const STEPS = 16;                 // 한 마디 16스텝 (16분음표)
  const LOOKAHEAD = 0.20;           // 초 — 이만큼 앞을 미리 예약한다
  const TICK = 25;                  // ms

  // 음이름 → 주파수. A4=440 기준 반음 단위.
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  // A 마이너 계열로 통일한다 — 곡을 바꿔도 서로 부딪히지 않는다
  const Am = [57, 60, 64], F = [53, 57, 60], C = [48, 52, 55], G = [55, 59, 62];
  const Dm = [50, 53, 57], E7 = [52, 56, 59];

  const TRACKS = {
    camp: {
      bpm: 84, vol: 0.085,
      chords: [Am, F, C, G],
      bass:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      arp:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      kick:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      hat:   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      arpOct: 12, lead: 'triangle', bassType: 'sine', arpVol: 0.5, bassVol: 0.9
    },
    battle: {
      bpm: 132, vol: 0.10,
      chords: [Am, Am, F, G],
      bass:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      arp:   [1,0,1,1, 0,1,0,1, 1,0,1,0, 0,1,1,0],
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
      hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      arpOct: 12, lead: 'square', bassType: 'sawtooth', arpVol: 0.34, bassVol: 0.75
    },
    deep: {
      bpm: 100, vol: 0.095,
      chords: [Am, Dm, E7, Am],
      bass:  [1,0,0,0, 1,0,0,0, 1,0,0,1, 0,0,0,0],
      arp:   [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hat:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,1],
      arpOct: 0, lead: 'triangle', bassType: 'sine', arpVol: 0.42, bassVol: 0.95
    }
  };

  function ensureBus() {
    const ac = SFX.ctx();
    if (!ac) return null;
    if (!bus) {
      bus = ac.createGain();
      bus.gain.value = 0;
      // 살짝 뭉근하게 — 사각파 그대로면 귀가 아프다
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      bus.connect(lp); lp.connect(ac.destination);
    }
    return ac;
  }

  function blip(ac, freq, at, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(bus);
    o.start(at); o.stop(at + dur + 0.02);
  }
  function perc(ac, at, low) {
    const len = Math.floor(ac.sampleRate * (low ? 0.11 : 0.035));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, low ? 3 : 1.5);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = low ? 'lowpass' : 'highpass'; f.frequency.value = low ? 180 : 6500;
    const g = ac.createGain(); g.gain.value = low ? 0.9 : 0.16;
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(at);
  }

  function schedule() {
    const ac = ensureBus();
    if (!ac || !cur) return;
    const spb = 60 / cur.bpm / 4;             // 16분음표 한 칸의 길이
    while (nextAt < ac.currentTime + LOOKAHEAD) {
      const bar = Math.floor(step / STEPS) % cur.chords.length;
      const ch  = cur.chords[bar];
      const i   = step % STEPS;
      if (cur.bass[i]) blip(ac, N(ch[0] - 12), nextAt, spb*3.2, cur.bassType, cur.bassVol);
      if (cur.arp[i])  blip(ac, N(ch[(step >> 1) % ch.length] + cur.arpOct), nextAt, spb*1.6, cur.lead, cur.arpVol);
      if (cur.kick[i]) perc(ac, nextAt, true);
      if (cur.hat[i])  perc(ac, nextAt, false);
      nextAt += spb;
      step++;
    }
  }

  function fade(to, sec) {
    const ac = SFX.ctx(); if (!ac || !bus) return;
    const now = ac.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.linearRampToValueAtTime(to, now + sec);
  }

  return {
    isOn() { return on; },
    // 지금 어울리는 곡으로 갈아탄다. 같은 곡이면 아무 일도 하지 않는다.
    play(name) {
      if (!on || SFX.isMuted()) return;
      if (!TRACKS[name]) return;
      const ac = ensureBus(); if (!ac) return;
      if (curName === name && timer) return;
      curName = name; cur = TRACKS[name];
      step = 0; nextAt = ac.currentTime + 0.05;
      if (!timer) timer = setInterval(schedule, TICK);
      fade(cur.vol, 1.2);
    },
    stop(sec) {
      fade(0, sec === undefined ? 0.6 : sec);
      curName = null;
      setTimeout(() => { if (!curName && timer) { clearInterval(timer); timer = null; cur = null; } },
                 ((sec === undefined ? 0.6 : sec) * 1000) + 80);
    },
    toggle() {
      on = !on;
      localStorage.setItem('df_bgm', on ? '1' : '0');
      if (!on) this.stop(0.3);
      return on;
    },
    // 화면과 상황을 보고 알아서 고른다 — 부르는 쪽이 곡 이름을 몰라도 되게
    sync(gs, wm) {
      if (!on || SFX.isMuted()) { if (curName) this.stop(0.3); return; }
      let want = 'camp';
      if (gs && gs.inRun && (gs.page === 'battle' || gs.page === 'town')) {
        const deep = gs.mode === 'endless' && (gs.wave + 1) >= (typeof DEEP_FLOOR_FROM === 'number' ? DEEP_FLOOR_FROM : 40);
        want = (wm && wm.phase === 'active') ? (deep ? 'deep' : 'battle') : 'camp';
      }
      if (want !== curName) this.play(want);
    }
  };
})();
