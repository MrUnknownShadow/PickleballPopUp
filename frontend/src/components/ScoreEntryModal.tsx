import { useState, FormEvent } from 'react';
import type { SubGame } from '../types';
import LabeledInput from './LabeledInput';
import { useEscape } from '../hooks/useEscape';

interface ScoreEntryModalProps {
  subGame: SubGame;
  onClose: () => void;
  onEnded: () => void;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
}

export default function ScoreEntryModal({ subGame, onClose, onEnded, apiFetch }: ScoreEntryModalProps) {
  useEscape(onClose);
  const [team1score, setTeam1score] = useState('');
  const [team2score, setTeam2score] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!team1score || !team2score) { setError('Enter scores for both teams'); return; }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/api/games/subgame/${subGame.sgid}/end`, {
        method: 'POST',
        body: JSON.stringify({ team1score: parseInt(team1score), team2score: parseInt(team2score) }),
      });
      onEnded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record score');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="score-title" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title" id="score-title">Enter Final Score</div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 4 }}>TEAM A</div>
                <div style={{ fontSize: 13 }}>{subGame.team1.join(', ')}</div>
              </div>
              <LabeledInput label="Team A score" type="number" min={0} max={99} value={team1score} onChange={setTeam1score} required />
            </div>
            <div>
              <div style={{ background: 'var(--yellow-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow-dark)', marginBottom: 4 }}>TEAM B</div>
                <div style={{ fontSize: 13 }}>{subGame.team2.join(', ')}</div>
              </div>
              <LabeledInput label="Team B score" type="number" min={0} max={99} value={team2score} onChange={setTeam2score} required />
            </div>
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Score'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}