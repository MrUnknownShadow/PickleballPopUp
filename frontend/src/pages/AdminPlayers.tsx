import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../hooks/useApi';
import LabeledInput from '../components/LabeledInput';

interface Player { uid: number; username: string; phone: string | null; smsoptin: boolean; isadmin: boolean; createdat: string; games: number }

const last4 = (p: string | null) => (p ? `···${p.slice(-4)}` : 'no phone');

// Admin-only: add players directly (no group code, no sign-up flow) and remove them.
export default function AdminPlayers() {
  const { apiFetch, username: me } = useAuth();
  const { show, Notification } = useNotification();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmUid, setConfirmUid] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setPlayers(await apiFetch<Player[]>('/api/admin/players')); }
    catch (e) { show(e instanceof Error ? e.message : 'Could not load players', 'error'); }
  }, [apiFetch, show]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/admin/players', { method: 'POST', body: JSON.stringify({ username: name, pin, phoneNumber: phone }) });
      show(`Added ${name.trim()}`, 'success');
      setName(''); setPin(''); setPhone('');
      await load();
    } catch (err) { show(err instanceof Error ? err.message : 'Could not add the player', 'error'); }
    finally { setBusy(false); }
  };

  const remove = async (p: Player) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/players/${p.uid}`, { method: 'DELETE' });
      show(`Removed ${p.username}`, 'success');
      setConfirmUid(null);
      await load();
    } catch (err) { show(err instanceof Error ? err.message : 'Could not remove the player', 'error'); }
    finally { setBusy(false); }
  };

  const card = { padding: 16, marginTop: 16 } as const;
  return (
    <div>
      {Notification}
      <section className="card" style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Add a player</h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
          No group code needed. Tell the player their username and PIN so they can sign in.
          Texts stay off until the player turns them on in Settings, or texts START to the group number.
        </p>
        <form onSubmit={add}>
          <LabeledInput label="Username" value={name} onChange={setName} maxLength={30} required autoComplete="off" />
          <LabeledInput label="4-digit PIN" value={pin} onChange={setPin} numeric maxLength={4} required autoComplete="off" />
          <LabeledInput label="Mobile phone number" value={phone} onChange={setPhone} numeric maxLength={15} required autoComplete="off" />
          <button type="submit" className="btn btn-primary btn-block" style={{ minHeight: 44, justifyContent: 'center' }} disabled={busy || !name.trim() || pin.length !== 4 || phone.length < 10}>Add player</button>
        </form>
      </section>

      <section className="card" style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Players{players ? ` (${players.length})` : ''}</h2>
        {!players && <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Loading...</p>}
        {players?.length === 0 && <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>No players yet.</p>}
        {players?.map(p => (
          <div key={p.uid} style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ flex: '1 1 140px', overflowWrap: 'anywhere' }}>{p.username}</strong>
              {p.isadmin && <span className="badge badge-green">admin</span>}
              <span className={`badge ${p.smsoptin ? 'badge-green' : 'badge-gray'}`}>{p.smsoptin ? 'texts on' : 'texts off'}</span>
              {p.username.toLowerCase() !== me?.toLowerCase() && confirmUid !== p.uid && (
                <button className="btn btn-danger btn-sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => setConfirmUid(p.uid)}>Remove</button>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{last4(p.phone)} · {p.games} recorded {p.games === 1 ? 'game' : 'games'}</div>
            {confirmUid === p.uid && (
              <div role="alert" style={{ marginTop: 10, padding: 12, background: 'var(--danger-light)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                Remove <strong>{p.username}</strong> for good?{p.games > 0 && <> They are in <strong>{p.games}</strong> recorded {p.games === 1 ? 'game' : 'games'}; those results will change.</>} This can't be undone.
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-danger" style={{ minHeight: 44 }} disabled={busy} onClick={() => remove(p)}>Yes, remove</button>
                  <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setConfirmUid(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
