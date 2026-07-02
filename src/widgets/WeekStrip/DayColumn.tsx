import type { MutableRefObject } from 'react';
import type { CalendarEvent } from '../../entities/event/model/types';
import type { CalendarTask } from '../../entities/task/model/types';
import type { TaskPreset } from '../../entities/presets/model/store';
import { isSameDay } from '../../shared/lib/week';
import { layoutDayEvents } from '../../shared/lib/layoutEvents';
import type { DragActive, DragSnapshot, CreateSnap } from './types';
import EventBlock from './EventBlock';
import TaskBlock from './TaskBlock';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface DayColumnProps {
  day: Date;
  colIdx: number;
  isToday: boolean;
  now: Date;
  days: Date[];
  dayEvents: CalendarEvent[];
  dayTasks: CalendarTask[];
  selectedUids: Set<string>;
  HOUR_HEIGHT: number;
  SNAP_VH: number;
  timeToVh: (d: Date) => number;
  durationToVh: (s: Date, e: Date) => number;
  vhToDate: (v: number, d: Date) => Date;
  dragSnap: DragSnapshot | null;
  activeDragRef: MutableRefObject<DragActive | null>;
  createSnap: CreateSnap | null;
  presetDropPreview: { dropColIdx: number; dropVh: number } | null;
  activeDragPreset: TaskPreset | null;
  onPointerDown: (e: React.PointerEvent) => void;
  startMove: (e: React.PointerEvent, event: CalendarEvent, colIdx: number) => void;
  startMoveTouch: (e: React.PointerEvent, event: CalendarEvent, colIdx: number) => void;
  startResize: (e: React.PointerEvent, event: CalendarEvent, colIdx: number) => void;
  setContextMenu: (m: { x: number; y: number; event: CalendarEvent } | null) => void;
  selectedTaskUids: Set<string>;
  onToggleTask: (e: React.MouseEvent, uid: string) => void;
  onTaskContextMenu: (e: React.MouseEvent, task: CalendarTask) => void;
  startMoveTask: (e: React.PointerEvent, task: CalendarTask, colIdx: number) => void;
}

