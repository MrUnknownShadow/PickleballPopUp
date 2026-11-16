import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useApi, useNotification } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import type { SessionReport as Report, SubGame } from '../types';
import { GameResultsTable, PlayerStatsTable, shortDate } from '../components/StatsTables';
import ScoreEntryModal from '../components/ScoreEntryModal';

// One session as a page of the sponsor's report: numbered results, then Player Stats.
export default function SessionReport() {
  const { id } = useParams<{ id: string }>();
  const { username, isAdmin, apiFetch } = useAuth();
  const { data, loading, error, refetch } = useApi<Report>(`/api/games/${id}/report`);
  const { show, Notification } = useNotification();
  const [fixing, setFixing] = useState<SubGame | null>(null);

  return (
    <div className="fade-in">
      {Notification}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <Link to="/history" style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={14} /> All results
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/events/${id}`} className="btn btn-secondary btn-sm">Event</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={13} /> Print</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>Loading...</div>}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {data && (
        <div className="report-page">
          <h1 className="report-title">Pickleball — {shortDate(data.gametime)}</h1>
          <div className="report-subtitle">{data.location}</div>

          {data.games.length === 0 ? (
            <div className="empty-state"><div className="empty-title">No finished games in this session yet</div></div>
          ) : (
            <>
              <GameResultsTable
                games={data.games}
                onEdit={isAdmin ? g => setFixing({ sgid: g.sgid, team1: g.team1, team2: g.team2, team1score: g.s1, team2score: g.s2, createdat: '' }) : undefined}
              />
              <h2 className="report-heading">Player Stats</h2>
              <PlayerStatsTable rows={data.stats} highlight={username} />
            </>
          )}
        </div>
      )}

      {fixing && (
        <ScoreEntryModal
          subGame={fixing}
          correcting
          onClose={() => setFixing(null)}
          onEnded={() => { show('Score corrected', 'success'); refetch(); }}
          apiFetch={apiFetch}
        />
      )}
    </div>
  );
}
