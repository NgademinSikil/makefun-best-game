// Synthesised sound effects, no audio files: a tiny WebAudio synth (oscillator blips and
// filtered noise) so the game stays fully offline. Created lazily on the first gesture,
// because browsers block audio before one; M or the mute button silences it.
export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    const t0 = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (muted || !ensure()) return;
    const t0 = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },
    shoot() { tone(880, 0.09, 'square', 0.10, 220); },
    explosion(big) { noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1400); tone(big ? 120 : 160, 0.3, 'sine', 0.25, 40); },
    pickup(combo) { tone(520 + Math.min(combo, 8) * 60, 0.12, 'sine', 0.16, 1040 + Math.min(combo, 8) * 60); },
    powerup() { tone(440, 0.12, 'triangle', 0.2, 660); setTimeout(() => tone(660, 0.14, 'triangle', 0.2, 990), 90); },
    hit() { noise(0.35, 0.45, 700); tone(220, 0.35, 'sawtooth', 0.22, 55); },
    levelup() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.2), i * 90)); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110)); },
    gameover() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'sawtooth', 0.16), i * 160)); },
  };
}
