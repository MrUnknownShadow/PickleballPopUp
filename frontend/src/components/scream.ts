// The sponsor's scream clip (public/scream.mp3), played through one Web Audio context.
// Web Audio, not new Audio().play(): a remote scream arrives without a tap, and iPad Safari blocks .play() then,
// but an AudioContext that an earlier tap unlocked keeps playing.
let ctx: AudioContext | null = null;
let clip: Promise<AudioBuffer | null> | null = null;
const getCtx = () => (ctx ??= new AudioContext());

const loadClip = () => (clip ??= fetch('/scream.mp3')
  .then(r => r.arrayBuffer())
  .then(b => getCtx().decodeAudioData(b))
  .catch(() => null));

// Browsers keep audio off until the first tap on the page; call from any tap to unlock.
export const unlockAudio = () => { void getCtx().resume(); void loadClip(); };
export const audioLocked = () => getCtx().state !== 'running';

export async function playScream() {
  const c = getCtx();
  void c.resume();
  const buffer = await loadClip();
  if (!buffer) return synthScream(c); // clip did not load (offline, old cache): still make noise
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.connect(c.destination);
  src.start();
}

function synthScream(c: AudioContext) {
  const t = c.currentTime;
  const gain = c.createGain();
  gain.connect(c.destination);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.8, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  for (const detune of [0, 7]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = detune;
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.4);
    o.frequency.linearRampToValueAtTime(1400, t + 2.2);
    o.connect(gain);
    o.start(t);
    o.stop(t + 2.3);
  }
}
