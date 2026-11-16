import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import type { LeaderboardEntry } from '../types';
import { Trophy, Download } from 'lucide-react';

interface RichEntry extends LeaderboardEntry {
  losses: number;
  winPct: number;
  displayName: string;
  totalG: number;
  totalW: number;
}

const PODIUM_HEIGHT: Record<number, number> = { 1: 92, 2: 66, 3: 50 };
const PODIUM_COLOR: Record<number, string> = { 1: 'var(--yellow)', 2: 'var(--gray-300)', 3: '#C98A5E' };
const PODIUM_ORDER = [2, 1, 3];

function exportCSV(players: RichEntry[]) {
  const header = 'Rank,Player,Wins,Losses,Games,Win%';
  const rows = players.map((p, i) =>
    `${i + 1},${p.displayName},${p.totalW},${p.losses},${p.totalG},${p.winPct}%`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leaderboard.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function PodiumSpot({ player, rank, isMe }: { player: RichEntry; rank: number; isMe: boolean }) {
  return (
    <div style={{ textAlign: 'center', width: 100 }}>
      <div className="avatar" style={{
        width: 42, height: 42, fontSize: 14, margin: '0 auto 8px',
        boxShadow: isMe ? '0 0 0 2px var(--green)' : 'none',
      }}>{player.displayName[0]?.toUpperCase()}</div>
      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.displayName}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--green-dark)', marginTop: 2 }}>{player.winPct}%</div>
      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 6, whiteSpace: 'nowrap' }}>{player.totalW}W {player.losses}L · {player.totalG}G</div>
      <div style={{
        height: PODIUM_HEIGHT[rank], background: PODIUM_COLOR[rank], borderRadius: '6px 6px 0 0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: rank === 1 ? 'var(--yellow-dark)' : 'var(--white)' }}>{rank}</span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { data: raw, loading, error } = useApi<LeaderboardEntry[]>('/api/games/leaderboard');
  const { username } = useAuth();

  const players: RichEntry[] = (raw ?? []).map(p => {
    const totalG = p.totalGames ?? p.totalgames ?? 0;
    const totalW = p.wins ?? 0;
    return {
      ...p,
      displayName: p.username ?? p.Username ?? '',
      totalG,
      totalW,
      losses: totalG - totalW,
      winPct: totalG > 0 ? Math.round((totalW / totalG) * 100) : 0,
    };
  }).sort((a, b) => b.winPct - a.winPct || b.totalW - a.totalW);

  const me = players.find(p => p.displayName === username);
  const myRank = me ? players.indexOf(me) + 1 : null;

  const hasPodium = players.length >= 3;
  const podiumPlayers = hasPodium ? players.slice(0, 3) : [];
  const restOfField = hasPodium ? players.slice(3) : players;
  const restStartRank = hasPodium ? 4 : 1;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div className="page-title">Leaderboard</div>
          <div className="page-subtitle">Ranked by win percentage</div>
        </div>
        {players.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(players)}>
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {me && myRank && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Your Rank', value: `#${myRank}` },
            { label: 'Win %', value: `${me.winPct}%`, green: true },
            { label: 'Wins', value: String(me.totalW) },
            { label: 'Losses', value: String(me.losses) },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={s.green ? { color: 'var(--green)' } : {}}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>Loading...</div>}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {!loading && players.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><Trophy size={40} color="var(--gray-300)" /></div>
          <div className="empty-title">No stats yet</div>
          <div>Complete an event with recorded games to see rankings!</div>
        </div>
      )}

      {hasPodium && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
          {PODIUM_ORDER.map(rank => {
            const player = podiumPlayers[rank - 1];
            return <PodiumSpot key={rank} player={player} rank={rank} isMe={player.displayName === username} />;
          })}
        </div>
      )}

      {restOfField.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 56px 56px 56px 90px', gap: 8, padding: '10px 20px', background: 'var(--gray-100)', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div /><div>Player</div>
            <div style={{ textAlign: 'center' }}>W</div>
            <div style={{ textAlign: 'center' }}>L</div>
            <div style={{ textAlign: 'center' }}>G</div>
            <div>Win %</div>
          </div>

          {restOfField.map((p, idx) => {
            const rank = restStartRank + idx;
            const isMe = p.displayName === username;
            return (
              <div key={p.displayName} style={{
                display: 'grid', gridTemplateColumns: '44px 1fr 56px 56px 56px 90px', gap: 8,
                padding: '13px 20px', alignItems: 'center',
                borderTop: idx > 0 ? '1px solid var(--line)' : 'none',
                background: isMe ? 'var(--green-light)' : 'transparent',
              }}>
                <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--gray-500)' }}>{rank}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{p.displayName[0]?.toUpperCase()}</div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {p.displayName}
                    {isMe && <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 10 }}>You</span>}
                  </span>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--green-dark)' }}>{p.totalW}</div>
                <div style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{p.losses}</div>
                <div style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>{p.totalG}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, lineHeight: 1, color: p.winPct >= 60 ? 'var(--green-dark)' : p.winPct >= 40 ? 'var(--charcoal)' : 'var(--danger)' }}>
                    {p.winPct}%
                  </div>
                  <div className="win-bar-wrap" style={{ width: 70, marginTop: 4 }}>
                    <div className="win-bar" style={{ width: `${p.winPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}