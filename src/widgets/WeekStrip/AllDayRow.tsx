import type { CalendarEvent } from '../../entities/event/model/types';
import type { CalendarTask } from '../../entities/task/model/types';
import type { TaskPreset } from '../../entities/presets/model/store';
import { isSameDay } from '../../shared/lib/week';

const ROW_H = 22;

type LayoutItem =
  | { kind: 'event'; event: CalendarEvent; startCol: number; endCol: number; row: number }
  | { kind: 'task'; task: CalendarTask; startCol: number; endCol: number; row: number };

function layoutAll(
  events: CalendarEvent[],
  tasks: CalendarTask[],
  days: Date[],
): LayoutItem[] {
  type Unsorted = Omit<LayoutItem, 'row'>;
  const items: Unsorted[] = [];

  for (const event of events) {
    const startCol = days.findIndex((d) => isSameDay(d, event.start));
    if (startCol === -1) continue;
    let endCol: number;
    if (event.end) {
      const found = days.findIndex((d) => isSameDay(d, event.end!));
      endCol = found === -1 ? days.length : found;
    } else {
      endCol = startCol + 1;
    }
    endCol = Math.max(startCol + 1, Math.min(days.length, endCol));
    items.push({ kind: 'event', event, startCol, endCol });
  }

  for (const task of tasks) {
    const date = task.start ?? task.due;
    if (!date) continue;
    const col = days.findIndex((d) => isSameDay(d, date));
    if (col === -1) continue;
    items.push({ kind: 'task', task, startCol: col, endCol: col + 1 });
  }

  // Sort: earlier start first, wider items first (like all-day events)
  items.sort((a, b) =>
    a.startCol !== b.startCol
      ? a.startCol - b.startCol
      : (b.endCol - b.startCol) - (a.endCol - a.startCol),
  );

  const rowEnds: number[] = [];
  const result: LayoutItem[] = [];
  for (const item of items) {
    let row = rowEnds.findIndex((end) => end <= item.startCol);
    if (row === -1) { row = rowEnds.length; rowEnds.push(0); }
    rowEnds[row] = item.endCol;
    result.push({ ...item, row } as LayoutItem);
  }
  return result;
}

interface Props {
  days: Date[];
  events: CalendarEvent[];
  allDayTasks: CalendarTask[];
  selectedUids: Set<string>;
  selectedTaskUids: Set<string>;
  setSelectedUids: (uids: Set<string>) => void;
  setContextMenu: (m: { x: number; y: number; event: CalendarEvent } | null) => void;
  setViewingEvent: (event: CalendarEvent) => void;
  onTaskContextMenu: (e: React.MouseEvent, task: CalendarTask) => void;
  onToggleTask: (e: React.MouseEvent, uid: string) => void;
  onTaskClick: (task: CalendarTask) => void;
  onTaskShiftClick: (uid: string) => void;
  presetDropPreview: { dropColIdx: number; dropVh: number } | null;
  activeDragPreset: TaskPreset | null;
}