export default function DayColumn({
  day, colIdx, isToday, now, days, dayEvents, dayTasks, selectedUids,
  HOUR_HEIGHT, SNAP_VH, timeToVh, durationToVh, vhToDate,
  dragSnap, activeDragRef, createSnap, presetDropPreview, activeDragPreset,
  onPointerDown, startMove, startMoveTouch, startResize, setContextMenu,
  selectedTaskUids, onToggleTask, onTaskContextMenu, startMoveTask,
}: DayColumnProps) {
  const currentDrag = activeDragRef.current;
  const layout = layoutDayEvents(dayEvents);

  return (
    <div
      className="flex-1 relative border-l border-th-border min-w-0"
      onPointerDown={onPointerDown}
    >
      {/* Hour grid lines */}
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-th-border"
          style={{ top: `${h * HOUR_HEIGHT}vh` }}
        />
      ))}

      {/* Current time indicator */}
      {isToday && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: `${timeToVh(now)}vh` }}
        >
          <div className="h-px bg-th-accent/40" />
        </div>
      )}

      {/* Creation drag ghost */}
      {createSnap?.dayIndex === colIdx && (
        <div
          className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 z-30 pointer-events-none border-2 border-dashed border-th-muted/60 bg-th-subtle/90"
          style={{
            top: `${createSnap.startVh}vh`,
            height: `${createSnap.endVh - createSnap.startVh}vh`,
            minHeight: '1.25rem',
          }}
        >
          <div className="text-[9px] text-th-muted font-medium">
            {vhToDate(createSnap.startVh, day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {vhToDate(createSnap.endVh, day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* Drag ghost — single event */}
      {dragSnap?.dayIndex === colIdx && !currentDrag?.isGroupDrag && (
        <div
          className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 z-30 pointer-events-none ring-2 ring-white/50 opacity-90"
          style={{
            top: `${dragSnap.startVh}vh`,
            height: `${dragSnap.endVh - dragSnap.startVh}vh`,
            minHeight: '1.25rem',
            backgroundColor: dragSnap.color ?? '#9ca3af',
          }}
        >
          <div className="text-[11px] font-semibold text-white leading-tight truncate">
            {dragSnap.summary}
          </div>
          <div className="text-[9px] text-white/70 leading-none mt-0.5">
            {vhToDate(dragSnap.startVh, day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {vhToDate(dragSnap.endVh, day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* Drag ghosts — group drag */}
      {currentDrag?.isGroupDrag && dragSnap && (() => {
        const vhDelta = dragSnap.startVh - currentDrag.anchorStartVh;
        const colDelta = dragSnap.dayIndex - currentDrag.anchorColIndex;
        return currentDrag.groupEvents
          .filter((ev) => {
            const evDayIdx = days.findIndex((d) => isSameDay(d, ev.start));
            return Math.max(0, Math.min(6, evDayIdx + colDelta)) === colIdx;
          })
          .map((ev) => {
            const evStartVh = timeToVh(ev.start);
            const evDurVh = ev.end ? durationToVh(ev.start, ev.end) : HOUR_HEIGHT;
            const evNewStartVh = Math.max(0, Math.min(24 * HOUR_HEIGHT - SNAP_VH, evStartVh + vhDelta));
            const evNewEndVh = Math.min(24 * HOUR_HEIGHT, evNewStartVh + evDurVh);
            return (
              <div
                key={ev.uid}
                className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 z-30 pointer-events-none ring-2 ring-white/50 opacity-90"
                style={{
                  top: `${evNewStartVh}vh`,
                  height: `${evNewEndVh - evNewStartVh}vh`,
                  minHeight: '1.25rem',
                  backgroundColor: ev.calendarColor ?? '#9ca3af',
                }}
              >
                <div className="text-[11px] font-semibold text-white leading-tight truncate">
                  {ev.summary}
                </div>
                <div className="text-[9px] text-white/70 leading-none mt-0.5">
                  {vhToDate(evNewStartVh, day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {vhToDate(evNewEndVh, day).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          });
      })()}

      {/* Preset drop preview ghosts */}
      {presetDropPreview && activeDragPreset && (() => {
        const firstTimedOffset = activeDragPreset.events.find(ev => !ev.allDay)?.offsetMs ?? 0;
        const anchorTimeMs = (presetDropPreview.dropVh / HOUR_HEIGHT) * 3_600_000;
        return activeDragPreset.events.filter(ev => !ev.allDay).map((ev, i) => {
          const evTotalMs = anchorTimeMs + (ev.offsetMs - firstTimedOffset);
          const evDayOffset = Math.floor(evTotalMs / 86_400_000);
          const evTimeMs = evTotalMs % 86_400_000;
          if (presetDropPreview.dropColIdx + evDayOffset !== colIdx) return null;
          const evStartVh = (evTimeMs / 3_600_000) * HOUR_HEIGHT;
          const evDurVh = Math.max((ev.durationMs / 3_600_000) * HOUR_HEIGHT, SNAP_VH);
          const cStart = Math.max(0, Math.min(24 * HOUR_HEIGHT - SNAP_VH, evStartVh));
          const cEnd = Math.min(24 * HOUR_HEIGHT, cStart + evDurVh);
          return (
            <div
              key={i}
              className="absolute left-0.5 right-0.5 rounded-md z-30 pointer-events-none border-2 border-dashed border-th-muted/60 bg-th-subtle/60"
              style={{ top: `${cStart}vh`, height: `${cEnd - cStart}vh`, minHeight: '1.25rem' }}
            >
              <div className="text-[11px] font-semibold text-th-muted px-1.5 py-1 truncate">{ev.summary}</div>
            </div>
          );
        });
      })()}

      {/* Tasks */}
      {dayTasks.map((task) => {
        const top = task.start ? timeToVh(task.start) : 0;
        const isTaskDragging = dragSnap?.eventUid === task.uid;
        return (
          <TaskBlock
            key={task.uid}
            task={task}
            top={top}
            height={HOUR_HEIGHT / 2}
            isSelected={selectedTaskUids.has(task.uid)}
            isDragging={isTaskDragging}
            onToggle={(e) => onToggleTask(e, task.uid)}
            onContextMenu={(e) => { e.preventDefault(); onTaskContextMenu(e, task); }}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') { startMoveTask(e, task, colIdx); return; }
              startMoveTask(e, task, colIdx);
            }}
          />
        );
      })}

      {/* Events */}
      {dayEvents.map((event, j) => {
        const top = timeToVh(event.start);
        const height = event.end ? durationToVh(event.start, event.end) : HOUR_HEIGHT;
        const isAnchorDragging = dragSnap?.eventUid === event.uid;
        const isGroupMemberDragging =
          dragSnap !== null && currentDrag?.isGroupDrag === true &&
          currentDrag.groupEvents.some((g) => g.uid === event.uid);
        return (
          <EventBlock
            key={event.uid + j}
            event={event}
            top={top}
            height={height}
            col={layout.get(event.uid)?.col ?? 0}
            numCols={layout.get(event.uid)?.numCols ?? 1}
            isDragging={isAnchorDragging || isGroupMemberDragging}
            isSelected={selectedUids.has(event.uid)}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') { startMoveTouch(e, event, colIdx); return; }
              startMove(e, event, colIdx);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, event });
            }}
            onResizeStart={(e) => startResize(e, event, colIdx)}
          />
        );
      })}
    </div>
  );
}
