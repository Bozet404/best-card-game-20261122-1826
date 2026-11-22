// Sounds for Ember Pact: tiny WebAudio oscillator blips, written in code —
// no audio files, no network. Everything is wrapped in try/catch so a
// browser without audio (or a headless test run) never breaks the game.

let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = !!value;
}

export function isMuted() {
  return muted;
}

function ensureCtx() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq, dur = 0.09, type = 'sine', vol = 0.07, when = 0) {
  if (muted) return;
  try {
    const ac = ensureCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime + when;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    // Silence is always an acceptable fallback.
  }
}

export function sfx(name) {
  if (muted) return;
  if (name === 'select') blip(660, 0.05, 'sine', 0.04);
  else if (name === 'play') { blip(392, 0.08, 'triangle', 0.07); blip(523, 0.1, 'triangle', 0.06, 0.06); }
  else if (name === 'spell') { blip(784, 0.1, 'sine', 0.06); blip(1046, 0.14, 'sine', 0.05, 0.08); }
  else if (name === 'attack') { blip(180, 0.12, 'sawtooth', 0.06); blip(120, 0.14, 'sawtooth', 0.05, 0.05); }
  else if (name === 'turn') blip(440, 0.07, 'triangle', 0.05);
  else if (name === 'error') blip(140, 0.15, 'square', 0.04);
  else if (name === 'win') { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'triangle', 0.07, i * 0.11)); }
  else if (name === 'lose') { [392, 330, 262, 196].forEach((f, i) => blip(f, 0.18, 'triangle', 0.06, i * 0.13)); }
}
