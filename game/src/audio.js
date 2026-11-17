// Sound, synthesized live with WebAudio: no audio files, no network, just oscillators and
// noise. The engine hums, the sirens wail, shots crack, cash rings. Everything starts on the
// first gesture (browsers refuse sound before one) and a mute toggle silences it all.

/** A fresh audio kit: silent until the player first presses a key or clicks. */
export function createAudio() {
  return {
    context: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: null,
    muted: false,
    started: false,
    step: 0,
  };
}

/** Start the audio context on a user gesture; safe to call more than once. */
export function startAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;
    audio.context = new Ctx();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.context.destination);
    audio.started = true;
    startEngine(audio);
    startMusic(audio);
  } catch {
    audio.started = false;
  }
}

/** The engine: a low sawtooth whose pitch follows the car's speed. */
function startEngine(audio) {
  const ctx = audio.context;
  audio.engineOsc = ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 55;
  audio.engineGain = ctx.createGain();
  audio.engineGain.gain.value = 0.0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  audio.engineOsc.connect(filter);
  filter.connect(audio.engineGain);
  audio.engineGain.connect(audio.master);
  audio.engineOsc.start();
}

/** Set the engine note from the car's speed (0 when on foot or parked). */
export function setEngine(audio, speed) {
  if (!audio.started || audio.engineOsc === null) return;
  const abs = Math.abs(speed);
  audio.engineOsc.frequency.value = 52 + abs * 0.32;
  audio.engineGain.gain.value = abs > 8 ? 0.05 : 0.0;
}

/** A short burst of filtered noise: a gunshot, a crash, a pickup blip. */
function blip(audio, frequency, duration, type, volume) {
  if (!audio.started || audio.muted) return;
  try {
    const ctx = audio.context;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Sound is decoration: never let it break the game.
  }
}

/** A gunshot: a sharp square crack. */
export function playShot(audio) {
  blip(audio, 180, 0.12, 'square', 0.22);
}

/** Cash in: two bright notes, high then higher. */
export function playCash(audio) {
  blip(audio, 880, 0.1, 'sine', 0.2);
  setTimeout(() => blip(audio, 1320, 0.16, 'sine', 0.2), 90);
}

/** A pickup: one warm note. */
export function playPickup(audio) {
  blip(audio, 660, 0.12, 'triangle', 0.18);
}

/** A crash: a low thud. */
export function playCrash(audio) {
  blip(audio, 70, 0.25, 'sawtooth', 0.3);
}

/** The siren, on or off with the wanted level. */
export function setSiren(audio, on) {
  if (!audio.started) return;
  if (on && audio.sirenOsc === null) {
    const ctx = audio.context;
    audio.sirenOsc = ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = ctx.createGain();
    audio.sirenGain.gain.value = audio.muted ? 0 : 0.045;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(audio.sirenOsc.frequency);
    lfo.start();
    audio.sirenLfo = lfo;
  } else if (!on && audio.sirenOsc !== null) {
    try {
      audio.sirenOsc.stop();
      audio.sirenLfo.stop();
    } catch {
      // Already stopped.
    }
    audio.sirenOsc = null;
    audio.sirenGain = null;
    audio.sirenLfo = null;
  }
}

/** A lazy bassline with a hat tick: Solmar's radio, on a timer. */
function startMusic(audio) {
  const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
  audio.musicTimer = setInterval(() => {
    if (audio.muted || !audio.started) return;
    const note = bass[audio.step % bass.length];
    audio.step += 1;
    if (note > 0) blip(audio, note, 0.5, 'triangle', 0.1);
    if (audio.step % 2 === 0) blip(audio, 5200, 0.03, 'sine', 0.03);
  }, 300);
}

/** Mute or unmute everything. */
export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master !== null) audio.master.gain.value = muted ? 0 : 0.5;
  if (audio.sirenGain !== null) audio.sirenGain.gain.value = muted ? 0 : 0.045;
}
