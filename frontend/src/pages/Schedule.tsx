import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface Day { day: number; date: string; gid: number; time: string; location: string; players: string[]; me: boolean }
interface Week { weekStart: string; range: string; days: Day[] }

const dateLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function WeekCard({ title, week }: { title: string; week: Week }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 }}>{week.range}</p>
      {week.days.length === 0 && <div className="card" style={{ padding: 16, color: 'var(--gray-500)', fontSize: 14 }}>No schedule posted yet.</div>}
      {week.days.map(d => (
        <div key={d.day} className="card" style={{ padding: 16, marginBottom: 12, borderColor: d.me ? 'var(--green)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 16 }}>{dateLabel(d.date)}</strong>
            <span style={{ fontSize: 13, color: 'var(--gray-700)' }}>{timeLabel(d.time)} at {d.location}</span>
          </div>
          {d.me && <span className="badge badge-green" style={{ marginTop: 6 }}>You're playing</span>}
          <p style={{ fontSize: 14, marginTop: 8, overflowWrap: 'anywhere' }}>{d.players.join(', ')}</p>
        </div>
      ))}
    </section>
  );
}

// Public page (the link in the confirmation text opens it): no sign-in needed. Signed-in players get their own days marked.
export default function Schedule() {
  const { apiFetch, username } = useAuth();
  const [data, setData] = useState<{ current: Week; next: Week } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { apiFetch<{ current: Week; next: Week }>('/api/schedule').then(setData).catch(e => setError(e instanceof Error ? e.message : 'Could not load the schedule')); }, [apiFetch]);

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>BARNBOY GROUP</div>
        <a href={username ? '/events' : '/login'} className="btn btn-secondary btn-sm" style={{ minHeight: 44, justifyContent: 'center' }}>{username ? 'Open the app' : 'Sign in'}</a>
      </header>
      <div className="page-title">Schedule</div>
      <div className="page-subtitle">Who is playing which day</div>
      {error && <div role="alert" style={{ color: 'var(--danger)', marginTop: 16 }}>{error}</div>}
      {!data && !error && <div style={{ color: 'var(--gray-500)', marginTop: 16 }}>Loading...</div>}
      {data && <>
        <WeekCard title="This week" week={data.current} />
        <WeekCard title="Next week" week={data.next} />
      </>}
    </div>
  );
}
