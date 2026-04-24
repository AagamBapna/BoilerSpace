import { useMemo } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function toLocalDate(value) {
  const key = toDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfMonthGrid(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
  const offset = firstDay.getDay();
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - offset);
  return start;
}

function buildMonthGrid(date) {
  const cells = [];
  const start = startOfMonthGrid(date);
  const cursor = new Date(start);
  for (let index = 0; index < 42; index += 1) {
    cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

export default function ClubCalendar({ events = [], monthDate, onMonthChange, onEventClick, loading }) {
  const monthGrid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map();
    for (const event of events) {
      const key = toDateKey(event.date);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    }
    grouped.forEach((list) => {
      list.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    });
    return grouped;
  }, [events]);

  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const shiftMonth = (direction) => {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1, 12, 0, 0, 0);
    onMonthChange(next);
  };

  return (
    <section className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)] mb-1">Calendar</p>
          <h2 className="text-xl font-bold">Monthly View</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="profile-button-like px-3 py-2 text-sm"
          >
            Prev
          </button>
          <span className="text-sm text-[var(--color-text-secondary)] min-w-[150px] text-center">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="profile-button-like px-3 py-2 text-sm"
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading calendar...</p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="text-[11px] uppercase tracking-widest text-[var(--color-text-secondary)] px-2 pb-1">
              {weekday}
            </div>
          ))}

          {monthGrid.map((day) => {
            const key = toDateKey(day);
            const dayEvents = eventsByDate.get(key) || [];
            const hasEvents = dayEvents.length > 0;
            const isCurrentMonth = day.getMonth() === monthDate.getMonth();
            return (
              <div
                key={key}
                className={`min-h-[110px] rounded-xl border p-2 flex flex-col gap-2 transition-colors ${isCurrentMonth
                  ? hasEvents
                    ? 'border-[var(--color-purdue-gold)]/40 bg-[var(--color-purdue-gold)]/8 shadow-[0_0_0_1px_rgba(206,184,136,0.18)]'
                    : 'border-white/10 bg-white/5'
                  : 'border-white/5 bg-white/[0.02] opacity-45'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">{day.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <span
                      className="min-w-[28px] text-center text-[10px] rounded-full bg-[var(--color-purdue-gold)] text-black px-2.5 py-0.5 font-semibold"
                      title={`${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'} on this day`}
                      aria-label={`${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'} on this day`}
                    >
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, 4).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      className="text-left rounded-lg px-2 py-1.5 bg-gradient-to-r from-[var(--color-purdue-gold)]/22 to-[var(--color-purdue-rush)]/14 hover:from-[var(--color-purdue-gold)]/30 hover:to-[var(--color-purdue-rush)]/20 transition-colors border border-[var(--color-purdue-gold)]/30 shadow-sm"
                    >
                      <p className="text-[11px] font-semibold text-[var(--color-text-primary)] truncate">{event.title}</p>
                      {event.time && <p className="text-[10px] text-[var(--color-text-secondary)] truncate">{event.time}</p>}
                      {event.recurrence?.type && event.recurrence.type !== 'none' && (
                        <p className="text-[10px] text-[var(--color-purdue-gold)] font-medium truncate">Repeats {event.recurrence.type}</p>
                      )}
                    </button>
                  ))}
                  {dayEvents.length > 4 && (
                    <p className="text-[10px] text-[var(--color-text-secondary)] px-1">+{dayEvents.length - 4} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
