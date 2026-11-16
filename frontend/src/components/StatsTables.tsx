import type { ReportGame, PlayerStatRow } from '../types';

// Tables in the layout of the sponsor's monthly report: navy headers, close/blowout/shutout row colours, centred numbers.

export const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
const team = (names: string[]) => names.map(displayName).join(' & ');
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

// '10/1/26', as the report titles each session
export function shortDate(t: string): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

export function GameResultsTable({ games, onEdit }: { games: ReportGame[]; onEdit?: (game: ReportGame) => void }) {
  return (
    <div className="report-block">
      <div className="report-scroll">
        <table className="report-table report-games">
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Team 1</th><th scope="col">S1</th><th scope="col">S2</th><th scope="col">Team 2</th>
              {onEdit && <th scope="col" className="no-print"><span className="sr-only">Edit</span></th>}
            </tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.sgid} className={g.kind ? `row-${g.kind}` : undefined}>
                <td className="num-left">{g.n}</td>
                <td>{team(g.team1)}</td>
                <td>{g.s1}</td>
                <td>{g.s2}</td>
                <td>{team(g.team2)}</td>
                {onEdit && (
                  <td className="no-print">
                    <button className="report-edit" onClick={() => onEdit(g)} aria-label={`Correct score of game ${g.n}`}>Edit</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="report-legend" aria-label="Row colours">
        <tbody>
          <tr><td className="swatch row-close" /><td>Close game (≤2 pts)</td></tr>
          <tr><td className="swatch row-blowout" /><td>Blowout (&gt;6 pts)</td></tr>
          <tr><td className="swatch row-shutout" /><td>Shutout (0 pts)</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// combined adds AvgF and AvgA, as on the report's monthly summary page
export function PlayerStatsTable({ rows, combined = false, highlight }: { rows: PlayerStatRow[]; combined?: boolean; highlight?: string | null }) {
  return (
    <div className="report-scroll">
      <table className="report-table report-stats">
        <thead>
          <tr>
            <th scope="col">Player</th><th scope="col">W-L</th><th scope="col">Win%</th>
            <th scope="col">PF</th>{combined && <th scope="col">AvgF</th>}
            <th scope="col">PA</th>{combined && <th scope="col">AvgA</th>}
            <th scope="col">+/-</th>
            <th scope="col" title="Win rate when on Team 1 (serving side)">Srv%</th>
            <th scope="col" title="Win rate when on Team 2 (receiving side)">Rcv%</th>
            <th scope="col">Streak</th>
            <th scope="col" title="Average point gap in this player's games">AvgMgn</th>
            <th scope="col" title="Record in games decided by 3 points or less">Close</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.player} className={r.player === highlight ? 'row-me' : undefined}>
              <th scope="row">{displayName(r.player)}</th>
              <td>{r.w}-{r.l}</td>
              <td>{r.winPct}%</td>
              <td>{r.pf}</td>{combined && <td>{r.avgF.toFixed(1)}</td>}
              <td>{r.pa}</td>{combined && <td>{r.avgA.toFixed(1)}</td>}
              <td>{signed(r.diff)}</td>
              <td>{r.srvPct}%</td>
              <td>{r.rcvPct}%</td>
              <td>{r.streak}</td>
              <td>{r.avgMgn.toFixed(1)}</td>
              <td>{r.closeW}-{r.closeL}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
