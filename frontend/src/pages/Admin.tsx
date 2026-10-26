import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi, useNotification } from '../hooks/useApi';
import type { Game } from '../types';

interface AdminPlayer { uid: number; username: string; smsoptin: boolean; phonelast4: string | null; status: string | null }
interface OutboxRow { id: number; username: string | null; kind: string; direction: string; body: string; status: string; error: string | null; createdat: string }

const STATUS_LABEL: Record<string, string> = {
  queued: 'queued', invited: 'asked', joined: 'said yes', declined: 'said no', selected: 'selected', not_selected: 'not selected',
};

// Next Sunday 10:00 local, formatted for <input type="datetime-local">.
function nextSunday10(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Admin() {
  const { apiFetch, isAdmin } = useAuth();
  const { show, Notification } = useNotification();
  const { data: games } = useApi<Game[]>('/api/games');
  const events = useMemo(
    () => (games ?? []).filter(g => (g.status ?? g.Status) === 'scheduled' && new Date(g.gametime ?? g.GameTime ?? 0).getTime() > Date.now() - 24 * 3600e3)
      .sort((a, b) => new Date(a.gametime ?? a.GameTime ?? 0).getTime() - new Date(b.gametime ?? b.GameTime ?? 0).getTime()),
    [games]
  );
  const [gid, setGid] = useState<number | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');
  const [sendAt, setSendAt] = useState(nextSunday10());
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (gid === null && events.length) setGid((events[0].gid ?? events[0].GID) as number); }, [events, gid]);

  const load = async () => {
    if (gid === null) return;
    try {
      const [p, o] = await Promise.all([
        apiFetch<AdminPlayer[]>(`/api/admin/games/${gid}/players`),
        apiFetch<OutboxRow[]>('/api/admin/outbox'),
      ]);
      setPlayers(p); setOutbox(o);
    } catch (e) { show(e instanceof Error ? e.message : 'Load failed', 'error'); }
  };
  useEffect(() => { setChecked(new Set()); load(); }, [gid]);

  if (!isAdmin) return <div className="empty-state"><div className="empty-title">Admins only</div></div>;

  const toggle = (uid: number) => setChecked(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  const post = async (path: string, body: object, ok: (r: any) => string) => {
    setBusy(true);
    try { const r = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); show(ok(r), 'success'); await load(); }
    catch (e) { show(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setBusy(false); }
  };
  const base = `/api/admin/games/${gid}`;
  const uids = [...checked];
  const noPicks = uids.length === 0;
  const warnNoOptIn = players.filter(p => checked.has(p.uid) && !p.smsoptin).length;

  const btn = (label: string, onClick: () => void, disabled: boolean, primary = false) => (
    <button className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-secondary'}`} disabled={disabled || busy} onClick={onClick}>{label}</button>
  );

  return (
    <div className="fade-in">
      <div className="page-title">Text Messaging</div>
      <div className="page-subtitle">Pick players, send availability, confirm the roster, send the schedule</div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Event</label>
        <select value={gid ?? ''} onChange={e => setGid(Number(e.target.value))} style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }}>
          {events.length === 0 && <option value="">No upcoming events</option>}
          {events.map(g => {
            const id = (g.gid ?? g.GID) as number;
            return <option key={id} value={id}>{new Date(g.gametime ?? g.GameTime ?? '').toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} - {g.location ?? g.Location}</option>;
          })}
        </select>
      </div>

      {gid !== null && (
        <>
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Players ({checked.size} picked)</div>
            {players.map(p => (
              <label key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <input type="checkbox" checked={checked.has(p.uid)} onChange={() => toggle(p.uid)} />
                <span style={{ flex: 1 }}>{p.username}</span>
                <span style={{ fontSize: 12, color: p.smsoptin ? 'var(--green)' : 'var(--danger)' }}>
                  {p.smsoptin ? `text ...${p.phonelast4}` : 'no texts'}
                </span>
                <span className="badge badge-gray">{p.status ? STATUS_LABEL[p.status] ?? p.status : 'not asked'}</span>
              </label>
            ))}
            {warnNoOptIn > 0 && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{warnNoOptIn} picked player(s) have not opted in to texts and will be skipped.</div>}
          </div>

          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Extra comment added to the text (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }} placeholder="e.g. Bring water, court 3" />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
              {btn('1. Ask availability now', () => post(`${base}/invite`, { uids, note }, r => `Sent ${r.sentNow}`), noPicks, true)}
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>or on</span>
              <input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)} style={{ padding: 6 }} />
              {btn('Queue it', () => post(`${base}/invite`, { uids, note, sendAt: new Date(sendAt).toISOString() }, r => `Queued ${r.queued}`), noPicks || !sendAt)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {btn('2. Confirm roster (picked = playing)', () => post(`${base}/select`, { selected: uids, note }, r => `${r.picked} selected, ${r.dropped} told they are out`), noPicks, true)}
              {btn('3. Send schedule with names', () => post(`${base}/schedule`, { note }, r => `Schedule sent to ${r.sent}`), false, true)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
              Step 2 texts picked players that they are in, and everyone who said yes but was not picked that they are out. Those players no longer see the event. Day-before reminders go out automatically.
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Text log (latest 40)</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {btn('Send due texts now', () => post('/api/admin/run-scheduler', {}, r => `${r.invites} invites, ${r.reminders} reminders`), false)}
            {btn('Refresh', load, false)}
          </div>
        </div>
        {outbox.length === 0 && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>No texts yet.</div>}
        {outbox.map(m => (
          <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{m.direction === 'in' ? 'from' : 'to'} {m.username}</strong>
              <span className="badge badge-gray">{m.kind}</span>
              <span className={`badge ${m.status === 'failed' ? 'badge-red' : m.status === 'skipped' ? 'badge-yellow' : 'badge-green'}`}>{m.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-500)' }}>{new Date(m.createdat).toLocaleTimeString()}</span>
            </div>
            <div style={{ color: 'var(--gray-700)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{m.body}</div>
            {m.error && <div style={{ color: 'var(--danger)' }}>{m.error}</div>}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Test: pretend a player texted back</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Uses the player ticked above. Works without Twilio.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['YES', 'NO', 'STOP'].map(t => btn(`Reply ${t}`, () => {
            if (checked.size !== 1) { show('Tick exactly one player', 'error'); return; }
            post('/api/admin/simulate-reply', { uid: uids[0], text: t }, () => `Simulated ${t}`);
          }, false))}
        </div>
      </div>
      {Notification}
    </div>
  );
}
