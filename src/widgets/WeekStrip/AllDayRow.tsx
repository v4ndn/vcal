import type { CalendarEvent } from '../../entities/event/model/types';
import type { TaskPreset } from '../../entities/presets/model/store';
import { isSameDay } from '../../shared/lib/week';

const ROW_H = 22;

interface Placed {
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  row: number;
}

function layout(events: CalendarEvent[], days: Date[]): Placed[] {
  const positioned: Omit<Placed, 'row'>[] = [];

  for (const event of events) {
    const startCol = days.findIndex((d) => isSameDay(d, event.start));
    if (startCol === -1) continue;

    let endCol: number;
    if (event.end) {
      const found = days.findIndex((d) => isSameDay(d, event.end!));
      // iCal DTEND for all-day is exclusive (day after last day)
      endCol = found === -1 ? days.length : found;
    } else {
      endCol = startCol + 1;
    }
    endCol = Math.max(startCol + 1, Math.min(days.length, endCol));
    positioned.push({ event, startCol, endCol });
  }

  positioned.sort((a, b) =>
    a.startCol !== b.startCol
      ? a.startCol - b.startCol
      : (b.endCol - b.startCol) - (a.endCol - a.startCol),
  );

  const rowEnds: number[] = [];
  const result: Placed[] = [];
  for (const ev of positioned) {
    let row = rowEnds.findIndex((end) => end <= ev.startCol);
    if (row === -1) { row = rowEnds.length; rowEnds.push(0); }
    rowEnds[row] = ev.endCol;
    result.push({ ...ev, row });
  }
  return result;
}

interface Props {
  days: Date[];
  events: CalendarEvent[];
  selectedUids: Set<string>;
  setSelectedUids: (uids: Set<string>) => void;
  setContextMenu: (m: { x: number; y: number; event: CalendarEvent } | null) => void;
  setViewingEvent: (event: CalendarEvent) => void;
  presetDropPreview: { dropColIdx: number; dropVh: number } | null;
  activeDragPreset: TaskPreset | null;
}

export default function AllDayRow({ days, events, selectedUids, setSelectedUids, setContextMenu, setViewingEvent, presetDropPreview, activeDragPreset }: Props) {
  const allDayPresetEvents = presetDropPreview && activeDragPreset
    ? activeDragPreset.events.filter(ev => ev.allDay)
    : [];
  if (events.length === 0 && allDayPresetEvents.length === 0) return null;

  const placed = layout(events, days);
  const numRows = Math.max(placed.reduce((m, p) => Math.max(m, p.row + 1), 0), allDayPresetEvents.length > 0 ? 1 : 0);
  const containerH = Math.max(numRows, 1) * ROW_H + 4;
  const numCols = days.length;

  return (
    <div className="hidden md:flex shrink-0 border-b border-th-border">
      <div className="w-12 shrink-0" />
      <div className="relative flex-1" style={{ height: containerH }}>
        {placed.map(({ event, startCol, endCol, row }) => {
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
        })}
        {allDayPresetEvents.map((ev, i) => {
          const col = presetDropPreview!.dropColIdx;
          if (col < 0 || col >= numCols) return null;
          return (
            <div
              key={`preset-${i}`}
              style={{
                position: 'absolute',
                left: `calc(${(col / numCols) * 100}% + 2px)`,
                width: `calc(${(1 / numCols) * 100}% - 4px)`,
                top: 2,
                height: ROW_H - 4,
              }}
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
