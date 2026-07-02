import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useCalendarStore } from '../../entities/calendar/model/store';
import type { CalendarEvent } from '../../entities/event/model/types';
import type { CalendarTask } from '../../entities/task/model/types';
import { getTasks } from '../../shared/lib/getTasks';
import { getWeekDays, isSameDay } from '../../shared/lib/week';
import { usePresetsStore } from '../../entities/presets/model/store';
import { registerWeekGrid } from '../../shared/lib/weekGridRef';
import { useIsMobile } from '../../shared/lib/useIsMobile';
import { useUIStore } from '../../entities/ui/model/store';
import { useThemeStore } from '../../entities/theme/model/store';
import EventActionsMenu from '../EventActionsMenu/EventActionsMenu';
import TaskActionsMenu from '../TaskActionsMenu/TaskActionsMenu';
import EventTaskModal from '../EventTaskModal/EventTaskModal';
import EventOverviewModal from '../EventOverviewModal/EventOverviewModal';
import TopBar from './TopBar';
import DayHeaders from './DayHeaders';
import AllDayRow from './AllDayRow';
import DayColumn from './DayColumn';
import RecurringScopeModal from './RecurringScopeModal';
import { createDragHandlers, taskToEvent } from './dragHandlers';
import type { DragActive, DragSnapshot, CreateSnap, PendingDrop } from './types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekStrip() {
  const allEvents = useCalendarStore((s) => s.events);
  const allItems = useCalendarStore((s) => s.items);
  const hiddenCalendars = useCalendarStore((s) => s.hiddenCalendars);
  const toggleTaskComplete = useCalendarStore((s) => s.toggleTaskComplete);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const deleteTasks = useCalendarStore((s) => s.deleteTasks);
  const visibleEvents = allEvents.filter((e) => !hiddenCalendars.has(e.calendarName));
  const allDayEvents = visibleEvents.filter((e) => e.allDay);
  const events = visibleEvents.filter((e) => !e.allDay);
  const updateTaskDetails = useCalendarStore((s) => s.updateTaskDetails);
  const allTasks = useMemo(() => getTasks(allItems), [allItems]);
  const visibleTasks = useMemo(
    () => allTasks.filter((t) => !hiddenCalendars.has(t.calendarName)),
    [allTasks, hiddenCalendars],
  );
  const timedTasks = useMemo(
    () => visibleTasks.filter((t) => t.start != null && !t.allDay),
    [visibleTasks],
  );
  const allDayTasks = useMemo(
    () => visibleTasks.filter((t) => t.allDay && (t.start != null || t.due != null)),
    [visibleTasks],
  );
  const weekOffset = useCalendarStore((s) => s.weekOffset);
  const setWeekOffset = useCalendarStore((s) => s.setWeekOffset);
  const loading = useCalendarStore((s) => s.loading);
  const updateEventTime = useCalendarStore((s) => s.updateEventTime);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const deleteEvents = useCalendarStore((s) => s.deleteEvents);
  const createEvent = useCalendarStore((s) => s.createEvent);

  const isMobile = useIsMobile();
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const HOUR_HEIGHT = useThemeStore((s) => s.hourHeight);
  const calendarHeaderBottom = useThemeStore((s) => s.calendarHeaderBottom);
  const SNAP_VH = HOUR_HEIGHT / 4;

  const timeToVh = (date: Date) => (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;
  const durationToVh = (start: Date, end: Date) =>
    Math.max((end.getTime() - start.getTime()) / 3_600_000 * HOUR_HEIGHT, 2.5);
  const snapVh = (vh: number) => Math.round(vh / SNAP_VH) * SNAP_VH;
  const vhToDate = (vh: number, day: Date): Date => {
    const totalMinutes = Math.round((vh / HOUR_HEIGHT) * 60);
    const d = new Date(day);
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return d;
  };

  const scrollRef = useRef<HTMLDivElement>(null!);
  const today = new Date();
  const days = getWeekDays(weekOffset);
  const [now, setNow] = useState(() => new Date());
  const prevOffset = useRef(weekOffset);

  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    const idx = getWeekDays(0).findIndex((d) => isSameDay(d, new Date()));
    return idx >= 0 ? idx : 0;
  });
  const mobileDayIndexRef = useRef(mobileDayIndex);
  useEffect(() => { mobileDayIndexRef.current = mobileDayIndex; }, [mobileDayIndex]);
  const isMobileRef = useRef(isMobile);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);
  const visibleDays = isMobile ? [days[mobileDayIndex]] : days;

  function goToPrevDay() {
    if (mobileDayIndex > 0) { setMobileDayIndex((i) => i - 1); }
    else { setWeekOffset(weekOffset - 1); setMobileDayIndex(6); }
  }
  function goToNextDay() {
    if (mobileDayIndex < 6) { setMobileDayIndex((i) => i + 1); }
    else { setWeekOffset(weekOffset + 1); setMobileDayIndex(0); }
  }
  function goToToday() {
    setWeekOffset(0);
    const idx = getWeekDays(0).findIndex((d) => isSameDay(d, new Date()));
    setMobileDayIndex(idx >= 0 ? idx : 0);
  }

  const activeDrag = useRef<DragActive | null>(null);
  const [dragSnap, setDragSnap] = useState<DragSnapshot | null>(null);
  const dragSnapRef = useRef<DragSnapshot | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const selectedUids = usePresetsStore((s) => s.selectedUids);
  const setSelectedUids = usePresetsStore((s) => s.setSelectedUids);
  const selectedTaskUids = usePresetsStore((s) => s.selectedTaskUids);
  const setSelectedTaskUids = usePresetsStore((s) => s.setSelectedTaskUids);
  const clipboard = usePresetsStore((s) => s.clipboard);
  const setClipboard = usePresetsStore((s) => s.setClipboard);
  const activeDragPreset = usePresetsStore((s) => s.activeDragPreset);
  const [presetDropPreview, setPresetDropPreview] = useState<{ dropColIdx: number; dropVh: number } | null>(null);
  const presetDropPreviewRef = useRef<{ dropColIdx: number; dropVh: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null);
  const [taskContextMenu, setTaskContextMenu] = useState<{ x: number; y: number; task: CalendarTask } | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null);
  const createDragRef = useRef<CreateSnap | null>(null);
  const [createSnap, setCreateSnap] = useState<CreateSnap | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ start: Date; end: Date } | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchContextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldPreventScrollRef = useRef(false);

  const updateTaskTime = useCallback(async (uid: string, newStart: Date, newDue: Date | undefined) => {
    const task = allTasks.find((t) => t.uid === uid);
    if (!task) return;
    await updateTaskDetails(uid, {
      summary: task.summary,
      start: newStart,
      due: newDue,
      description: task.description ?? '',
      rrule: '',
      reminders: [],
      allDay: false,
    });
  }, [allTasks, updateTaskDetails]);

  const { startMove, startResize, startCreate, startMoveTouch, startCreateTouch } = createDragHandlers({
    scrollRef,
    activeDrag,
    dragSnapRef,
    createDragRef,
    shouldPreventScrollRef,
    touchTimerRef,
    touchContextTimerRef,
    isMobileRef,
    mobileDayIndexRef,
    days,
    events,
    timedTasks,
    selectedUids,
    selectedTaskUids,
    HOUR_HEIGHT,
    SNAP_VH,
    timeToVh,
    durationToVh,
    snapVh,
    vhToDate,
    setDragSnap,
    setCreateSnap,
    setSelectedUids,
    setSelectedTaskUids,
    setViewingEvent,
    setPendingDrop,
    setContextMenu,
    setPendingCreate,
    updateEventTime,
    updateTaskTime,
  });

  const startMoveTask = useCallback((e: React.PointerEvent, task: CalendarTask, colIdx: number) => {
    const taskAsEvent = taskToEvent(task);
    if (e.pointerType === 'touch') { startMoveTouch(e, taskAsEvent, colIdx); return; }
    startMove(e, taskAsEvent, colIdx);
  }, [startMove, startMoveTouch]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const lastNav = { t: 0 };
    function onWheel(e: WheelEvent) {
      if (!e.shiftKey) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastNav.t < 400) return;
      lastNav.t = now;
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      const { weekOffset: off } = useCalendarStore.getState();
      setWeekOffset(delta < 0 ? off - 1 : off + 1);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    function blockScroll(e: TouchEvent) {
      if (shouldPreventScrollRef.current) e.preventDefault();
    }
    window.addEventListener('touchmove', blockScroll, { passive: false });
    return () => window.removeEventListener('touchmove', blockScroll);
  }, []);

  useEffect(() => {
    registerWeekGrid(scrollRef.current);
    return () => registerWeekGrid(null);
  });

  useEffect(() => {
    if (!activeDragPreset) {
      presetDropPreviewRef.current = null;
      setPresetDropPreview(null);
      return;
    }
    function onMove(e: PointerEvent) {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) {
        if (presetDropPreviewRef.current !== null) {
          presetDropPreviewRef.current = null;
          setPresetDropPreview(null);
        }
        return;
      }
      const gutterPx = 48;
      const numCols = isMobileRef.current ? 1 : 7;
      const colW = (rect.width - gutterPx) / numCols;
      const dropColIdx = isMobileRef.current
        ? mobileDayIndexRef.current
        : Math.max(0, Math.min(6, Math.floor((e.clientX - rect.left - gutterPx) / colW)));
      const dropVh = Math.round(
        (((e.clientY - rect.top + el.scrollTop) / window.innerHeight) * 100) / SNAP_VH,
      ) * SNAP_VH;
      const prev = presetDropPreviewRef.current;
      if (!prev || prev.dropColIdx !== dropColIdx || prev.dropVh !== dropVh) {
        presetDropPreviewRef.current = { dropColIdx, dropVh };
        setPresetDropPreview({ dropColIdx, dropVh });
      }
    }
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [activeDragPreset]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (weekOffset === 0) {
      const t = new Date();
      scrollRef.current.scrollTop =
        (Math.max(t.getHours() - 1, 0) * HOUR_HEIGHT / 100) * window.innerHeight;
    } else if (prevOffset.current !== weekOffset) {
      scrollRef.current.scrollTop = 0;
    }
    prevOffset.current = weekOffset;
  }, [weekOffset]);

  const handleToggleTask = useCallback((e: React.MouseEvent, uid: string) => {
    e.stopPropagation();
    toggleTaskComplete(uid).catch(console.error);
  }, [toggleTaskComplete]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedUids(new Set());
        setSelectedTaskUids(new Set());
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel = events.filter((ev) => selectedUids.has(ev.uid));
        if (sel.length) setClipboard(sel);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        clipboard.forEach((ev) => createEvent(ev));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [events, selectedUids, clipboard, createEvent, setSelectedTaskUids]);

  return (
    <div className={`flex ${calendarHeaderBottom ? 'flex-col-reverse' : 'flex-col'} h-full bg-th-bg select-none`}>

      <TopBar
        days={days}
        weekOffset={weekOffset}
        mobileDayIndex={mobileDayIndex}
        loading={loading}
        today={today}
        setSidebarOpen={setSidebarOpen}
        setWeekOffset={setWeekOffset}
        goToPrevDay={goToPrevDay}
        goToNextDay={goToNextDay}
        goToToday={goToToday}
      />

      <DayHeaders
        days={days}
        today={today}
      />

      <AllDayRow
        days={days}
        events={allDayEvents}
        allDayTasks={allDayTasks}
        selectedUids={selectedUids}
        selectedTaskUids={selectedTaskUids}
        setSelectedUids={setSelectedUids}
        setContextMenu={setContextMenu}
        setViewingEvent={setViewingEvent}
        onTaskContextMenu={(e, task) => setTaskContextMenu({ x: e.clientX, y: e.clientY, task })}
        onToggleTask={handleToggleTask}
        onTaskClick={(task) => setViewingEvent(taskToEvent(task))}
        onTaskShiftClick={(uid) => setSelectedTaskUids((prev) => {
          const next = new Set(prev);
          if (next.has(uid)) next.delete(uid); else next.add(uid);
          return next;
        })}
        presetDropPreview={presetDropPreview}
        activeDragPreset={activeDragPreset}
      />

      {pendingDrop && (
        <RecurringScopeModal
          title="Recurring event"
          eventSummary={pendingDrop.event.summary}
          subtitle={`${pendingDrop.newStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${pendingDrop.newEnd ? ` – ${pendingDrop.newEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          confirmLabel="This event only"
          confirmAllLabel="All events in series"
          onConfirm={(scope) => {
            const { event, newStart, newEnd } = pendingDrop;
            setPendingDrop(null);
            updateEventTime(event, newStart, newEnd, scope);
          }}
          onCancel={() => setPendingDrop(null)}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="flex"
          style={{ height: `${24 * HOUR_HEIGHT}vh` }}
        >
            {/* Hour gutter */}
            <div className="w-12 shrink-0 relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 text-[9px] text-th-muted font-medium leading-none"
                  style={{ top: `calc(${h * HOUR_HEIGHT}vh - 0.45em)` }}
                >
                  {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {visibleDays.map((day, i) => {
              const colIdx = isMobile ? mobileDayIndex : i;
              const dayEvents = events.filter((e) => isSameDay(e.start, day));
              const dayTasks = timedTasks.filter((t) => t.start && isSameDay(t.start, day));
              return (
                <DayColumn
                  key={colIdx}
                  day={day}
                  colIdx={colIdx}
                  isToday={isSameDay(day, today)}
                  now={now}
                  days={days}
                  dayEvents={dayEvents}
                  dayTasks={dayTasks}
                  selectedUids={selectedUids}
                  HOUR_HEIGHT={HOUR_HEIGHT}
                  SNAP_VH={SNAP_VH}
                  timeToVh={timeToVh}
                  durationToVh={durationToVh}
                  vhToDate={vhToDate}
                  dragSnap={dragSnap}
                  activeDragRef={activeDrag}
                  createSnap={createSnap}
                  presetDropPreview={presetDropPreview}
                  activeDragPreset={activeDragPreset}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') { startCreateTouch(e, colIdx); return; }
                    setSelectedUids(new Set());
                    setSelectedTaskUids(new Set());
                    startCreate(e, colIdx);
                  }}
                  startMove={startMove}
                  startMoveTouch={startMoveTouch}
                  startResize={startResize}
                  setContextMenu={setContextMenu}
                  selectedTaskUids={selectedTaskUids}
                  onToggleTask={handleToggleTask}
                  onTaskContextMenu={(e, task) => setTaskContextMenu({ x: e.clientX, y: e.clientY, task })}
                  startMoveTask={startMoveTask}
                />
              );
            })}
        </div>
        <div className="h-14 md:h-0" />
      </div>

      <AnimatePresence>
        {contextMenu && (
          <EventActionsMenu
            x={contextMenu.x}
            y={contextMenu.y}
            event={contextMenu.event}
            selectedCount={selectedUids.has(contextMenu.event.uid) ? selectedUids.size : 1}
            onClose={() => setContextMenu(null)}
            onEdit={() => setEditingEvent(contextMenu.event)}
            onDelete={() => {
              const ev = contextMenu.event;
              if (ev.uid !== ev.baseUid) setPendingDelete(ev);
              else deleteEvent(ev, 'all');
            }}
            onDeleteAll={() => {
              const toDelete = visibleEvents.filter((ev) => selectedUids.has(ev.uid));
              setSelectedUids(new Set());
              deleteEvents(toDelete);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {taskContextMenu && (
          <TaskActionsMenu
            x={taskContextMenu.x}
            y={taskContextMenu.y}
            task={taskContextMenu.task}
            selectedCount={selectedTaskUids.has(taskContextMenu.task.uid) ? selectedTaskUids.size : 1}
            onClose={() => setTaskContextMenu(null)}
            onToggleComplete={() => {
              toggleTaskComplete(taskContextMenu.task.uid).catch(console.error);
              setTaskContextMenu(null);
            }}
            onEdit={() => { setEditingTask(taskContextMenu.task); setTaskContextMenu(null); }}
            onDelete={() => {
              deleteTask(taskContextMenu.task.uid).catch(console.error);
              setSelectedTaskUids((prev) => { const n = new Set(prev); n.delete(taskContextMenu.task.uid); return n; });
              setTaskContextMenu(null);
            }}
            onDeleteAll={() => {
              const uids = selectedTaskUids.has(taskContextMenu.task.uid)
                ? [...selectedTaskUids]
                : [taskContextMenu.task.uid];
              deleteTasks(uids).catch(console.error);
              setSelectedTaskUids(new Set());
              setTaskContextMenu(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingEvent && (
          <EventOverviewModal event={viewingEvent} onClose={() => setViewingEvent(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEvent && (
          <EventTaskModal type="event" mode="edit" event={editingEvent} onClose={() => setEditingEvent(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTask && (
          <EventTaskModal type="task" mode="edit" task={editingTask} onClose={() => setEditingTask(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingCreate && (
          <EventTaskModal
            type="event" mode="create"
            initialStart={pendingCreate.start}
            initialEnd={pendingCreate.end}
            onClose={() => setPendingCreate(null)}
          />
        )}
      </AnimatePresence>

      {pendingDelete && (
        <RecurringScopeModal
          title="Delete recurring event"
          eventSummary={pendingDelete.summary}
          variant="danger"
          confirmLabel="This event only"
          confirmAllLabel="All events in series"
          onConfirm={(scope) => {
            const ev = pendingDelete;
            setPendingDelete(null);
            deleteEvent(ev, scope);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

    </div>
  );
}
