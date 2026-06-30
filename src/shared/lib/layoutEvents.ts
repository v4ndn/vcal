import type { CalendarEvent } from '../../entities/event/model/types';

export interface EventSlot {
  col: number;
  numCols: number;
}

export function layoutDayEvents(events: CalendarEvent[]): Map<string, EventSlot> {
  const result = new Map<string, EventSlot>();
  if (!events.length) return result;

  const getEnd = (e: CalendarEvent) => e.end?.getTime() ?? e.start.getTime() + 3_600_000;

  const sorted = [...events].sort((a, b) => {
    const diff = a.start.getTime() - b.start.getTime();
    return diff !== 0 ? diff : getEnd(b) - getEnd(a); // longer events first on tie
  });

  let i = 0;
  while (i < sorted.length) {
    const cluster: CalendarEvent[] = [sorted[i]];
    let clusterMaxEnd = getEnd(sorted[i]);

    let j = i + 1;
    while (j < sorted.length && sorted[j].start.getTime() < clusterMaxEnd) {
      cluster.push(sorted[j]);
      clusterMaxEnd = Math.max(clusterMaxEnd, getEnd(sorted[j]));
      j++;
    }

    // Greedy column assignment within the cluster
    const colEnds: number[] = [];
    const colOf = new Map<string, number>();

    for (const ev of cluster) {
      const evEnd = getEnd(ev);
      let col = colEnds.findIndex((end) => end <= ev.start.getTime());
      if (col === -1) col = colEnds.length;
      colEnds[col] = evEnd;
      colOf.set(ev.uid, col);
    }

    const numCols = colEnds.length;
    for (const ev of cluster) {
      result.set(ev.uid, { col: colOf.get(ev.uid)!, numCols });
    }

    i = j;
  }

  return result;
}
