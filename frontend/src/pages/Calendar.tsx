import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { Game } from '../types';

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function getEventDate(event: Game): Date | null {
  const value = event.gametime ?? event.GameTime;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfCalendar(month: Date): Date {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const dayOffset = firstOfMonth.getDay();
  return new Date(month.getFullYear(), month.getMonth(), 1 - dayOffset);
}

function buildCalendarDays(month: Date): Date[] {
  const start = startOfCalendar(month);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

function isSameDay(left: Date, right: Date): boolean {
  return dateKey(left) === dateKey(right);
}

export default function Calendar() {
  const { data: events, loading, error } = useApi<Game[]>('/api/games');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const today = new Date();
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, Game[]>();
    for (const event of events ?? []) {
      const date = getEventDate(event);
      if (!date) continue;
      const key = dateKey(date);
      const dayEvents = grouped.get(key) ?? [];
      dayEvents.push(event);
      grouped.set(key, dayEvents);
    }
    for (const dayEvents of grouped.values()) {
      dayEvents.sort((left, right) => (getEventDate(left)?.getTime() ?? 0) - (getEventDate(right)?.getTime() ?? 0));
    }
    return grouped;
  }, [events]);

  const shiftMonth = (offset: number) => {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <div className="page-title">Calendar</div>
          <div className="page-subtitle">Every session, at a glance</div>
        </div>
        <div className="calendar-controls">
          <button className="calendar-icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month" title="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button className="calendar-today-button" onClick={() => setVisibleMonth(new Date())}>Today</button>
          <button className="calendar-icon-button" onClick={() => shiftMonth(1)} aria-label="Next month" title="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading && <div className="calendar-message">Loading schedule...</div>}
      {error && (
        <div className="calendar-error">
          <AlertTriangle size={17} />
          <span>Can&apos;t reach server. Make sure your backend is running.</span>
        </div>
      )}

      {!loading && !error && (
        <section className="calendar-shell" aria-label={`${monthFormatter.format(visibleMonth)} event calendar`}>
          <div className="calendar-month-row">
            <h1>{monthFormatter.format(visibleMonth)}</h1>
            <span>{events?.length ?? 0} total events</span>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {days.slice(0, 7).map(day => <div key={day.getDay()}>{weekdayFormatter.format(day)}</div>)}
          </div>
          <div className="calendar-grid">
            {days.map(day => {
              const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              return (
                <div className={`calendar-day${isCurrentMonth ? '' : ' calendar-day-muted'}${isSameDay(day, today) ? ' calendar-day-today' : ''}`} key={dateKey(day)}>
                  <div className="calendar-day-number">{day.getDate()}</div>
                  <div className="calendar-events">
                    {dayEvents.map(event => {
                      const eventDate = getEventDate(event);
                      const status = event.status ?? event.Status ?? 'scheduled';
                      return (
                        <Link className={`calendar-event calendar-event-${status}`} to={`/events/${event.gid ?? event.GID}`} key={event.gid ?? event.GID}>
                          <span className="calendar-event-time">{eventDate ? timeFormatter.format(eventDate) : 'Time TBD'}</span>
                          <span className="calendar-event-location">{event.location ?? event.Location ?? 'TBD'}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {!events?.length && (
            <div className="calendar-empty">
              <CalendarDays size={30} />
              <span>No events scheduled yet.</span>
              <Link to="/events">Create one from Events <Clock size={13} /></Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}