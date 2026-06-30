import { Menu } from 'lucide-react';
import { isSameDay } from '../../shared/lib/week';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatWeekLabel(days: Date[]): string {
  const s = days[0], e = days[6];
  if (s.getMonth() === e.getMonth()) {
    return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return (
    s.toLocaleDateString('en-US', { month: 'short' }) +
    ' – ' +
    e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  );
}

interface TopBarProps {
  days: Date[];
  weekOffset: number;
  mobileDayIndex: number;
  loading: boolean;
  today: Date;
  setSidebarOpen: (open: boolean) => void;
  setWeekOffset: (offset: number) => void;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
}

export default function TopBar({
  days, weekOffset, mobileDayIndex, loading, today,
  setSidebarOpen, setWeekOffset, goToPrevDay, goToNextDay, goToToday,
}: TopBarProps) {
  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="flex items-center border-b border-th-border shrink-0 h-[49px] px-2 gap-1">

      {/* Mobile: hamburger + day nav */}
      <div className="flex md:hidden items-center w-full gap-1">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted"
        >
          <Menu size={16} />
        </button>
        <button
          onClick={goToPrevDay}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted"
        >‹</button>
        <div className="flex-1 flex flex-col items-center">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-th-muted">
            {DAY_NAMES[mobileDayIndex]}
          </span>
          <span className="text-sm font-bold text-th-text leading-tight">
            {days[mobileDayIndex]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <button
          onClick={goToNextDay}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted"
        >›</button>
        {!isSameDay(days[mobileDayIndex], today) && (
          <button
            onClick={goToToday}
            className="px-2 h-8 text-xs font-medium rounded-lg hover:bg-th-subtle transition-colors text-th-muted"
          >Today</button>
        )}
      </div>

      {/* Desktop: week label + nav */}
      <div className="hidden md:flex items-center justify-between w-full px-2">
        <span className="text-base font-bold tracking-tight w-40 text-th-text">
          {formatWeekLabel(days)}
        </span>
        <div className="flex items-center gap-1">
          {loading && <span className="text-xs text-th-muted animate-pulse mr-2">Loading…</span>}
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted hover:text-th-text"
          >‹</button>
          <button
            onClick={isCurrentWeek ? undefined : goToToday}
            className={`px-2.5 h-8 text-xs font-medium rounded-lg transition-colors ${
              isCurrentWeek
                ? 'text-th-muted/40 cursor-default'
                : 'text-th-muted hover:text-th-text hover:bg-th-subtle cursor-pointer'
            }`}
          >Today</button>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-th-subtle transition-colors text-th-muted hover:text-th-text"
          >›</button>
        </div>
      </div>

    </div>
  );
}
