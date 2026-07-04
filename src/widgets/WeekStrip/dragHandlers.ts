import type React from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { CalendarEvent } from '../../entities/event/model/types';
import type { CalendarTask } from '../../entities/task/model/types';
import { isSameDay } from '../../shared/lib/week';
import { useCalendarStore } from '../../entities/calendar/model/store';
import type { DragActive, DragSnapshot, CreateSnap, PendingDrop } from './types';

export interface DragCtx {
  scrollRef: RefObject<HTMLDivElement>;
  activeDrag: MutableRefObject<DragActive | null>;
  dragSnapRef: MutableRefObject<DragSnapshot | null>;
  createDragRef: MutableRefObject<CreateSnap | null>;
  shouldPreventScrollRef: MutableRefObject<boolean>;
  touchTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  touchContextTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isMobileRef: MutableRefObject<boolean>;
  mobileDayIndexRef: MutableRefObject<number>;
  days: Date[];
  events: CalendarEvent[];
  timedTasks: CalendarTask[];
  selectedUids: Set<string>;
  selectedTaskUids: Set<string>;
  HOUR_HEIGHT: number;
  SNAP_VH: number;
  timeToVh: (d: Date) => number;
  durationToVh: (s: Date, e: Date) => number;
  snapVh: (v: number) => number;
  vhToDate: (v: number, d: Date) => Date;
  setDragSnap: (s: DragSnapshot | null) => void;
  setCreateSnap: (s: CreateSnap | null) => void;
  setSelectedUids: (a: Set<string> | ((p: Set<string>) => Set<string>)) => void;
  setSelectedTaskUids: (a: Set<string> | ((p: Set<string>) => Set<string>)) => void;
  setViewingEvent: (e: CalendarEvent | null) => void;
  setPendingDrop: (d: PendingDrop | null) => void;
  setContextMenu: (m: { x: number; y: number; event: CalendarEvent } | null) => void;
  setPendingCreate: (c: { start: Date; end: Date } | null) => void;
  updateEventTime: (event: CalendarEvent, newStart: Date, newEnd: Date | undefined, scope: 'single' | 'all') => Promise<void>;
  updateTaskTime: (uid: string, newStart: Date, newDue: Date | undefined) => Promise<void>;
}

export function taskToEvent(task: CalendarTask): CalendarEvent {
  return {
    uid: task.uid,
    baseUid: task.uid,
    summary: task.summary,
    description: task.description,
    start: task.start!,
    end: task.due,
    calendarName: task.calendarName,
    calendarColor: task.calendarColor,
    type: 'VTODO',
    allDay: false,
  };
}

function gridVhAtY(clientY: number, scrollRef: RefObject<HTMLDivElement>): number {
  const el = scrollRef.current!;
  return ((clientY - el.getBoundingClientRect().top + el.scrollTop) / window.innerHeight) * 100;
}

