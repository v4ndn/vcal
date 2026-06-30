import type { StoredItem } from '../../entities/calendar/model/types';
import type { CalendarTask } from '../../entities/task/model/types';

// ical.js stores DUE (and other unrecognised date props) as raw ICS strings or
// as {params, val} objects when the property has params (e.g. VALUE=DATE).
// DTSTART uses dateParam so it comes back as a proper Date. Handle all cases.
function parseICSDate(val: unknown): Date | undefined {
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;

  // {params: {...}, val: '20240625'} form (property with params, no dateParam handler)
  let str: string | undefined;
  if (val && typeof val === 'object' && !Array.isArray(val) && 'val' in (val as object)) {
    str = String((val as any).val);
  } else if (typeof val === 'string') {
    str = val;
  }
  if (!str) return undefined;

  // Standard ISO — already fine
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // ICS datetime: 20240625T170000Z  or  20240625T170000
  const dtm = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dtm) {
    d = dtm[7]
      ? new Date(Date.UTC(+dtm[1], +dtm[2] - 1, +dtm[3], +dtm[4], +dtm[5], +dtm[6]))
      : new Date(+dtm[1], +dtm[2] - 1, +dtm[3], +dtm[4], +dtm[5], +dtm[6]);
    if (!isNaN(d.getTime())) return d;
  }

  // ICS date-only: 20240625
  const dtd = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dtd) {
    d = new Date(+dtd[1], +dtd[2] - 1, +dtd[3]);
    if (!isNaN(d.getTime())) return d;
  }

  return undefined;
}

export function getTasks(items: StoredItem[]): CalendarTask[] {
  return items
    .filter((item) => item.component.type === 'VTODO')
    .map((item) => {
      const c = item.component;
      const completed = /^STATUS:COMPLETED/m.test(item.rawData);
      return {
        uid: c.uid ?? '',
        summary: c.summary ?? 'Untitled',
        description: (c as any).description as string | undefined,
        start: parseICSDate(c.start),
        due: parseICSDate((c as any).due),
        completed,
        repeating: !!c.rrule,
        calendarName: item.calendarName,
        calendarColor: item.calendarColor,
      };
    });
}