export default function AllDayRow({
  days, events, allDayTasks, selectedUids, selectedTaskUids,
  setSelectedUids, setContextMenu, setViewingEvent,
  onTaskContextMenu, onToggleTask, onTaskClick, onTaskShiftClick,
  presetDropPreview, activeDragPreset,
}: Props) {
  const allDayPresetEvents = presetDropPreview && activeDragPreset
    ? activeDragPreset.events.filter(ev => ev.allDay)
    : [];

  const hasContent = events.length > 0 || allDayTasks.length > 0 || allDayPresetEvents.length > 0;
  if (!hasContent) return null;

  const placed = layoutAll(events, allDayTasks, days);
  const numRows = Math.max(placed.reduce((m, p) => Math.max(m, p.row + 1), 0), allDayPresetEvents.length > 0 ? 1 : 0);
  const containerH = numRows * ROW_H + 4;
  const numCols = days.length;

  return (
    <div className="hidden md:flex shrink-0 border-b border-th-border">
      <div className="w-12 shrink-0" />
      <div className="relative flex-1" style={{ height: containerH }}>
        {placed.map((item) => {
          if (item.kind === 'event') {
            const { event, startCol, endCol, row } = item;
            const isSelected = selectedUids.has(event.uid);
            return (
              <button
                key={event.uid}
                type="button"
                onClick={(e) => {
                  if (e.shiftKey) {
                    const next = new Set(selectedUids);
                    if (next.has(event.uid)) next.delete(event.uid);
                    else next.add(event.uid);
                    setSelectedUids(next);
                  } else {
                    setViewingEvent(event);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, event });
                }}
                style={{
                  position: 'absolute',
                  left: `calc(${(startCol / numCols) * 100}% + 2px)`,
                  width: `calc(${((endCol - startCol) / numCols) * 100}% - 4px)`,
                  top: row * ROW_H + 2,
                  height: ROW_H - 4,
                  backgroundColor: event.calendarColor ?? '#6b7280',
                }}
                className={`rounded-sm px-1.5 flex items-center text-left overflow-hidden cursor-pointer hover:brightness-90 transition-[filter] border-none${isSelected ? ' ring-2 ring-th-accent ring-offset-1 ring-offset-th-bg' : ''}`}
              >
                <span className="text-[11px] font-semibold text-white truncate leading-none">
                  {event.summary}
                </span>
              </button>
            );
          }

          // Task
          const { task, startCol, row } = item;
          const color = task.calendarColor ?? '#9ca3af';
          const bgColor = `color-mix(in srgb, ${color} 25%, transparent)`;
          const isSelected = selectedTaskUids.has(task.uid);
          return (
            <div
              key={task.uid}
              style={{
                position: 'absolute',
                left: `calc(${(startCol / numCols) * 100}% + 2px)`,
                width: `calc(${(1 / numCols) * 100}% - 4px)`,
                top: row * ROW_H + 2,
                height: ROW_H - 4,
                backgroundColor: bgColor,
                border: `2px solid ${color}`,
              }}
              className={`rounded-sm px-1 flex items-center gap-1 overflow-hidden cursor-pointer${isSelected ? ' ring-2 ring-th-accent ring-offset-1 ring-offset-th-bg' : ''}`}
              onContextMenu={(e) => { e.preventDefault(); onTaskContextMenu(e, task); }}
              onClick={(e) => { if (e.shiftKey) onTaskShiftClick(task.uid); else onTaskClick(task); }}
            >
              <button
                className="shrink-0 w-3 h-3 rounded flex items-center justify-center"
                style={{
                  border: `1.5px solid ${color}`,
                  backgroundColor: task.completed ? color : 'transparent',
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleTask(e, task.uid); }}
              >
                {task.completed && (
                  <svg viewBox="0 0 8 8" width="7" height="7" fill="none">
                    <polyline points="1.5,4 3.2,6 6.5,2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span
                className="text-[11px] font-semibold truncate leading-none"
                style={{
                  color,
                  textDecoration: task.completed ? 'line-through' : 'none',
                  opacity: task.completed ? 0.6 : 1,
                }}
              >
                {task.summary}
              </span>
            </div>
          );
        })}

        {/* Preset ghost */}
        {allDayPresetEvents.map((ev, i) => {
          const col = presetDropPreview!.dropColIdx;
          if (col < 0 || col >= numCols) return null;
          const style = {
            position: 'absolute' as const,
            left: `calc(${(col / numCols) * 100}% + 2px)`,
            width: `calc(${(1 / numCols) * 100}% - 4px)`,
            top: numRows * ROW_H + 2,
            height: ROW_H - 4,
          };
          if (ev.type === 'VTODO') {
            const color = ev.calendarColor ?? '#9ca3af';
            return (
              <div
                key={`preset-${i}`}
                style={{
                  ...style,
                  backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                  border: `2px dashed ${color}`,
                  opacity: 0.75,
                }}
                className="rounded-sm px-1.5 flex items-center gap-1 pointer-events-none"
              >
                <div className="shrink-0 w-3 h-3 rounded" style={{ border: `1.5px solid ${color}` }} />
                <span className="text-[11px] font-semibold truncate leading-none" style={{ color }}>{ev.summary}</span>
              </div>
            );
          }
          return (
            <div
              key={`preset-${i}`}
              style={style}
              className="rounded-sm border-2 border-dashed border-th-muted/60 bg-th-subtle/60 px-1.5 flex items-center pointer-events-none"
            >
              <span className="text-[11px] font-semibold text-th-muted truncate leading-none">{ev.summary}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
