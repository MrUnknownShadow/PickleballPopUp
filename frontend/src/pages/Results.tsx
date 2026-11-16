import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Printer, ClipboardList } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import type { ResultsSummary } from '../types';
import { PlayerStatsTable, shortDate } from '../components/StatsTables';

// Dates are 'YYYY-MM-DD' strings, so month arithmetic never shifts with the browser's timezone.
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function monthRange(ymd: string, step: number): [string, string] {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1 + step, 1));
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDay(y, m))}`];
}
// 'October 2026' when the range is one calendar month (the current month counts up to today)
function monthName(from: string, to: string): string | null {
  if (from.slice(0, 7) !== to.slice(0, 7) || !from.endsWith('-01')) return null;
  return new Date(`${from}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Sessions in a date range, each opening its report page, and the combined summary of all their games.
export default function Results() {
  const { username } = useAuth();
  const [range, setRange] = useState<[string, string] | null>(null); // null: this month, as the server counts it
  const { data, loading, error } = useApi<ResultsSummary>(range ? `/api/games/results?from=${range[0]}&to=${range[1]}` : '/api/games/results');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { if (data) { setFrom(data.from); setTo(data.to); } }, [data]);

  const apply = (e: FormEvent) => { e.preventDefault(); if (from && to) setRange([from, to]); };
  const month = data && monthName(data.from, data.to);
  const first = data?.sessions[0], last = data?.sessions[data.sessions.length - 1];

  return (
    <div className="fade-in">
      <div className="no-print" style={{ marginBottom: 20 }}>
        <div className="page-title">Results</div>
        <div className="page-subtitle">Every session's games and player stats, in the format of the monthly report</div>
      </div>

      <form className="no-print results-range" onSubmit={apply}>
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Previous month" disabled={!data} onClick={() => data && setRange(monthRange(data.from, -1))}><ChevronLeft size={14} /></button>
        <label>From <input type="date" className="settings-input" value={from} onChange={e => setFrom(e.target.value)} required /></label>
        <label>To <input type="date" className="settings-input" value={to} onChange={e => setTo(e.target.value)} required /></label>
        <button type="submit" className="btn btn-primary btn-sm">Show</button>
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Next month" disabled={!data} onClick={() => data && setRange(monthRange(data.from, 1))}><ChevronRight size={14} /></button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ marginLeft: 'auto' }}><Printer size={13} /> Print</button>
      </form>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>Loading...</div>}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {data && !loading && (data.sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><ClipboardList size={40} color="var(--gray-300)" /></div>
          <div className="empty-title">No games recorded in these dates</div>
          <div>Pick another month, or finish a game in an event to see it here</div>
        </div>
      ) : (
        <>
          <div className="report-page">
            <h1 className="report-title">{month ? `${month} — ` : ''}Combined Summary</h1>
            <div className="report-subtitle">All Sessions ({shortDate(first!.gametime)} – {shortDate(last!.gametime)})</div>
            <PlayerStatsTable rows={data.stats} combined highlight={username} />
          </div>

          <h2 className="report-heading no-print" style={{ marginTop: 32 }}>Sessions</h2>
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.sessions.map(s => (
              <Link key={s.gid} to={`/history/${s.gid}`} className="row-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Pickleball — {shortDate(s.gametime)}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2, textTransform: 'capitalize' }}>{s.location}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{s.games} {s.games === 1 ? 'game' : 'games'}</div>
                <ChevronRight size={16} color="var(--gray-500)" />
              </Link>
            ))}
          </div>
        </>
      ))}
    </div>
  );
}
