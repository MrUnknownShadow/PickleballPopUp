import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../hooks/useApi';
import type { Game, Player, ChatMessage, SubGame } from '../types';
import { Clock, CheckCircle2, Trophy, Trash2, ArrowLeft, MessageSquare, ChevronDown, ChevronUp, Play, Square } from 'lucide-react';
import TeamPickerModal from '../components/TeamPickerModal';
import ScoreEntryModal from '../components/ScoreEntryModal';
import LiveGameTimer from '../components/LiveGameTimer';
import SessionTimer from '../components/SessionTimer';

function formatTime(t: string | undefined): string {
  if (!t) return '';
  try {
    return new Date(t).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return t; }
}

function formatShortTime(t: string | undefined): string {
  if (!t) return '';
  try {
    return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return t; }
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '';
  return formatMs(new Date(end).getTime() - new Date(start).getTime());
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { username, apiFetch } = useAuth();
  const navigate = useNavigate();
  const { show, Notification } = useNotification();

  const [event, setEvent] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [subGames, setSubGames] = useState<SubGame[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [scoringSubGame, setScoringSubGame] = useState<SubGame | null>(null);
  const [chatMsg, setChatMsg] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [eventsData, playersData, subGamesData, chatData] = await Promise.all([
        apiFetch<Game[]>('/api/games'),
        apiFetch<Player[]>(`/api/games/${id}/players`),
        apiFetch<SubGame[]>(`/api/games/${id}/subgames`),
        apiFetch<ChatMessage[]>(`/api/games/${id}/chat`),
      ]);
      setEvent(eventsData.find(g => String(g.gid ?? g.GID) === String(id)) ?? null);
      setPlayers(playersData);
      setSubGames(subGamesData);
      setChat(chatData);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleJoin = async () => {
    try { await apiFetch(`/api/games/${id}/join`, { method: 'POST', body: JSON.stringify({ username }) }); show('Joined!', 'success'); load(); }
    catch (err) { show(err instanceof Error ? err.message : 'Error', 'error'); }
  };

  const handleLeave = async () => {
    try { await apiFetch(`/api/games/${id}/leave`, { method: 'POST', body: JSON.stringify({ username }) }); show('Left event', 'default'); load(); }
    catch (err) { show(err instanceof Error ? err.message : 'Error', 'error'); }
  };

  const handleStartSession = async () => {
    try { await apiFetch(`/api/games/${id}/start`, { method: 'POST' }); show('Session started!', 'success'); load(); }
    catch (err) { show(err instanceof Error ? err.message : 'Error', 'error'); }
  };

  const handleEndSession = async () => {
    if (!confirmEnd) { setConfirmEnd(true); return; } // window.confirm is blocked in some webviews/PWAs
    setConfirmEnd(false);
    try { await apiFetch(`/api/games/${id}/end`, { method: 'POST' }); show('Session ended!', 'success'); load(); }
    catch (err) { show(err instanceof Error ? err.message : 'Error', 'error'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event?')) return;
    try { await apiFetch(`/api/games/${id}/delete`, { method: 'POST', body: JSON.stringify({ username }) }); navigate('/events'); }
    catch (err) { show(err instanceof Error ? err.message : 'Error', 'error'); }
  };

  const handleSendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    try {
      await apiFetch(`/api/games/${id}/chat`, { method: 'POST', body: JSON.stringify({ username, content: chatMsg }) });
      setChatMsg(''); load();
    } catch (err) { show(err instanceof Error ? err.message : 'Error', 'error'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>Loading...</div>;

  if (!event) return (
    <div>
      <button onClick={() => navigate('/events')} className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>← Back</button>
      <div className="empty-state"><div className="empty-title">Event not found</div></div>
    </div>
  );

  const status = event.status ?? event.Status ?? 'scheduled';
  const isScheduled = status === 'scheduled';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';
  const isCreator = (event.createdby ?? event.CreatedBy) === username;
  const isJoined = players.some(p => (p.username ?? p.Username) === username);
  const location = event.location ?? event.Location ?? '';
  const gameTime = event.gametime ?? event.GameTime ?? '';
  const sessionStartedAt = event.startedat ?? event.StartedAt;
  const hostName = event.createdby ?? event.CreatedBy;

  const activeSubGame = subGames.find(sg => sg.status === 'in_progress');
  const completedSubGames = subGames.filter(sg => sg.status === 'completed');
  const avgGameMs = completedSubGames.length > 0
    ? completedSubGames.reduce((sum, sg) => {
        if (!sg.startedat || !sg.endedat) return sum;
        return sum + (new Date(sg.endedat).getTime() - new Date(sg.startedat).getTime());
      }, 0) / completedSubGames.length
    : null;

  // Fullscreen live-game view takes over completely while a game is running —
  // no roster, no chat, no stats, per the sponsor's "only display the timer" spec.
  if (activeSubGame) {
    return (
      <>
        <LiveGameTimer subGame={activeSubGame} onEndGame={() => setScoringSubGame(activeSubGame)} isAdmin={isCreator} />
        {scoringSubGame && (
          <ScoreEntryModal
            subGame={scoringSubGame}
            onClose={() => setScoringSubGame(null)}
            onEnded={() => { show('Game recorded!', 'success'); load(); }}
            apiFetch={apiFetch}
          />
        )}
      </>
    );
  }

  return (
    <div className="fade-in">
      {Notification}

      <button onClick={() => navigate('/events')} style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
        <ArrowLeft size={14} /> Back to Events
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="page-title">{location}</div>
          <div style={{ fontSize: 14, color: 'var(--gray-500)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> {formatTime(gameTime)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {isInProgress && <SessionTimer startedAt={sessionStartedAt} />}
          <span className={`badge ${isCompleted ? 'badge-gray' : 'badge-green'}`}>{status}</span>

          {isScheduled && !isJoined && <button className="btn btn-primary btn-sm" onClick={handleJoin}>Join</button>}
          {isScheduled && isJoined && !isCreator && <button className="btn btn-danger btn-sm" onClick={handleLeave}>Leave</button>}

          {isScheduled && isCreator && (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleStartSession} disabled={players.length < 2}>
                <Play size={13} /> Start Session
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}><Trash2 size={14} /></button>
            </>
          )}

          {isInProgress && isCreator && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setShowTeamPicker(true)} disabled={players.length < 2}>
                + Start Game
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleEndSession}>
                <Square size={13} /> {confirmEnd ? 'Tap again to end' : 'End Session'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Roster strip */}
      <div style={{ marginBottom: 20 }}>
        {players.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>No players yet</div>
        ) : (
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {players.map((p, idx) => {
              const name = p.username ?? p.Username ?? '';
              const playerWins = completedSubGames.filter(sg => sg.team1score > sg.team2score ? sg.team1.includes(name) : sg.team2.includes(name)).length;
              const playerGames = completedSubGames.filter(sg => sg.team1.includes(name) || sg.team2.includes(name)).length;
              const isMe = name === username;
              const isHost = name === hostName;
              return (
                <div key={idx} style={{ textAlign: 'center', flexShrink: 0, width: 68 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', margin: '0 auto', position: 'relative',
                    background: 'var(--green-light)', color: 'var(--green-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                    boxShadow: isMe ? '0 0 0 2px var(--green)' : 'none',
                  }}>
                    {name[0]?.toUpperCase()}
                    {isHost && <div style={{ position: 'absolute', top: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: 'var(--yellow)', border: '2px solid var(--gray-100)' }} />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{name}</div>
                  {playerGames > 0 ? (
                    <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>{playerWins}W {playerGames - playerWins}L</div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--gray-300)' }}>&mdash;</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {(isInProgress || isCompleted) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Games Played</div>
            <div className="stat-value">{completedSubGames.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Players</div>
            <div className="stat-value">{players.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Session Length</div>
            {isInProgress ? (
              <SessionTimer startedAt={sessionStartedAt} style={{ fontSize: 24, fontWeight: 800 }} />
            ) : (
              <div className="stat-value">
                {formatMs(new Date(event.endedat ?? event.EndedAt ?? '').getTime() - new Date(sessionStartedAt ?? '').getTime())}
              </div>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Game Time</div>
            <div className="stat-value">{avgGameMs !== null ? formatMs(avgGameMs) : '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Status</div>
            <div className="stat-value" style={{ fontSize: 18, marginTop: 6, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-body)', fontWeight: 600 }}>
              {isCompleted
                ? <><CheckCircle2 size={16} color="var(--green)" /> Done</>
                : <><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block' }} /> Live</>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Start-session prompt */}
        {isScheduled && isCreator && players.length >= 2 && (
          <div className="card" style={{ padding: '28px 24px', textAlign: 'center', borderStyle: 'dashed' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏓</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ready to play!</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>{players.length} players have joined. Start the session when everyone's ready.</div>
            <button className="btn btn-primary" onClick={handleStartSession}>Start Session</button>
          </div>
        )}

        {/* Start-game prompt (session running, no games yet) */}
        {isInProgress && isCreator && completedSubGames.length === 0 && (
          <div className="card" style={{ padding: '28px 24px', textAlign: 'center', borderStyle: 'dashed' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏓</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Session is live</div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>Start the first game whenever you're ready.</div>
            <button className="btn btn-primary" onClick={() => setShowTeamPicker(true)}>+ Start First Game</button>
          </div>
        )}

        {/* Completed games list */}
        {completedSubGames.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>
                Games ({completedSubGames.length})
              </div>
              {isInProgress && isCreator && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowTeamPicker(true)}>+ New Game</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {completedSubGames.map((sg, idx) => {
                const t1wins = sg.team1score > sg.team2score;
                return (
                  <div key={sg.sgid} className="score-panel">
                    <div className="score-panel-label" style={{ fontSize: 15, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>GAME {idx + 1}</span>
                      <span style={{ color: 'var(--gray-500)' }}>·</span>
                      <span style={{ color: 'var(--green)' }}>{formatShortTime(sg.startedat)}</span>
                      <span style={{ color: 'var(--gray-500)' }}>–</span>
                      <span style={{ color: 'var(--yellow-dark)' }}>{formatShortTime(sg.endedat)}</span>
                      <span style={{ color: 'var(--gray-500)' }}>·</span>
                      <span style={{ color: 'var(--white)', fontWeight: 700 }}>{formatDuration(sg.startedat, sg.endedat)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
                      <div>
                        <div className="score-panel-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {t1wins && <Trophy size={12} color="var(--yellow)" />} {sg.team1?.join(', ') || '—'}
                        </div>
                      </div>
                      <div className="score-panel-value" style={{ fontSize: 44, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: t1wins ? 'var(--yellow)' : 'var(--white)' }}>{sg.team1score}</span>
                        <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>&ndash;</span>
                        <span style={{ color: !t1wins ? 'var(--yellow)' : 'var(--white)' }}>{sg.team2score}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="score-panel-name" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          {sg.team2?.join(', ') || '—'} {!t1wins && <Trophy size={12} color="var(--yellow)" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat (collapsible) */}
        <div>
          <button onClick={() => setChatOpen(!chatOpen)} style={{
            width: '100%', background: 'var(--white)', border: '1.5px solid var(--line)', borderRadius: chatOpen ? '10px 10px 0 0' : 'var(--radius-lg)',
            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--charcoal)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} /> Event chat {chat.length > 0 && <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>({chat.length})</span>}
            </span>
            {chatOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {chatOpen && (
            <div style={{ background: 'var(--white)', border: '1.5px solid var(--line)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px 18px' }}>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chat.length === 0 && <div style={{ color: 'var(--gray-500)', fontSize: 13 }}>No messages yet</div>}
                {chat.map((msg, i) => {
                  const msgName = msg.username ?? msg.Username ?? '';
                  const isMe = msgName === username;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: 10, flexShrink: 0 }}>{msgName[0]?.toUpperCase()}</div>
                      <div style={{ background: isMe ? 'var(--green-light)' : 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: '7px 11px', maxWidth: '70%' }}>
                        {!isMe && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 2 }}>{msgName}</div>}
                        <div style={{ fontSize: 13 }}>{msg.content ?? msg.Content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  placeholder="Say something..."
                  style={{
                    flex: 1, border: '1.5px solid var(--gray-300)', borderRadius: 99, padding: '9px 16px',
                    fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--charcoal)', outline: 'none',
                    background: 'var(--gray-100)', transition: 'border-color 0.15s ease',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--gray-300)'; }}
                />
                <button type="submit" className="btn btn-primary btn-sm btn-pill">Send</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {showTeamPicker && (
        <TeamPickerModal
          players={players}
          onClose={() => setShowTeamPicker(false)}
          onStarted={() => { show('Game started!', 'success'); load(); }}
          apiFetch={apiFetch}
          eventId={id!}
        />
      )}
    </div>
  );
}