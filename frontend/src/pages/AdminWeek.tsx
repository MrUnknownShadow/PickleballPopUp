import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../hooks/useApi';

interface Person { uid: number; username: string; confirmed?: boolean; late?: boolean }
interface Week {
  weekStart: string; range: string; poll: { sentat: string; cutoffat: string } | null;
  settings: Record<string, string>;
  days: Record<string, Person[]>; games: Record<string, { gid: number; time: string; location: string } | null>;
  none: Person[]; unclear: (Person & { raw: string })[]; noReply: { uid: number; username: string; smsoptin: boolean }[];
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SHORT = ['', 'M', 'T', 'W', 'Th', 'F'];
const shift = (ymd: string, n: number) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8) + n)).toISOString().slice(0, 10);
const dayDate = (week: string, d: number) => new Date(`${shift(week, d - 1)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const stamp = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

const SETTING_FIELDS: { key: string; label: string; long?: boolean; help?: string }[] = [
  { key: 'blast_time', label: 'Sunday blast time (venue time, 24h)', help: 'Example 14:00 for 2 PM' },
  { key: 'cutoff_hours', label: 'Replies count for this many hours after the blast' },
  { key: 'default_time', label: 'Default game time (24h)', help: 'Example 18:00' },
  { key: 'default_location', label: 'Default location' },
  { key: 'reminder_hours', label: 'Send the reminder this many hours before the game' },
  { key: 'blast_text', label: 'Weekly question text', long: true, help: 'Use {range} for the week dates' },
  { key: 'confirm_text', label: 'Confirmation text', long: true, help: 'Use {days} and {link}' },
  { key: 'removed_text', label: 'Removed-from-schedule text', long: true, help: 'Use {days} and {link}' },
  { key: 'ack_days_text', label: 'Reply received (days)', long: true, help: 'Use {days}' },
  { key: 'ack_none_text', label: 'Reply received (none)', long: true },
  { key: 'unclear_text', label: "Reply not understood", long: true },
];

export default function AdminWeek() {
  const { apiFetch } = useAuth();
  const { show, Notification } = useNotification();
  const [week, setWeek] = useState<Week | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Set<number>>>({});
  const [times, setTimes] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [fix, setFix] = useState<Record<number, Set<number>>>({});
  const [simUid, setSimUid] = useState(0);
  const [simText, setSimText] = useState('M W F');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (ws?: string | null) => {
    try {
      const w = await apiFetch<Week>(`/api/admin/week${ws ? `?weekStart=${ws}` : ''}`);
      setWeek(w); setWeekStart(w.weekStart); setSettings(w.settings);
      const p: Record<string, Set<number>> = {}, t: Record<string, string> = {}, l: Record<string, string> = {};
      for (let d = 1; d <= 5; d++) {
        p[d] = new Set((w.days[d] ?? []).filter(x => x.confirmed).map(x => x.uid));
        const g = w.games[d]; t[d] = g ? hhmm(g.time) : w.settings.default_time; l[d] = g ? g.location : w.settings.default_location;
      }
      setPicks(p); setTimes(t); setPlaces(l);
    } catch (e) { show(e instanceof Error ? e.message : 'Load failed', 'error'); }
  }, [apiFetch, show]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (path: string, method: string, body: object, ok: (r: any) => string, reload = true) => {
    setBusy(true);
    try { const r = await apiFetch(path, { method, body: JSON.stringify(body) }); show(ok(r), 'success'); if (reload) await load(weekStart); }
    catch (e) { show(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const toggle = (d: number, uid: number) => setPicks(prev => { const s = new Set(prev[d]); s.has(uid) ? s.delete(uid) : s.add(uid); return { ...prev, [d]: s }; });
  const btn = (label: string, onClick: () => void, disabled = false, primary = false) => (
    <button className={`btn btn-block ${primary ? 'btn-primary' : 'btn-secondary'}`} style={{ minHeight: 44, justifyContent: 'center' }} disabled={disabled || busy} onClick={onClick}>{label}</button>
  );
  const label = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 } as const;
  const card = { padding: 16, marginTop: 16 } as const;

  if (!week || !weekStart) return <div style={{ color: 'var(--gray-500)', marginTop: 16 }}>Loading...</div>;
  const autoOn = settings.blast_auto === '1';

  return (
    <div>
      {/* week picker */}
      <div className="card" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button className="btn btn-secondary" style={{ minHeight: 44 }} aria-label="Previous week" onClick={() => load(shift(weekStart, -7))}>‹</button>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>WEEK OF</div><strong>{week.range}</strong></div>
        <button className="btn btn-secondary" style={{ minHeight: 44 }} aria-label="Next week" onClick={() => load(shift(weekStart, 7))}>›</button>
      </div>

      {/* 1. blast */}
      <section className="card" style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>1. Ask who can play</h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
          {week.poll ? `Sent ${stamp(week.poll.sentat)}. Replies count until ${stamp(week.poll.cutoffat)}; later ones show as late.` : 'Not sent yet. Players reply with days like M T W Th F, or None.'}
        </p>
        {btn(week.poll ? 'Already sent' : 'Send the weekly question now', () => act('/api/admin/week/blast', 'POST', { weekStart }, r => r.alreadySent ? 'Already sent for this week' : `Sent to ${r.sent} players`), !!week.poll, true)}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, marginTop: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoOn} style={{ width: 20, height: 20, accentColor: 'var(--green)' }}
            onChange={e => act('/api/admin/week/settings', 'PUT', { blast_auto: e.target.checked ? '1' : '0' }, () => e.target.checked ? 'Automatic sending is on' : 'Automatic sending is off')} />
          <span style={{ fontSize: 14 }}>Send it automatically every Sunday at {settings.blast_time}<br /><span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{autoOn ? 'On: real texts go out by themselves.' : 'Off: nothing is sent until you click.'}</span></span>
        </label>
      </section>

      {/* 2. days */}
      <section className="card" style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>2. Pick who plays each day</h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>Tick the players you want. A player can be available on several days. Ticked players get one text listing their days; everyone else gets nothing.</p>
        {[1, 2, 3, 4, 5].map(d => {
          const people = week.days[d] ?? [];
          return (
            <div key={d} style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{DAY_NAMES[d]} <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>{dayDate(weekStart, d)}</span></strong>
                <span className="badge badge-gray">{people.length} available, {picks[d]?.size ?? 0} picked</span>
              </div>
              {people.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '6px 0' }}>Nobody yet.</p>}
              {people.map(p => (
                <label key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, cursor: 'pointer' }}>
                  <input type="checkbox" checked={picks[d]?.has(p.uid) ?? false} onChange={() => toggle(d, p.uid)} style={{ width: 20, height: 20, accentColor: 'var(--green)' }} />
                  <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{p.username}</span>
                  {p.late && <span className="badge badge-yellow">late</span>}
                </label>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <div style={{ flex: '1 1 110px' }}><label htmlFor={`t${d}`} style={label}>Time</label><input id={`t${d}`} className="settings-input" type="time" value={times[d] ?? ''} onChange={e => setTimes({ ...times, [d]: e.target.value })} /></div>
                <div style={{ flex: '2 1 160px' }}><label htmlFor={`l${d}`} style={label}>Location</label><input id={`l${d}`} className="settings-input" value={places[d] ?? ''} onChange={e => setPlaces({ ...places, [d]: e.target.value })} /></div>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 16 }}>
          {btn('Confirm the schedule and send texts', () => act('/api/admin/week/confirm', 'POST', {
            weekStart, days: Object.fromEntries([1, 2, 3, 4, 5].map(d => [d, { uids: [...(picks[d] ?? [])], time: times[d], location: places[d] }])),
          }, r => `${r.confirmed} confirmed, ${r.removed} told they were removed`), false, true)}
        </div>
      </section>

      {/* needs review / none / no reply */}
      {week.unclear.length > 0 && (
        <section className="card" style={card}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Needs your review ({week.unclear.length})</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>We couldn't read these replies. Pick the days they meant.</p>
          {week.unclear.map(u => (
            <div key={u.uid} style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 8 }}>
              <strong>{u.username}</strong> <span style={{ color: 'var(--gray-700)' }}>wrote "{u.raw}"</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                {[1, 2, 3, 4, 5].map(d => (
                  <label key={d} className="btn btn-secondary" style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', cursor: 'pointer', background: fix[u.uid]?.has(d) ? 'var(--green-light)' : undefined }}>
                    <input type="checkbox" style={{ position: 'absolute', opacity: 0 }} checked={fix[u.uid]?.has(d) ?? false}
                      onChange={() => setFix(f => { const s = new Set(f[u.uid]); s.has(d) ? s.delete(d) : s.add(d); return { ...f, [u.uid]: s }; })} />{SHORT[d]}
                  </label>
                ))}
                <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={busy}
                  onClick={() => act('/api/admin/week/set-days', 'POST', { weekStart, uid: u.uid, days: [...(fix[u.uid] ?? [])] }, () => 'Saved')}>Save</button>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="card" style={card}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Replies so far</h2>
        <p style={{ fontSize: 14 }}><strong>Said none ({week.none.length}):</strong> {week.none.map(n => n.username).join(', ') || '-'}</p>
        <p style={{ fontSize: 14, marginTop: 6 }}><strong>No reply ({week.noReply.length}):</strong> {week.noReply.map(n => n.username).join(', ') || '-'}</p>
      </section>

      {/* settings */}
      <details className="card" style={card}>
        <summary style={{ fontWeight: 700, cursor: 'pointer', minHeight: 24 }}>Message wording and timing</summary>
        <div style={{ marginTop: 12 }}>
          {SETTING_FIELDS.map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label htmlFor={`s-${f.key}`} style={label}>{f.label}</label>
              {f.long
                ? <textarea id={`s-${f.key}`} className="settings-input" rows={2} value={settings[f.key] ?? ''} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })} />
                : <input id={`s-${f.key}`} className="settings-input" value={settings[f.key] ?? ''} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })} />}
              {f.help && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{f.help}</div>}
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--green)' }} checked={settings.ack_replies === '1'} onChange={e => setSettings({ ...settings, ack_replies: e.target.checked ? '1' : '0' })} />
            <span style={{ fontSize: 14 }}>Text players back after they reply (costs one text each)</span>
          </label>
          {btn('Save wording and timing', () => act('/api/admin/week/settings', 'PUT', settings, () => 'Saved'), false, true)}
        </div>
      </details>

      <details className="card" style={card}>
        <summary style={{ fontWeight: 700, cursor: 'pointer', minHeight: 24 }}>Testing tools: pretend a player texted</summary>
        <div style={{ marginTop: 12 }}>
          <label htmlFor="sim-who" style={label}>Player</label>
          <select id="sim-who" className="settings-input" value={simUid} onChange={e => setSimUid(Number(e.target.value))}>
            <option value={0}>Choose a player</option>
            {[...week.noReply, ...week.none, ...week.unclear, ...Object.values(week.days).flat()].filter((p, i, a) => a.findIndex(x => x.uid === p.uid) === i).sort((a, b) => a.username.localeCompare(b.username)).map(p => <option key={p.uid} value={p.uid}>{p.username}</option>)}
          </select>
          <label htmlFor="sim-text" style={{ ...label, marginTop: 10 }}>Their reply</label>
          <input id="sim-text" className="settings-input" value={simText} onChange={e => setSimText(e.target.value)} />
          <div style={{ marginTop: 10 }}>{btn('Simulate this reply', () => act('/api/admin/week/simulate-reply', 'POST', { uid: simUid, text: simText }, () => 'Reply handled'), !simUid)}</div>
        </div>
      </details>
      {Notification}
    </div>
  );
}
