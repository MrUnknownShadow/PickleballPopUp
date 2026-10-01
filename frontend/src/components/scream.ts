// Synthesized scream (no asset). ponytail: swap for new Audio('/scream.mp3') if a real clip is supplied.
let ctx: AudioContext | null = null;
const getCtx = () => (ctx ??= new AudioContext());

// Browsers block audio until a user gesture; call from any tap to unlock.
export const unlockAudio = () => { void getCtx().resume(); };

export function playScream() {
  const c = getCtx();
  void c.resume();
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
