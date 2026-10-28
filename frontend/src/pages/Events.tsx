import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useNotification } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import type { Game } from '../types';
import { Clock, AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import LabeledInput from '../components/LabeledInput';
import { useEscape } from '../hooks/useEscape';

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  useEscape(onClose);
  const { apiFetch, username } = useAuth();
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await apiFetch('/api/games', {
        method: 'POST',
        body: JSON.stringify({ location, time: `${date}T${time}`, username }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-event-title" onClick={e => e.stopPropagation()}>
        <div className="modal-title" id="create-event-title">Create New Event</div>
        <form onSubmit={handleSubmit}>
          <LabeledInput label="Location" value={location} onChange={setLocation} required />
          <LabeledInput label="Date" type="date" value={date} onChange={setDate} required />
          <LabeledInput label="Time" type="time" value={time} onChange={setTime} required />
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Event'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTime(t: string | undefined): string {
  if (!t) return '';
  try {
    return new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return t; }
}

function formatFullTime(t: string | undefined): string {
  if (!t) return '';
  try {
    return new Date(t).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return t; }
}

function HeroEvent({ event }: { event: Game }) {
  const gid = event.gid ?? event.GID;
  return (
    <Link to={`/events/${gid}`} style={{ textDecoration: 'none' }}>
      <div className="fade-in" style={{
        background: 'var(--charcoal)', borderRadius: 'var(--radius-lg)', padding: '26px 28px',
        marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 16, cursor: 'pointer',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 700, letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' }}>Up next</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: 'var(--white)', lineHeight: 1 }}>
            {event.location ?? event.Location ?? 'TBD'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> {formatFullTime(event.gametime ?? event.GameTime)}
          </div>
        </div>
        <div className="hero-cta">
          View event <ChevronRight size={15} />
        </div>
      </div>
    </Link>
  );
}

function EventTile({ event }: { event: Game }) {
  const status = event.status ?? event.Status ?? 'scheduled';
  const isCompleted = status === 'completed';
  const statusColor = isCompleted ? 'var(--yellow-dark)' : 'var(--green)';
  return (
    <Link to={`/events/${event.gid ?? event.GID}`} style={{ textDecoration: 'none' }}>
      <div
        className="fade-in"
        style={{
          background: 'var(--white)', borderRadius: 'var(--radius-md)', padding: '14px 16px',
          borderTop: `4px solid ${statusColor}`, cursor: 'pointer', transition: 'background 0.12s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--gray-100)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--white)'; }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--charcoal)' }}>
          {event.location ?? event.Location ?? 'TBD'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={12} /> {formatTime(event.gametime ?? event.GameTime)}
        </div>
        <div className="row-status" style={{ color: statusColor, marginTop: 9 }}>{status}</div>
      </div>
    </Link>
  );
}

export default function Events() {
  const { username } = useAuth();
  const { data: events, loading, error, refetch } = useApi<Game[]>(`/api/games?username=${username}`);
  const [showCreate, setShowCreate] = useState(false);
  const { show, Notification } = useNotification();

  const allUpcoming = (events ?? []).filter(e => (e.status ?? e.Status) !== 'completed');
  const completed = (events ?? []).filter(e => (e.status ?? e.Status) === 'completed');

  const sortedUpcoming = [...allUpcoming].sort((a, b) => {
    const ta = new Date(a.gametime ?? a.GameTime ?? 0).getTime();
    const tb = new Date(b.gametime ?? b.GameTime ?? 0).getTime();
    return ta - tb;
  });
  // A scheduled event more than a day old was never ended: keep it out of "Up next".
  const isLate = (e: Game) => (e.status ?? e.Status) === 'scheduled' && new Date(e.gametime ?? e.GameTime ?? 0).getTime() < Date.now() - 24 * 3600e3;
  const current = sortedUpcoming.filter(e => !isLate(e));
  const late = sortedUpcoming.filter(isLate);
  const hero = current[0];
  const restUpcoming = current.slice(1);

  return (
    <div>
      {Notification}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="page-title">Events</div>
          <div className="page-subtitle">Join a session or create your own</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Event</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-500)' }}>Loading events...</div>}

      {error && (
        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 14, display: 'flex', gap: 8 }}>
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Can't reach server — make sure your backend is running.
          <br /><span style={{ fontSize: 12, opacity: 0.8 }}>{error}</span></span>
        </div>
      )}

      {!loading && !error && sortedUpcoming.length === 0 && completed.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><Calendar size={40} color="var(--gray-300)" /></div>
          <div className="empty-title">No events yet</div>
          <div style={{ marginBottom: 20 }}>Create the first pickleball event!</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Event</button>
        </div>
      )}

      {hero && <HeroEvent event={hero} />}

      {restUpcoming.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            More upcoming ({restUpcoming.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {restUpcoming.map(event => <EventTile key={event.gid ?? event.GID} event={event} />)}
          </div>
        </div>
      )}

      {late.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Past, never ended ({late.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {late.map(event => <EventTile key={event.gid ?? event.GID} event={event} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Completed ({completed.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {completed.map(event => <EventTile key={event.gid ?? event.GID} event={event} />)}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { show('Event created!', 'success'); refetch(); }}
        />
      )}
    </div>
  );
}