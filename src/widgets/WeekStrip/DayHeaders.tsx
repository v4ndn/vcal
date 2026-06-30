import { isSameDay } from '../../shared/lib/week';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DayHeadersProps {
  days: Date[];
  today: Date;
}

export default function DayHeaders({ days, today }: DayHeadersProps) {
  return (
    <div className="hidden md:flex shrink-0 border-b border-th-border">
      <div className="w-12 shrink-0" />
      <div className="flex flex-1">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className="flex-1 flex flex-col items-center py-2">
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? 'text-th-text' : 'text-th-muted'}`}>
                {DAY_NAMES[i]}
              </span>
              <span className={`text-base font-bold leading-none mt-1 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-th-accent text-th-accent-fg' : 'text-th-text'}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
