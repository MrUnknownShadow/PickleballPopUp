import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
    <button
      className={`btn btn-block ${primary ? 'btn-primary' : 'btn-secondary'}`}
      style={{ minHeight: 44, justifyContent: 'center' }}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const step = (n: number, title: string, hint: string | null, body: ReactNode) => (
    <section className="card" style={{ padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hint ? 4 : 12 }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--green)', color: 'var(--white)', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      {hint && <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 12px 38px' }}>{hint}</p>}
      {body}
    </section>
  );

  const fieldLabel = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 } as const;

  return (
    <div className="fade-in">
      <div className="page-title">Text Messaging</div>
      <div className="page-subtitle">Work top to bottom: pick players, ask, confirm, send the schedule.</div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <label htmlFor="admin-event" style={fieldLabel}>Event</label>
        <select id="admin-event" className="settings-input" value={gid ?? ''} onChange={e => setGid(Number(e.target.value))} style={{ minHeight: 44 }}>
          {events.length === 0 && <option value="">No upcoming events</option>}
          {events.map(g => {
            const id = (g.gid ?? g.GID) as number;
            return <option key={id} value={id}>{new Date(g.gametime ?? g.GameTime ?? '').toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} - {g.location ?? g.Location}</option>;
          })}
        </select>
      </div>

      {gid !== null && (
        <>
          {step(1, `Pick players (${checked.size} picked)`, 'Everyone you tick gets the next text you send.', (
            <>
              {players.map(p => (
                <label key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '4px 0', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked.has(p.uid)} onChange={() => toggle(p.uid)} style={{ width: 20, height: 20, accentColor: 'var(--green)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{p.username}</span>
                  <span style={{ fontSize: 12, color: p.smsoptin ? 'var(--green)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                    {p.smsoptin ? `text ...${p.phonelast4}` : 'no texts'}
                  </span>
                  <span className="badge badge-gray" style={{ whiteSpace: 'nowrap' }}>{p.status ? STATUS_LABEL[p.status] ?? p.status : 'not asked'}</span>
                </label>
              ))}
              {warnNoOptIn > 0 && <div role="status" style={{ fontSize: 13, color: 'var(--danger)', marginTop: 10 }}>{warnNoOptIn} picked player(s) have not opted in to texts and will be skipped.</div>}
            </>
          ))}

          {step(2, 'Ask who can play', 'Players reply YES or NO by text.', (
            <>
              <label htmlFor="admin-note" style={fieldLabel}>Extra comment added to every text (optional)</label>
              <textarea id="admin-note" className="settings-input" value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} placeholder="e.g. Bring water, court 3" />
              <div style={{ marginTop: 12 }}>{btn('Ask availability now', () => post(`${base}/invite`, { uids, note }, r => `Sent ${r.sentNow}`), noPicks, true)}</div>
              <label htmlFor="admin-sendat" style={{ ...fieldLabel, marginTop: 16 }}>Or send it later</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input id="admin-sendat" className="settings-input" type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)} style={{ flex: '1 1 200px', minHeight: 44, width: 'auto' }} />
                <div style={{ flex: '0 0 auto' }}>{btn('Queue it', () => post(`${base}/invite`, { uids, note, sendAt: new Date(sendAt).toISOString() }, r => `Queued ${r.queued}`), noPicks || !sendAt)}</div>
              </div>
            </>
          ))}

          {step(3, 'Confirm the roster', 'Ticked players are playing and get an "in" text. Players who said yes but were not ticked get no text; they just stop seeing the event.', (
            btn('Confirm roster', () => post(`${base}/select`, { selected: uids, note }, r => `${r.picked} selected and texted, ${r.dropped} left out (no text)`), noPicks, true)
          ))}

          {step(4, 'Send the schedule', 'Texts everyone selected the time, place and who is playing. Day-before reminders go out on their own.', (
            btn('Send schedule with names', () => post(`${base}/schedule`, { note }, r => `Schedule sent to ${r.sent}`), false, true)
          ))}
        </>
      )}

      <section className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Text log</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn('Send due texts now', () => post('/api/admin/run-scheduler', {}, r => `${r.invites} invites, ${r.reminders} reminders`), false)}
            {btn('Refresh', load, false)}
          </div>
        </div>
        {outbox.length === 0 && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>No texts yet.</div>}
        {outbox.map(m => (
          <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{m.direction === 'in' ? 'from' : 'to'} {m.username}</strong>
              <span className="badge badge-gray">{m.kind}</span>
              <span className={`badge ${m.status === 'failed' ? 'badge-red' : m.status === 'skipped' ? 'badge-yellow' : 'badge-green'}`}>{m.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-500)' }}>{new Date(m.createdat).toLocaleTimeString()}</span>
            </div>
            <div style={{ color: 'var(--gray-700)', whiteSpace: 'pre-wrap', marginTop: 4 }}>{m.body}</div>
            {m.error && <div style={{ color: 'var(--danger)' }}>{m.error}</div>}
          </div>
        ))}
      </section>

      <details className="card" style={{ padding: 16, marginTop: 16 }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer', minHeight: 24 }}>Testing tools: pretend a player texted back</summary>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '8px 0 12px' }}>Tick exactly one player in step 1. Works without a text provider.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['YES', 'NO', 'STOP'].map(t => (
            <div key={t} style={{ flex: '1 1 90px' }}>
              {btn(`Reply ${t}`, () => {
                if (checked.size !== 1) { show('Tick exactly one player', 'error'); return; }
                post('/api/admin/simulate-reply', { uid: uids[0], text: t }, () => `Simulated ${t}`);
              }, false)}
            </div>
          ))}
        </div>
      </details>
      {Notification}
    </div>
  );
}