export function createDragHandlers(ctx: DragCtx) {
  const {
    scrollRef, activeDrag, dragSnapRef, createDragRef, shouldPreventScrollRef,
    touchTimerRef, touchContextTimerRef, isMobileRef, mobileDayIndexRef,
    days, events, timedTasks, selectedUids, selectedTaskUids, HOUR_HEIGHT, SNAP_VH,
    timeToVh, durationToVh, snapVh, vhToDate,
    setDragSnap, setCreateSnap, setSelectedUids, setSelectedTaskUids, setViewingEvent,
    setPendingDrop, setContextMenu, setPendingCreate, updateEventTime, updateTaskTime,
  } = ctx;

  function buildGroupEvents(anchorUid: string): { isGroupDrag: boolean; groupEvents: CalendarEvent[] } {
    const inEventSel = selectedUids.has(anchorUid);
    const inTaskSel = selectedTaskUids.has(anchorUid);
    const totalSelected = selectedUids.size + selectedTaskUids.size;
    const isGroupDrag = (inEventSel || inTaskSel) && totalSelected > 1;
    const groupEvents = isGroupDrag
      ? [
          ...events.filter((ev) => selectedUids.has(ev.uid)),
          ...timedTasks.filter((t) => selectedTaskUids.has(t.uid)).map(taskToEvent),
        ]
      : [];
    return { isGroupDrag, groupEvents };
  }

  async function applyGroupDrop(
    drag: DragActive,
    snap: DragSnapshot,
  ) {
    const colDelta = snap.dayIndex - drag.anchorColIndex;
    const vhDelta = snap.startVh - drag.anchorStartVh;
    // One undo entry for the whole group move.
    const n = drag.groupEvents.length;
    useCalendarStore.getState().beginUndoBatch(`Move ${n} item${n > 1 ? 's' : ''}`);
    for (const ev of drag.groupEvents) {
      const evStartVh = timeToVh(ev.start);
      const evDurVh = ev.end ? durationToVh(ev.start, ev.end) : HOUR_HEIGHT;
      const evNewStartVh = Math.max(0, Math.min(24 * HOUR_HEIGHT - SNAP_VH, evStartVh + vhDelta));
      const evNewEndVh = Math.min(24 * HOUR_HEIGHT, evNewStartVh + evDurVh);
      const evDayIdx = days.findIndex((d) => isSameDay(d, ev.start));
      const evTargetCol = Math.max(0, Math.min(6, evDayIdx + colDelta));
      const evNewStart = vhToDate(evNewStartVh, days[evTargetCol]);
      const evNewEnd = ev.end ? vhToDate(evNewEndVh, days[evTargetCol]) : undefined;
      if (ev.type === 'VTODO') {
        await updateTaskTime(ev.uid, evNewStart, evNewEnd);
      } else {
        await updateEventTime(ev, evNewStart, evNewEnd, 'single');
      }
    }
    useCalendarStore.getState().commitUndoBatch();
  }

  function startMove(e: React.PointerEvent, event: CalendarEvent, colIndex: number) {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);

    const originalDuration = event.end ? durationToVh(event.start, event.end) : HOUR_HEIGHT;
    const eventStartVh = timeToVh(event.start);
    const anchorStartVh = snapVh(eventStartVh);
    const grabOffsetVh = gridVhAtY(e.clientY, scrollRef) - eventStartVh;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const isShiftClick = e.shiftKey;
    let hasMoved = false;

    const { isGroupDrag, groupEvents } = buildGroupEvents(event.uid);

    function onMove(me: PointerEvent) {
      if (!hasMoved) {
        if (Math.abs(me.clientX - startClientX) < 5 && Math.abs(me.clientY - startClientY) < 5) return;
        hasMoved = true;
        document.body.style.cursor = 'grabbing';
        activeDrag.current = {
          type: 'move', event, grabOffsetVh, originalDuration,
          isGroupDrag, groupEvents, anchorStartVh, anchorColIndex: colIndex,
        };
        const snap: DragSnapshot = {
          eventUid: event.uid, dayIndex: colIndex,
          startVh: anchorStartVh, endVh: anchorStartVh + originalDuration,
          color: event.calendarColor, summary: event.summary,
        };
        dragSnapRef.current = snap;
        setDragSnap(snap);
      }
      const drag = activeDrag.current;
      if (!drag) return;
      const rawStart = gridVhAtY(me.clientY, scrollRef) - drag.grabOffsetVh;
      const snappedStart = Math.max(0, Math.min(24 * HOUR_HEIGHT - SNAP_VH, snapVh(rawStart)));
      const snappedEnd = Math.min(24 * HOUR_HEIGHT, snappedStart + drag.originalDuration);
      const el = scrollRef.current!;
      const numCols = isMobileRef.current ? 1 : 7;
      const colW = (el.getBoundingClientRect().width - 48) / numCols;
      const col = isMobileRef.current
        ? mobileDayIndexRef.current
        : Math.max(0, Math.min(6, Math.floor((me.clientX - el.getBoundingClientRect().left - 48) / colW)));
      const next: DragSnapshot = {
        eventUid: drag.event.uid, dayIndex: col,
        startVh: snappedStart, endVh: snappedEnd,
        color: drag.event.calendarColor, summary: drag.event.summary,
      };
      if (dragSnapRef.current?.startVh !== next.startVh || dragSnapRef.current?.dayIndex !== next.dayIndex) {
        dragSnapRef.current = next;
        setDragSnap(next);
      }
    }

    async function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';

      if (!hasMoved) {
        if (isShiftClick) {
          if (event.type === 'VTODO') {
            setSelectedTaskUids((prev) => {
              const next = new Set(prev);
              if (next.has(event.uid)) next.delete(event.uid); else next.add(event.uid);
              return next;
            });
          } else {
            setSelectedUids((prev) => {
              const next = new Set(prev);
              if (next.has(event.uid)) next.delete(event.uid); else next.add(event.uid);
              return next;
            });
          }
        } else {
          setViewingEvent(event);
        }
        return;
      }

      const snap = dragSnapRef.current;
      const drag = activeDrag.current;
      activeDrag.current = null;
      setDragSnap(null);
      dragSnapRef.current = null;
      if (!snap || !drag) return;

      const targetDay = days[snap.dayIndex];
      const newStart = vhToDate(snap.startVh, targetDay);
      const newEnd = drag.event.end ? vhToDate(snap.endVh, targetDay) : undefined;

      if (drag.isGroupDrag) {
        await applyGroupDrop(drag, snap);
      } else if (drag.event.type === 'VTODO') {
        await updateTaskTime(drag.event.uid, newStart, newEnd);
      } else if (drag.event.uid !== drag.event.baseUid) {
        setPendingDrop({ event: drag.event, newStart, newEnd });
      } else {
        updateEventTime(drag.event, newStart, newEnd, 'all');
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startResize(e: React.PointerEvent, event: CalendarEvent, colIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);

    const snappedStart = snapVh(timeToVh(event.start));
    const originalDuration = event.end ? durationToVh(event.start, event.end) : HOUR_HEIGHT;
    activeDrag.current = {
      type: 'resize', event, grabOffsetVh: 0, originalDuration,
      isGroupDrag: false, groupEvents: [], anchorStartVh: snappedStart, anchorColIndex: colIndex,
    };
    const snap: DragSnapshot = {
      eventUid: event.uid, dayIndex: colIndex,
      startVh: snappedStart, endVh: snappedStart + originalDuration,
      color: event.calendarColor, summary: event.summary,
    };
    dragSnapRef.current = snap;
    setDragSnap(snap);
    document.body.style.cursor = 'ns-resize';

    function onMove(me: PointerEvent) {
      const rawEnd = gridVhAtY(me.clientY, scrollRef);
      const snappedEnd = Math.max(snappedStart + SNAP_VH, Math.min(24 * HOUR_HEIGHT, snapVh(rawEnd)));
      if (dragSnapRef.current?.endVh !== snappedEnd) {
        const next: DragSnapshot = { ...dragSnapRef.current!, endVh: snappedEnd };
        dragSnapRef.current = next;
        setDragSnap(next);
      }
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      const snap = dragSnapRef.current;
      const drag = activeDrag.current;
      activeDrag.current = null;
      setDragSnap(null);
      dragSnapRef.current = null;
      if (!snap || !drag) return;
      const newEnd = vhToDate(snap.endVh, days[snap.dayIndex]);
      if (drag.event.uid !== drag.event.baseUid) {
        setPendingDrop({ event: drag.event, newStart: drag.event.start, newEnd });
      } else {
        updateEventTime(drag.event, drag.event.start, newEnd, 'all');
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startCreate(e: React.PointerEvent, colIdx: number) {
    if (e.button !== 0) return;
    const startClientY = e.clientY;
    let hasMoved = false;
    const anchorVh = snapVh(gridVhAtY(e.clientY, scrollRef));

    function onMove(me: PointerEvent) {
      if (!hasMoved) {
        if (Math.abs(me.clientY - startClientY) < 5) return;
        hasMoved = true;
      }
      const snappedEnd = Math.max(anchorVh + SNAP_VH, Math.min(24 * HOUR_HEIGHT, snapVh(gridVhAtY(me.clientY, scrollRef))));
      const next: CreateSnap = { dayIndex: colIdx, startVh: anchorVh, endVh: snappedEnd };
      createDragRef.current = next;
      setCreateSnap(next);
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const snap = createDragRef.current;
      createDragRef.current = null;
      setCreateSnap(null);
      if (!hasMoved || !snap) return;
      setPendingCreate({ start: vhToDate(snap.startVh, days[snap.dayIndex]), end: vhToDate(snap.endVh, days[snap.dayIndex]) });
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startMoveTouch(e: React.PointerEvent, event: CalendarEvent, colIndex: number) {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let phase: 'waiting' | 'selected' | 'dragging' | 'done' = 'waiting';
    const originalDuration = event.end ? durationToVh(event.start, event.end) : HOUR_HEIGHT;
    const eventStartVh = timeToVh(event.start);
    const anchorStartVh = snapVh(eventStartVh);
    const grabOffsetVh = gridVhAtY(startY, scrollRef) - eventStartVh;

    function cancel() {
      if (phase !== 'waiting') return;
      phase = 'done';
      clearTimeout(touchTimerRef.current!);
      window.removeEventListener('touchmove', onTouchMove);
      cleanupPointer();
    }

    function onTouchMove(te: TouchEvent) {
      if (phase !== 'waiting') return;
      const t = te.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
    }

    touchTimerRef.current = setTimeout(() => {
      if (phase !== 'waiting') return;
      phase = 'selected';
      shouldPreventScrollRef.current = true;
      navigator.vibrate?.(40);

      const newEventSelected = event.type !== 'VTODO' ? new Set([...selectedUids, event.uid]) : selectedUids;
      const newTaskSelected = event.type === 'VTODO' ? new Set([...selectedTaskUids, event.uid]) : selectedTaskUids;
      if (event.type !== 'VTODO') setSelectedUids(newEventSelected);
      else setSelectedTaskUids(newTaskSelected);

      const totalSelected = newEventSelected.size + newTaskSelected.size;
      const groupEventsList = totalSelected > 1
        ? [
            ...events.filter((ev) => newEventSelected.has(ev.uid)),
            ...timedTasks.filter((t) => newTaskSelected.has(t.uid)).map(taskToEvent),
          ]
        : [];
      const isGroup = totalSelected > 1;

      activeDrag.current = {
        type: 'move', event, grabOffsetVh, originalDuration,
        isGroupDrag: isGroup, groupEvents: groupEventsList,
        anchorStartVh, anchorColIndex: colIndex,
      };
      const snap: DragSnapshot = {
        eventUid: event.uid, dayIndex: colIndex,
        startVh: anchorStartVh, endVh: anchorStartVh + originalDuration,
        color: event.calendarColor, summary: event.summary,
      };
      dragSnapRef.current = snap;
      setDragSnap(snap);
      touchContextTimerRef.current = setTimeout(() => {
        if (phase !== 'selected') return;
        phase = 'done';
        shouldPreventScrollRef.current = false;
        activeDrag.current = null;
        setDragSnap(null);
        dragSnapRef.current = null;
        cleanupPointer();
        setContextMenu({ x: startX, y: startY, event });
      }, 1000);
    }, 1000);

    function onPointerMove(me: PointerEvent) {
      if (phase === 'selected') {
        if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) {
          phase = 'dragging';
          clearTimeout(touchContextTimerRef.current!);
        }
      }
      if (phase === 'dragging') {
        const drag = activeDrag.current;
        if (!drag) return;
        const rawStart = gridVhAtY(me.clientY, scrollRef) - drag.grabOffsetVh;
        const snappedStart = Math.max(0, Math.min(24 * HOUR_HEIGHT - SNAP_VH, snapVh(rawStart)));
        const snappedEnd = Math.min(24 * HOUR_HEIGHT, snappedStart + drag.originalDuration);
        const next: DragSnapshot = {
          eventUid: drag.event.uid, dayIndex: mobileDayIndexRef.current,
          startVh: snappedStart, endVh: snappedEnd,
          color: drag.event.calendarColor, summary: drag.event.summary,
        };
        if (dragSnapRef.current?.startVh !== next.startVh) { dragSnapRef.current = next; setDragSnap(next); }
      }
    }

    async function onPointerUp() {
      clearTimeout(touchTimerRef.current!);
      clearTimeout(touchContextTimerRef.current!);
      shouldPreventScrollRef.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      cleanupPointer();
      if (phase === 'waiting') {
        setViewingEvent(event);
        return;
      }
      if (phase === 'selected') return;
      if (phase === 'dragging') {
        const snap = dragSnapRef.current;
        const drag = activeDrag.current;
        activeDrag.current = null;
        setDragSnap(null);
        dragSnapRef.current = null;
        if (!snap || !drag) return;
        const targetDay = days[snap.dayIndex];
        const newStart = vhToDate(snap.startVh, targetDay);
        const newEnd = drag.event.end ? vhToDate(snap.endVh, targetDay) : undefined;
        if (drag.isGroupDrag) {
          await applyGroupDrop(drag, snap);
        } else if (drag.event.type === 'VTODO') {
          await updateTaskTime(drag.event.uid, newStart, newEnd);
        } else if (drag.event.uid !== drag.event.baseUid) {
          setPendingDrop({ event: drag.event, newStart, newEnd });
        } else {
          updateEventTime(drag.event, newStart, newEnd, 'all');
        }
      }
    }

    function cleanupPointer() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', cancel);
    }

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cancel);
  }

  function startCreateTouch(e: React.PointerEvent, colIdx: number) {
    const startX = e.clientX;
    const startY = e.clientY;
    let phase: 'waiting' | 'creating' | 'done' = 'waiting';
    let anchorVh = 0;
    let lastTouchY = startY;

    function cancel() {
      if (phase !== 'waiting') return;
      phase = 'done';
      clearTimeout(touchTimerRef.current!);
      window.removeEventListener('touchmove', onTouchMove);
      cleanupPointer();
    }

    function onTouchMove(te: TouchEvent) {
      if (phase !== 'waiting') return;
      const t = te.touches[0];
      if (!t) return;
      lastTouchY = t.clientY;
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
    }

    touchTimerRef.current = setTimeout(() => {
      if (phase !== 'waiting') return;
      phase = 'creating';
      shouldPreventScrollRef.current = true;
      navigator.vibrate?.(20);
      anchorVh = snapVh(gridVhAtY(lastTouchY, scrollRef));
      const snap: CreateSnap = { dayIndex: colIdx, startVh: anchorVh, endVh: anchorVh + HOUR_HEIGHT };
      createDragRef.current = snap;
      setCreateSnap(snap);
    }, 1000);

    function onPointerMove(me: PointerEvent) {
      if (phase !== 'creating') return;
      const snappedEnd = Math.max(anchorVh + SNAP_VH, Math.min(24 * HOUR_HEIGHT, snapVh(gridVhAtY(me.clientY, scrollRef))));
      const next: CreateSnap = { dayIndex: colIdx, startVh: anchorVh, endVh: snappedEnd };
      createDragRef.current = next;
      setCreateSnap(next);
    }

    function onPointerUp() {
      clearTimeout(touchTimerRef.current!);
      shouldPreventScrollRef.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      cleanupPointer();
      if (phase === 'waiting') { setSelectedUids(new Set()); return; }
      if (phase === 'creating') {
        const snap = createDragRef.current;
        createDragRef.current = null;
        setCreateSnap(null);
        if (!snap) return;
        setPendingCreate({ start: vhToDate(snap.startVh, days[snap.dayIndex]), end: vhToDate(snap.endVh, days[snap.dayIndex]) });
      }
    }

    function cleanupPointer() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', cancel);
    }

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cancel);
  }

  return { startMove, startResize, startCreate, startMoveTouch, startCreateTouch };
}
