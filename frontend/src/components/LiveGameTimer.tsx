import { useState, useEffect, useRef } from 'react';
import type { SubGame } from '../types';
import { playScream, unlockAudio, audioLocked } from './scream';


function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

interface LiveGameTimerProps {
  subGame: SubGame;
  eventId: string;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  onEndGame?: () => void; // only site admins record scores; without it players see a waiting note
  isAdmin?: boolean;
}

export default function LiveGameTimer({ subGame, eventId, apiFetch, onEndGame, isAdmin }: LiveGameTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [locked, setLocked] = useState(audioLocked);
  const seen = useRef<number | null>(null); // last remote-scream count this screen has handled

  // Remote scream: every screen on this event polls the count and screams when it changes.
  // The first answer is only a baseline, so opening the page never screams.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const { count } = await apiFetch<{ count: number }>(`/api/games/${eventId}/scream`);
        if (stop) return;
        if (seen.current !== null && count !== seen.current) void playScream();
        seen.current = count;
      } catch { /* offline for a moment: try again next tick */ }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [eventId]);

  const scream = async () => {
    void playScream(); // the screen that was tapped plays it straight away
    try { seen.current = (await apiFetch<{ count: number }>(`/api/games/${eventId}/scream`, { method: 'POST' })).count; }
    catch { /* the other screens just miss this one */ }
  };

  const enableSound = () => { unlockAudio(); setTimeout(() => setLocked(audioLocked()), 300); };

  useEffect(() => {
    if (!subGame.startedat) return;
    const start = new Date(subGame.startedat).getTime();

    const tick = () => setElapsedMs(Date.now() - start);

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [subGame.startedat, subGame.sgid]);

  const thresholdMs = (subGame.durationminutes ?? 15) * 60 * 1000;
  const overThreshold = elapsedMs >= thresholdMs;

  useEffect(() => {
    window.addEventListener('pointerdown', enableSound, { once: true });
    return () => window.removeEventListener('pointerdown', enableSound);
  }, []);

  // Keep the screen awake while a game is running. Browsers drop the lock whenever the
  // tab is hidden, so request it again when the tab becomes visible. Unsupported browsers
  // and insecure (plain http, non-localhost) pages simply skip this.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestLock = async () => {
      if (lock && !lock.released) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        lock = sentinel;
      } catch {
        // Denied (e.g. battery saver) or not allowed here; the timer still works.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestLock();
    };

    requestLock();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, []);

  // Scream once when the timer crosses the threshold (not on mid-game page loads past it).
  useEffect(() => {
    if (overThreshold && elapsedMs < thresholdMs + 5000) void playScream();
  }, [overThreshold]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--charcoal)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32,
    }}>
      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
        Game in progress
      </div>

      {/* Sized to the screen so a court-side iPad shows it as big as it can */}
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(72px, min(26vw, 38vh), 360px)', lineHeight: 1,
        color: overThreshold ? 'var(--danger)' : 'var(--white)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatElapsed(elapsedMs)}
      </div>

      {isAdmin && (
        <button onClick={scream} className="btn btn-secondary btn-lg">
          Scream
        </button>
      )}

      {locked && (
        <button onClick={enableSound} className="btn btn-secondary" style={{ position: 'absolute', top: 16, right: 16 }}>
          Tap to turn on sound
        </button>
      )}

      {onEndGame ? (
        <button onClick={onEndGame} className="btn btn-primary btn-lg">
          End Game
        </button>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>An admin will record the final score.</div>
      )}
    </div>
  );
}