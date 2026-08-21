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
