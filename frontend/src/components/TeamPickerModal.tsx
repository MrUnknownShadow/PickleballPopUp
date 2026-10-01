import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import type { Player } from '../types';

interface TeamPickerModalProps {
  players: Player[];
  onClose: () => void;
  onStarted: () => void;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  eventId: string;
}

export default function TeamPickerModal({ players, onClose, onStarted, apiFetch, eventId }: TeamPickerModalProps) {
  const names = players.map(p => p.username ?? p.Username ?? '').filter(Boolean);
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [duration, setDuration] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const togglePlayer = (name: string, team: 1 | 2) => {
    if (team === 1) {
      if (team1.includes(name)) setTeam1(team1.filter(p => p !== name));
      else if (!team2.includes(name)) setTeam1([...team1, name]);
    } else {
      if (team2.includes(name)) setTeam2(team2.filter(p => p !== name));
      else if (!team1.includes(name)) setTeam2([...team2, name]);
    }
  };

  const handleRandomize = () => {
    const shuffled = [...names].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setTeam1(shuffled.slice(0, mid));
    setTeam2(shuffled.slice(mid));
  };

  const handleStart = async () => {
    if (team1.length === 0 || team2.length === 0) { setError('Both teams need players'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/api/games/${eventId}/startgame`, {
        method: 'POST',
        body: JSON.stringify({ team1, team2, durationMinutes: duration }),
      });
      onStarted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Start New Game</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>Assign players to teams</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleRandomize}><Shuffle size={13} /> Random</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 8 }}>TEAM A</div>
              {team1.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p}</span>
                  <button onClick={() => togglePlayer(p, 1)} style={{ fontSize: 14, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
              {team1.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>No players yet</div>}
            </div>
            <div style={{ background: 'var(--yellow-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow-dark)', marginBottom: 8 }}>TEAM B</div>
              {team2.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p}</span>
                  <button onClick={() => togglePlayer(p, 2)} style={{ fontSize: 14, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
              {team2.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>No players yet</div>}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Click a player to add to a team:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {names.map(name => {
              const inT1 = team1.includes(name);
              const inT2 = team2.includes(name);
              return (
                <div key={name} style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => togglePlayer(name, 1)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
                      background: inT1 ? 'var(--green)' : 'var(--gray-100)',
                      color: inT1 ? 'white' : 'var(--gray-700)',
                      border: '1px solid', borderColor: inT1 ? 'var(--green)' : 'var(--gray-300)',
                    }}
                  >A: {name}</button>
                  <button
                    onClick={() => togglePlayer(name, 2)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
                      background: inT2 ? 'var(--yellow-dark)' : 'var(--gray-100)',
                      color: inT2 ? 'white' : 'var(--gray-700)',
                      border: '1px solid', borderColor: inT2 ? 'var(--yellow-dark)' : 'var(--gray-300)',
                    }}
                  >B: {name}</button>
                </div>
              );
            })}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 16 }}>
          Game length (minutes)
          <input type="number" min={1} max={180} value={duration} onChange={e => setDuration(Number(e.target.value))}
            style={{ width: 70, padding: '4px 8px' }} />
        </label>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={team1.length === 0 || team2.length === 0 || !(duration >= 1 && duration <= 180) || loading}
            onClick={handleStart}
          >{loading ? 'Starting...' : 'Start Game'}</button>
        </div>
      </div>
    </div>
  );
}