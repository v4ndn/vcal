import type { CalendarEvent } from '../../entities/event/model/types';

export interface DragActive {
  type: 'move' | 'resize';
  event: CalendarEvent;
  grabOffsetVh: number;
  originalDuration: number;
  isGroupDrag: boolean;
  groupEvents: CalendarEvent[];
  anchorStartVh: number;
  anchorColIndex: number;
}

export interface DragSnapshot {
  eventUid: string;
  dayIndex: number;
  startVh: number;
  endVh: number;
  color: string | undefined;
  summary: string;
}

export interface CreateSnap {
  dayIndex: number;
  startVh: number;
  endVh: number;
}

export interface PendingDrop {
  event: CalendarEvent;
  newStart: Date;
  newEnd: Date | undefined;
}
