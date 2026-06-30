import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useCalendarStore } from '../../entities/calendar/model/store';
import { useTasksStore } from '../../entities/tasks/model/store';
import { useThemeStore } from '../../entities/theme/model/store';
import { getTasks } from '../../shared/lib/getTasks';

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ── progress ring ─────────────────────────────────────────────────────────────

const RING_R = 19;
const RING_CX = 24;
const RING_CY = 24;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈119.38

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const offset = RING_CIRC * (1 - pct);
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0">
      {/* track */}
      <circle
        cx={RING_CX} cy={RING_CY} r={RING_R}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        className="text-th-border"
      />
      {/* progress arc */}
      {total > 0 && (
        <circle
          cx={RING_CX} cy={RING_CY} r={RING_R}
          fill="none"
          stroke="#4ade80"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px' }}
        />
      )}
      {/* center fraction */}
      <text
        x={RING_CX} y={RING_CY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={600}
        fill="currentColor"
        className="text-th-text"
      >
        {done}/{total}
      </text>
    </svg>
  );
}

// ── schedule card ─────────────────────────────────────────────────────────────

function ScheduleCard({
  task,
  onToggle,
}: {
  task: ReturnType<typeof getTasks>[number];
  onToggle: () => void;
}) {
  const d = task.due ?? task.start;
  const hasTime = d && (d.getHours() !== 0 || d.getMinutes() !== 0);
  const timeStr = hasTime
    ? d!.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-start gap-2.5 group">
      {/* time label */}
      <span className="text-[10px] text-th-muted tabular-nums w-[44px] shrink-0 pt-[2px] text-right">
        {timeStr ?? '–'}
      </span>
      {/* card */}
      <div
        className="flex-1 flex items-center gap-2 rounded-[7px] bg-th-subtle border-l-[3px] px-2.5 py-[7px] min-w-0"
        style={{ borderColor: task.calendarColor ?? '#9ca3af' }}
      >
        <span
          className={`flex-1 min-w-0 text-[12px] truncate ${
            task.completed ? 'line-through text-th-muted' : 'text-th-text'
          }`}
        >
          {task.summary}
        </span>
        {/* inline checkbox */}
        <button
          onClick={onToggle}
          className={`w-[15px] h-[15px] rounded-[4px] shrink-0 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-th-accent'
              : 'border border-th-border group-hover:border-th-muted'
          }`}
        >
          {task.completed && <Check size={9} strokeWidth={3} className="text-th-accent-fg" />}
        </button>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  onNewTask: (initialDue: Date) => void;
}

export default function TasksDayPanel({ onNewTask: _onNewTask }: Props) {
  const items = useCalendarStore((s) => s.items);
  const hiddenCalendars = useCalendarStore((s) => s.hiddenCalendars);
  const toggleTaskComplete = useCalendarStore((s) => s.toggleTaskComplete);
  const selectedDate = useTasksStore((s) => s.selectedDate);
  const setSelectedDate = useTasksStore((s) => s.setSelectedDate);
  const sidebarSide = useThemeStore((s) => s.sidebarSide);

  const cw = getISOWeek(selectedDate);

  const allTasks = useMemo(() => getTasks(items), [items]);

  const dayTasks = useMemo(
    () =>
      allTasks.filter((t) => {
        if (hiddenCalendars.has(t.calendarName)) return false;
        const d = t.due ?? t.start;
        return d ? isSameDay(d, selectedDate) : false;
      }),
    [allTasks, hiddenCalendars, selectedDate],
  );

  const sortedDayTasks = useMemo(
    () =>
      [...dayTasks].sort((a, b) => {
        const ta = (a.due ?? a.start)?.getTime() ?? Infinity;
        const tb = (b.due ?? b.start)?.getTime() ?? Infinity;
        return ta - tb;
      }),
    [dayTasks],
  );

  const doneToday = dayTasks.filter((t) => t.completed).length;
  const totalToday = dayTasks.length;

  function prevDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  }

  function nextDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  }

  const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const monthYear = selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className={`w-[296px] shrink-0 hidden md:flex flex-col ${sidebarSide === 'left' ? 'border-r' : 'border-l'} border-th-border bg-th-surface`}>

      {/* Date header */}
      <div className="px-5 pt-5 pb-4 border-b border-th-border">
        <div className="flex items-start justify-between">
          {/* Big date + label */}
          <div className="flex flex-col">
            <span className="text-[52px] font-light leading-none tabular-nums text-th-text">
              {selectedDate.getDate()}
            </span>
            <span className="text-[13px] font-medium text-th-text mt-1 leading-tight">
              {weekday}
            </span>
            <span className="text-[11px] text-th-muted leading-tight">
              {monthYear} · CW {cw}
            </span>
          </div>

          {/* Progress ring */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <ProgressRing done={doneToday} total={totalToday} />
            <span className="text-[10px] text-th-muted text-center leading-tight whitespace-nowrap">
              {doneToday} of {totalToday} done
            </span>
          </div>
        </div>

        {/* Prev/next navigation */}
        <div className="flex items-center gap-1 mt-4">
          <button
            onClick={prevDay}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted hover:text-th-text"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={nextDay}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted hover:text-th-text"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Schedule section */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">
          Schedule
        </span>

        {sortedDayTasks.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-th-muted">
            No tasks for this day
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {sortedDayTasks.map((task) => (
              <ScheduleCard
                key={task.uid}
                task={task}
                onToggle={() => toggleTaskComplete(task.uid)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
