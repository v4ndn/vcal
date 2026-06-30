import { Fragment, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarStore } from '../../entities/calendar/model/store';
import { useUIStore } from '../../entities/ui/model/store';
import { expandItems } from '../../shared/lib/expandItems';
import { isSameDay } from '../../shared/lib/week';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getMondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function buildGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const origin = new Date(year, month, 1 - first.getDay());
  origin.setHours(0, 0, 0, 0);
  return Array.from({ length: 6 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(origin);
      d.setDate(origin.getDate() + wi * 7 + di);
      return d;
    })
  );
}

function weekOffsetFor(date: Date): number {
  const todayMon = getMondayOf(new Date());
  const dateMon = getMondayOf(date);
  return Math.round((dateMon.getTime() - todayMon.getTime()) / (7 * 86400000));
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface MiniCalendarProps {
  onDayClick?: (date: Date) => void;
}

export default function MiniCalendar({ onDayClick }: MiniCalendarProps = {}) {
  const today = new Date();
  const [open, setOpen] = useState(true);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const items = useCalendarStore((s) => s.items);
  const hiddenCalendars = useCalendarStore((s) => s.hiddenCalendars);
  const setWeekOffset = useCalendarStore((s) => s.setWeekOffset);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const grid = useMemo(() => buildGrid(view.year, view.month), [view.year, view.month]);

  const eventDates = useMemo(() => {
    const seen = new Set<number>();
    const dates = new Set<string>();
    for (const week of grid) {
      const offset = weekOffsetFor(week[1]); // week[1] = Monday in Sunday-first layout
      if (seen.has(offset)) continue;
      seen.add(offset);
      for (const ev of expandItems(items, offset)) {
        if (!hiddenCalendars.has(ev.calendarName)) {
          dates.add(localDateKey(ev.start));
        }
      }
    }
    return dates;
  }, [items, hiddenCalendars, grid]);

  const prevMonth = () => setView(v =>
    v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }
  );
  const nextMonth = () => setView(v =>
    v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }
  );
  const prevYear = () => setView(v => ({ ...v, year: v.year - 1 }));
  const nextYear = () => setView(v => ({ ...v, year: v.year + 1 }));

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    new Date(view.year, view.month, 1)
  );

  return (
    <div className="px-2">
      {/* Section toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-th-hover transition-colors group"
      >
        <CalendarDays size={12} className="text-th-muted shrink-0" />
        <span className="flex-1 text-[9px] font-semibold uppercase tracking-widest text-th-muted text-left">
          Calendar
        </span>
        <ChevronDown
          size={11}
          className={`text-th-muted/50 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-0.5 pb-1 px-1">
              {/* Month + year navigation */}
              <div className="flex items-center gap-1 mb-1.5">
                <div className="flex items-center gap-0.5 flex-1 min-w-0">
                  <button
                    onClick={prevMonth}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-th-muted hover:text-th-text hover:bg-th-hover transition-colors shrink-0"
                  >
                    <ChevronLeft size={11} />
                  </button>
                  <span className="flex-1 text-center text-[11px] font-semibold text-th-text truncate">
                    {monthLabel}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-th-muted hover:text-th-text hover:bg-th-hover transition-colors shrink-0"
                  >
                    <ChevronRight size={11} />
                  </button>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={prevYear}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-th-muted hover:text-th-text hover:bg-th-hover transition-colors"
                  >
                    <ChevronLeft size={11} />
                  </button>
                  <span className="text-[11px] font-semibold text-th-text w-9 text-center tabular-nums">
                    {view.year}
                  </span>
                  <button
                    onClick={nextYear}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-th-muted hover:text-th-text hover:bg-th-hover transition-colors"
                  >
                    <ChevronRight size={11} />
                  </button>
                </div>
              </div>

              {/* Day-of-week headers + date grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '18px repeat(7, 1fr)' }}>
                <div />
                {DOW.map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-semibold text-th-muted/60 pb-0.5">
                    {d}
                  </div>
                ))}

                {grid.map((week, wi) => {
                  const isoWeek = getISOWeek(week[1]);
                  return (
                    <Fragment key={wi}>
                      <div className="flex items-start justify-end pr-1 pt-1.5">
                        <span className="text-[8px] text-th-muted/40 leading-none tabular-nums">{isoWeek}</span>
                      </div>
                      {week.map((day, di) => {
                        const isToday = isSameDay(day, today);
                        const isCurrentMonth = day.getMonth() === view.month;
                        const hasEvents = eventDates.has(localDateKey(day));
                        return (
                          <button
                            key={di}
                            onClick={() => {
                              if (onDayClick) {
                                onDayClick(day);
                              } else {
                                setWeekOffset(weekOffsetFor(day));
                                setSidebarOpen(false);
                              }
                            }}
                            className="flex flex-col items-center py-0.5 rounded-md hover:bg-th-hover transition-colors"
                          >
                            <span
                              className={`text-[10px] leading-none w-5 h-5 flex items-center justify-center rounded-full${
                                isToday
                                  ? ' bg-th-accent text-th-accent-fg font-semibold'
                                  : isCurrentMonth
                                    ? ' text-th-text'
                                    : ' text-th-muted/35'
                              }`}
                            >
                              {day.getDate()}
                            </span>
                            <span
                              className={`w-1 h-1 rounded-full mt-0.5 ${
                                hasEvents
                                  ? isToday
                                    ? 'bg-th-accent-fg/60'
                                    : 'bg-th-muted/50'
                                  : 'invisible'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
