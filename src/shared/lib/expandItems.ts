import type { StoredItem } from '../../entities/calendar/model/types';
import type { CalendarEvent } from '../../entities/event/model/types';
import { getWeekBounds } from './week';

function isAllDay(rawData: string): boolean {
  // DATE-only DTSTART (no T time component) → all-day event
  return /^DTSTART(?:;[^:\r\n]*)?:\d{8}\s*$/m.test(rawData);
}

export function expandItems(items: StoredItem[], weekOffset: number): CalendarEvent[] {
  const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset);
  const events: CalendarEvent[] = [];

  for (const { component, calendarName, calendarColor, rawData } of items) {
    if (component.type !== 'VEVENT') continue;
    let baseStart: Date | undefined;
    if (component.type === 'VEVENT') {
      baseStart = component.start;
    } else {
      if (component.start) {
        baseStart = component.start;
      } else if (component.due) {
        const raw = component.due as unknown;
        const str = raw && typeof raw === 'object' && 'val' in (raw as object)
          ? String((raw as any).val)
          : typeof raw === 'string' ? raw : '';
        const dtm = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
        if (dtm) {
          baseStart = dtm[7]
            ? new Date(Date.UTC(+dtm[1], +dtm[2] - 1, +dtm[3], +dtm[4], +dtm[5], +dtm[6]))
            : new Date(+dtm[1], +dtm[2] - 1, +dtm[3], +dtm[4], +dtm[5], +dtm[6]);
        } else {
          const dtd = str.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (dtd) baseStart = new Date(+dtd[1], +dtd[2] - 1, +dtd[3]);
        }
      }
    }
    if (!baseStart || isNaN(baseStart.getTime())) continue;

    const baseUid = component.uid || crypto.randomUUID();
    const summary = component.summary || 'Untitled';
    const description = (component as any).description as string | undefined;
    const allDay = isAllDay(rawData);
    const duration =
      component.type === 'VEVENT' && component.end
        ? component.end.getTime() - baseStart.getTime()
        : 0;

    if (component.rrule) {
      const occurrences = component.rrule.between(weekStart, weekEnd, true);
      for (const occStart of occurrences) {
        const dateKey = occStart.toISOString().substring(0, 10);
        if (component.exdate?.[dateKey]) continue;

        const modified = component.recurrences?.[dateKey];
        events.push({
          uid: baseUid + dateKey,
          baseUid,
          summary: modified?.summary ?? summary,
          description: modified?.description ?? description,
          start: modified?.start ?? occStart,
          end: modified?.end ?? (duration > 0 ? new Date(occStart.getTime() + duration) : undefined),
          calendarName,
          calendarColor,
          type: component.type,
          allDay,
          occurrenceStart: occStart,
        });
      }
    } else {
      if (baseStart >= weekStart && baseStart <= weekEnd) {
        events.push({
          uid: baseUid,
          baseUid,
          summary,
          description,
          start: baseStart,
          end: component.type === 'VEVENT' && component.end ? component.end : undefined,
          calendarName,
          calendarColor,
          type: component.type,
          allDay,
        });
      }
    }
  }

  return events;
}
