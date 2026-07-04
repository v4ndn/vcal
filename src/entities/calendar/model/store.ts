import { create } from 'zustand';
import { DAVClient } from 'tsdav';
import ical from 'ical';
import type { StoredItem, CalendarMeta } from './types';
import type { CalendarEvent } from '../../event/model/types';
import { expandItems } from '../../../shared/lib/expandItems';
import { updateICSTimes, updateEventFull, addExdate, parseICSDescription, formatICSDate, setTaskStatus, updateTaskFull, buildJournalICS, updateJournalFull } from '../../../shared/lib/icsUpdate';
import { useAuthStore } from '../../auth/model/store';
import { useToastStore } from '../../ui/model/toastStore';
import { useThemeStore } from '../../theme/model/store';

// ── Undo (single-level) ─────────────────────────────────────────────────────────
// Every mutation reduces to a set of these inverse ops against the CalDAV store.
type InverseOp =
  | { kind: 'upsert'; objectUrl: string; calendarName: string; calendarColor?: string; rawData: string }
  | { kind: 'remove'; objectUrl: string; etag?: string };

type UndoEntry = { label: string; ops: InverseOp[] };

const upsertOp = (it: StoredItem): InverseOp => ({
  kind: 'upsert', objectUrl: it.objectUrl, calendarName: it.calendarName, calendarColor: it.calendarColor, rawData: it.rawData,
});
const removeOp = (objectUrl: string, etag?: string): InverseOp => ({ kind: 'remove', objectUrl, etag });
const sumOf = (it: StoredItem): string => it.component.summary ?? 'item';

// Module-level batch collector so bulk external loops (paste, preset drop) coalesce into one entry.
let _batchOpen = false;
let _batchLabel = '';
let _batchOps: InverseOp[] = [];

function buildStandaloneICS(
  uid: string,
  type: 'VEVENT' | 'VTODO',
  summary: string,
  description: string,
  start: Date,
  end: Date | undefined,
): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//vcalendar//EN',
    `BEGIN:${type}`,
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    ...(end ? [`DTEND:${formatICSDate(end)}`] : []),
    `SUMMARY:${summary}`,
    ...(description ? [`DESCRIPTION:${description.replace(/\n/g, '\\n')}`] : []),
    `END:${type}`,
    'END:VCALENDAR',
  ].join('\r\n');
}

function normalizeColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^#[0-9a-f]{8}$/i.test(raw)) return raw.slice(0, 7);
  return raw;
}

let _client: DAVClient | null = null;

export function resetCalendarClient() {
  _client = null;
}

async function getClient(): Promise<DAVClient> {
  if (!_client) {
    const config = useAuthStore.getState().config;
    if (!config) throw new Error('No auth config');
    _client = new DAVClient({
      serverUrl: config.serverUrl,
      credentials: { username: config.username, password: config.password },
      authMethod: config.authMethod,
      defaultAccountType: 'caldav',
    });
    await _client.login();
  }
  return _client;
}

interface CalendarStore {
  items: StoredItem[];
  calendars: CalendarMeta[];
  events: CalendarEvent[];
  journals: StoredItem[];
  loading: boolean;
  weekOffset: number;
  hiddenCalendars: Set<string>;
  undoStack: UndoEntry[];

  recordUndo: (label: string, ops: InverseOp[]) => void;
  beginUndoBatch: (label: string) => void;
  commitUndoBatch: () => void;
  undo: () => Promise<void>;
  fetch: () => Promise<void>;
  setWeekOffset: (offset: number) => void;
  toggleCalendar: (name: string) => void;
  updateEventTime: (event: CalendarEvent, newStart: Date, newEnd: Date | undefined, scope: 'single' | 'all') => Promise<void>;
  updateEventDetails: (
    event: CalendarEvent,
    opts: { summary: string; start: Date; end: Date | undefined; description: string; rrule: string; reminders: number[]; allDay?: boolean },
    scope: 'single' | 'all',
    targetCalendarName?: string,
  ) => Promise<void>;
  deleteEvent: (event: CalendarEvent, scope: 'single' | 'all') => Promise<void>;
  deleteEvents: (events: CalendarEvent[]) => Promise<void>;
  toggleTaskComplete: (uid: string) => Promise<void>;
  updateTaskDetails: (uid: string, opts: { summary: string; start: Date | undefined; due: Date | undefined; description: string; rrule: string; reminders: number[]; allDay?: boolean }, targetCalendarName?: string) => Promise<void>;
  deleteTask: (uid: string) => Promise<void>;
  deleteTasks: (uids: string[]) => Promise<void>;
  createNewEvent: (
    calendarName: string,
    opts: { summary: string; start: Date | undefined; end: Date | undefined; description: string; rrule: string; reminders: number[]; type: 'VEVENT' | 'VTODO'; allDay?: boolean },
  ) => Promise<void>;
  createEvent: (event: CalendarEvent) => Promise<void>;
  createJournal: (calendarName: string, opts: { summary: string; description: string; icon?: string }) => Promise<void>;
  updateJournal: (uid: string, opts: { summary: string; description: string; icon?: string }, targetCalendarName?: string) => Promise<void>;
  deleteJournal: (uid: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  items: [],
  calendars: [],
  events: [],
  journals: [],
  loading: true,
  weekOffset: 0,
  hiddenCalendars: new Set<string>(),
  undoStack: [],

  recordUndo: (label, ops) => {
    if (!ops.length) return;
    if (_batchOpen) { _batchOps.push(...ops); return; }
    set((s) => {
      const max = Math.max(1, useThemeStore.getState().maxUndo);
      return { undoStack: [...s.undoStack, { label, ops }].slice(-max) };
    });
  },

  beginUndoBatch: (label) => { _batchOpen = true; _batchLabel = label; _batchOps = []; },

  commitUndoBatch: () => {
    _batchOpen = false;
    const raw = _batchOps;
    _batchOps = [];
    // Dedupe by objectUrl keeping the FIRST op — so restoring a shared object
    // (e.g. a recurring master EXDATE'd once per moved occurrence) uses its most
    // original state, not an intermediate one.
    const seen = new Set<string>();
    const ops: InverseOp[] = [];
    for (const op of raw) {
      if (seen.has(op.objectUrl)) continue;
      seen.add(op.objectUrl);
      ops.push(op);
    }
    if (!ops.length) return;
    set((s) => {
      const max = Math.max(1, useThemeStore.getState().maxUndo);
      return { undoStack: [...s.undoStack, { label: _batchLabel, ops }].slice(-max) };
    });
  },

  undo: async () => {
    const { undoStack, items, weekOffset } = get();
    if (!undoStack.length) return;
    const entry = undoStack[undoStack.length - 1];
    set({ undoStack: undoStack.slice(0, -1) }); // pop

    // Optimistic local apply
    let nextItems = [...items];
    for (const op of entry.ops) {
      if (op.kind === 'upsert') {
        const parsed = ical.parseICS(op.rawData);
        const comp = Object.values(parsed).find(
          (c) => c.type === 'VEVENT' || c.type === 'VTODO' || c.type === 'VJOURNAL',
        ) as StoredItem['component'] | undefined;
        if (!comp) continue;
        const restored: StoredItem = {
          component: comp,
          calendarName: op.calendarName,
          calendarColor: op.calendarColor,
          objectUrl: op.objectUrl,
          etag: undefined,
          rawData: op.rawData,
        };
        const idx = nextItems.findIndex((i) => i.objectUrl === op.objectUrl);
        if (idx >= 0) nextItems[idx] = restored; else nextItems.push(restored);
      } else {
        nextItems = nextItems.filter((i) => i.objectUrl !== op.objectUrl);
      }
    }
    set({ items: nextItems, events: expandItems(nextItems, weekOffset) });

    // Server sync
    try {
      const client = await getClient();
      for (const op of entry.ops) {
        if (op.kind === 'upsert') {
          // PUT without If-Match overwrites, or creates the object if it was deleted.
          try {
            await client.updateCalendarObject({
              calendarObject: { url: op.objectUrl, data: op.rawData, etag: undefined },
            });
          } catch {
            const calUrl = op.objectUrl.replace(/\/[^/]+$/, '/');
            const filename = op.objectUrl.split('/').pop() ?? `${crypto.randomUUID()}.ics`;
            await (client as any).createCalendarObject({ calendar: { url: calUrl }, filename, iCalString: op.rawData });
          }
        } else {
          await client.deleteCalendarObject({ calendarObject: { url: op.objectUrl, etag: op.etag } });
        }
      }
    } catch (err) {
      console.error('[vcalendar] undo error:', err);
      await get().fetch();
    }
    useToastStore.getState().showToast(`Undone: ${entry.label}`);
  },

  setWeekOffset: (offset) =>
    set((state) => ({
      weekOffset: offset,
      events: expandItems(state.items, offset),
    })),

  toggleCalendar: (name) =>
    set((state) => {
      const next = new Set(state.hiddenCalendars);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { hiddenCalendars: next };
    }),

  fetch: async () => {
    set({ loading: true });
    const client = await getClient();
    const rawCalendars = await client.fetchCalendars();

    const results = await Promise.all(
      rawCalendars.map(async (calendar) => {
        const calendarName = (calendar.displayName as string | undefined) ?? 'Calendar';
        const calendarColor = normalizeColor(calendar.calendarColor);
        const calendarUrl = (calendar.url as string | undefined) ?? '';
        const supportedComponents = (calendar.components ?? []).map((c) => c.toUpperCase());
        const supportsJournal = supportedComponents.includes('VJOURNAL');
        const supportsEvents = supportedComponents.includes('VEVENT');
        const supportsTasks = supportedComponents.includes('VTODO');
        // A collection can be both a calendar and a journal. Fall back to
        // "calendar" when the server reports no components (unless it's journal-only).
        const isJournal = supportsJournal;
        const isCalendar = supportsEvents || supportsTasks || !supportsJournal;
        const meta: CalendarMeta = { name: calendarName, color: calendarColor, url: calendarUrl, isJournal, isCalendar };

        const objects = await client.fetchCalendarObjects({
          calendar,
          // No nested comp-filter → server returns all component types (VEVENT + VTODO)
          filters: [{ 'comp-filter': { _attributes: { name: 'VCALENDAR' } } }],
        });
        const items: StoredItem[] = [];
        for (const obj of objects) {
          if (!obj.data) continue;
          const parsed = ical.parseICS(obj.data);
          for (const component of Object.values(parsed)) {
            if (component.type !== 'VEVENT' && component.type !== 'VTODO' && component.type !== 'VJOURNAL') continue;
            items.push({
              component: component as StoredItem['component'],
              calendarName,
              calendarColor,
              objectUrl: obj.url,
              etag: obj.etag,
              rawData: obj.data,
            });
          }
        }
        return { meta, items };
      }),
    );

    const stored = results.flatMap((r) => r.items);
    const calendarsMeta = results.map((r) => r.meta);
    const journals = stored.filter((i) => i.component.type === 'VJOURNAL');
    set({ items: stored, calendars: calendarsMeta, events: expandItems(stored, get().weekOffset), journals, loading: false });
  },

  updateEventTime: async (event, newStart, newEnd, scope) => {
    const { items, weekOffset } = get();
    const item = items.find((i) => i.component.uid === event.baseUid);
    if (!item) {
      console.warn('[vcalendar] updateEventTime: no item found for baseUid', event.baseUid);
      return;
    }

    const isRecurringOccurrence = event.uid !== event.baseUid;

    // Single occurrence of a recurring series → detach: EXDATE the master + create standalone event
    if (isRecurringOccurrence && scope === 'single') {
      const occurrenceDate = event.occurrenceStart ?? event.start;
      const description = parseICSDescription(item.rawData, occurrenceDate);
      const exdatedICS = addExdate(item.rawData, occurrenceDate);

      const newUid = crypto.randomUUID();
      const calendarUrl = item.objectUrl.replace(/\/[^/]+$/, '/');
      const newObjectUrl = `${calendarUrl}${newUid}.ics`;
      const newICS = buildStandaloneICS(newUid, event.type, event.summary, description, newStart, newEnd);

      // Optimistic: EXDATE the master in local state + add new standalone item
      const exDateKey = occurrenceDate.toISOString().substring(0, 10);
      const exdatedComponent = {
        ...item.component,
        exdate: { ...(item.component.exdate ?? {}), [exDateKey]: occurrenceDate },
      };
      const parsedNew = ical.parseICS(newICS);
      const newComponent = Object.values(parsedNew).find(
        (c) => (c.type === 'VEVENT' || c.type === 'VTODO') && (c as any).uid === newUid,
      ) as StoredItem['component'] | undefined;

      const updatedItems = items.map((i) => i === item ? { ...i, component: exdatedComponent, rawData: exdatedICS } : i);
      const nextItems = newComponent
        ? [...updatedItems, { component: newComponent, calendarName: item.calendarName, calendarColor: item.calendarColor, objectUrl: newObjectUrl, etag: undefined, rawData: newICS }]
        : updatedItems;
      set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
      // Undo: restore the master's pre-EXDATE ICS + drop the detached standalone.
      get().recordUndo(`Move "${event.summary}"`, [upsertOp(item), removeOp(newObjectUrl)]);

      try {
        const client = await getClient();
        const res = await client.updateCalendarObject({
          calendarObject: { url: item.objectUrl, data: exdatedICS, etag: item.etag },
        }) as Response | undefined;
        if ((res?.status ?? 0) >= 400) {
          console.error('[vcalendar] detach EXDATE PUT failed:', res?.status);
          set({ items, events: expandItems(items, weekOffset) });
          return;
        }
        await (client as any).createCalendarObject({
          calendar: { url: calendarUrl },
          filename: `${newUid}.ics`,
          iCalString: newICS,
        });
        set((state) => ({
          items: state.items.map((i) => i.component.uid === event.baseUid ? { ...i, etag: undefined } : i),
        }));
      } catch (err) {
        console.error('[vcalendar] detach occurrence error:', err);
        set({ items, events: expandItems(items, weekOffset) });
      }
      return;
    }

    // Non-recurring or "all" scope: update times in place
    const updatedComponent = { ...item.component, start: newStart, end: newEnd };
    const updatedItems = items.map((i) => i === item ? { ...i, component: updatedComponent } : i);
    set({ items: updatedItems, events: expandItems(updatedItems, weekOffset) });
    // Undo: restore the original ICS (pre-move times).
    get().recordUndo(`Move "${event.summary}"`, [upsertOp(item)]);

    try {
      const updatedICS = updateICSTimes(item.rawData, newStart, newEnd);
      const client = await getClient();
      const res = await client.updateCalendarObject({
        calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
      }) as Response | undefined;

      const status = res?.status ?? 0;
      if (status >= 400) {
        console.error('[vcalendar] CalDAV PUT failed:', status, item.objectUrl);
        set({ items, events: expandItems(items, weekOffset) });
        return;
      }

      set((state) => ({
        items: state.items.map((i) =>
          i.component.uid === event.baseUid ? { ...i, rawData: updatedICS, etag: undefined } : i
        ),
      }));

      if (isRecurringOccurrence && scope === 'all') {
        await get().fetch();
      }
    } catch (err) {
      console.error('[vcalendar] CalDAV update network error:', err);
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  updateEventDetails: async (event, opts, scope, targetCalendarName) => {
    const { items, weekOffset, calendars } = get();
    const item = items.find((i) => i.component.uid === event.baseUid);
    if (!item) return;

    const isRecurring = event.uid !== event.baseUid;
    const calendarChanged = !!targetCalendarName && targetCalendarName !== item.calendarName;
    const targetCalMeta = calendarChanged ? calendars.find((c) => c.name === targetCalendarName) : undefined;

    // Single occurrence of a recurring series → detach: EXDATE master + create standalone event
    if (isRecurring && scope === 'single') {
      const occurrenceDate = event.occurrenceStart ?? event.start;
      const exdatedICS = addExdate(item.rawData, occurrenceDate);

      const newUid = crypto.randomUUID();
      const srcCalendarUrl = item.objectUrl.replace(/\/[^/]+$/, '/');
      const destCalendarUrl = targetCalMeta
        ? (targetCalMeta.url.endsWith('/') ? targetCalMeta.url : targetCalMeta.url + '/')
        : srcCalendarUrl;
      const newICS = buildStandaloneICS(newUid, event.type, opts.summary, opts.description, opts.start, opts.end);

      // Optimistic: EXDATE master + add new standalone item
      const exDateKey = occurrenceDate.toISOString().substring(0, 10);
      const exdatedComponent = {
        ...item.component,
        exdate: { ...(item.component.exdate ?? {}), [exDateKey]: occurrenceDate },
      };
      const parsedNew = ical.parseICS(newICS);
      const newComponent = Object.values(parsedNew).find(
        (c) => (c.type === 'VEVENT' || c.type === 'VTODO') && (c as any).uid === newUid,
      ) as StoredItem['component'] | undefined;

      const newCalName = targetCalMeta?.name ?? item.calendarName;
      const newCalColor = targetCalMeta?.color ?? item.calendarColor;
      const updatedItems = items.map((i) => i === item ? { ...i, component: exdatedComponent, rawData: exdatedICS } : i);
      const nextItems = newComponent
        ? [...updatedItems, { component: newComponent, calendarName: newCalName, calendarColor: newCalColor, objectUrl: `${destCalendarUrl}${newUid}.ics`, etag: undefined, rawData: newICS }]
        : updatedItems;
      set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
      // Undo: restore the master's pre-EXDATE ICS + drop the detached standalone.
      get().recordUndo(`Edit "${event.summary}"`, [upsertOp(item), removeOp(`${destCalendarUrl}${newUid}.ics`)]);

      try {
        const client = await getClient();
        const res = await client.updateCalendarObject({
          calendarObject: { url: item.objectUrl, data: exdatedICS, etag: item.etag },
        }) as Response | undefined;
        if ((res?.status ?? 0) >= 400) {
          console.error('[vcalendar] detach EXDATE PUT failed:', res?.status);
          set({ items, events: expandItems(items, weekOffset) });
          return;
        }
        await (client as any).createCalendarObject({
          calendar: { url: destCalendarUrl },
          filename: `${newUid}.ics`,
          iCalString: newICS,
        });
      } catch (err) {
        console.error('[vcalendar] detach occurrence (details) error:', err);
        set({ items, events: expandItems(items, weekOffset) });
      }
      return;
    }

    // Non-recurring or "all" scope: update fields, then move or update in-place.
    // For recurring "all" edits, preserve the master's original DTSTART date so only
    // the time-of-day changes — preventing the base date from jumping to the clicked occurrence.
    let allOpts = opts;
    if (isRecurring && item.component.start) {
      const masterDate = item.component.start as Date;
      const newStart = new Date(masterDate);
      newStart.setHours(opts.start.getHours(), opts.start.getMinutes(), 0, 0);
      const durationMs = opts.end ? opts.end.getTime() - opts.start.getTime() : 0;
      const newEnd = opts.end ? new Date(newStart.getTime() + durationMs) : undefined;
      allOpts = { ...opts, start: newStart, end: newEnd };
    }
    const updatedICS = updateEventFull(item.rawData, allOpts, 'all', event.occurrenceStart ?? event.start, event.type);

    const undoSnapshot = upsertOp(item); // original ICS @ original calendar
    try {
      const client = await getClient();
      if (calendarChanged && targetCalMeta) {
        const targetUrl = targetCalMeta.url.endsWith('/') ? targetCalMeta.url : targetCalMeta.url + '/';
        const filename = item.objectUrl.split('/').pop() ?? `${crypto.randomUUID()}.ics`;
        await (client as any).createCalendarObject({
          calendar: { url: targetUrl },
          filename,
          iCalString: updatedICS,
        });
        await client.deleteCalendarObject({
          calendarObject: { url: item.objectUrl, etag: item.etag },
        });
        // Undo: remove the copy in the new calendar + restore the original.
        get().recordUndo(`Edit "${event.summary}"`, [removeOp(`${targetUrl}${filename}`), undoSnapshot]);
      } else {
        const res = await client.updateCalendarObject({
          calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
        }) as Response | undefined;
        if ((res?.status ?? 0) >= 400) {
          console.error('[vcalendar] updateEventDetails PUT failed:', res?.status);
          return;
        }
        get().recordUndo(`Edit "${event.summary}"`, [undoSnapshot]);
      }
      await get().fetch();
    } catch (err) {
      console.error('[vcalendar] updateEventDetails error:', err);
    }
  },

  deleteEvent: async (event, scope) => {
    const { items, weekOffset } = get();
    const item = items.find((i) => i.component.uid === event.baseUid);
    if (!item) return;

    const isRecurring = event.uid !== event.baseUid;
    const removeWhole = !isRecurring || scope === 'all';

    // Apply the optimistic state SYNCHRONOUSLY, before any `await` (getClient may
    // do a network login on first use). Otherwise the occurrence renders one more
    // frame — the flash the user sees — before the exclusion lands.
    let updatedICS = '';
    if (removeWhole) {
      const nextItems = items.filter((i) => i !== item);
      set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
    } else {
      const occurrenceDate = event.occurrenceStart ?? event.start;
      const dateKey = occurrenceDate.toISOString().substring(0, 10);
      updatedICS = addExdate(item.rawData, occurrenceDate);
      const nextItems = items.map((i) =>
        i === item
          ? {
              ...i,
              rawData: updatedICS,
              component: {
                ...i.component,
                exdate: { ...(i.component.exdate ?? {}), [dateKey]: occurrenceDate },
              },
            }
          : i,
      );
      set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
    }
    // Undo: re-create the whole object, or restore the master's pre-EXDATE ICS.
    get().recordUndo(
      removeWhole ? `Delete "${event.summary}"` : `Delete occurrence of "${event.summary}"`,
      [upsertOp(item)],
    );

    try {
      const client = await getClient();
      if (removeWhole) {
        await client.deleteCalendarObject({
          calendarObject: { url: item.objectUrl, etag: item.etag },
        });
      } else {
        const res = await client.updateCalendarObject({
          calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
        }) as Response | undefined;
        if ((res?.status ?? 0) >= 400) {
          console.error('[vcalendar] deleteEvent EXDATE PUT failed:', res?.status);
          set({ items, events: expandItems(items, weekOffset) });
        }
      }
    } catch (err) {
      console.error('[vcalendar] deleteEvent error:', err);
      // Restore the pre-delete snapshot on failure (all paths are optimistic).
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  deleteEvents: async (eventsToDelete) => {
    const { items, weekOffset } = get();

    // Split into non-recurring (full delete) and recurring occurrences (EXDATE only)
    const nonRecurring = eventsToDelete.filter((e) => e.uid === e.baseUid);
    const recurringOccurrences = eventsToDelete.filter((e) => e.uid !== e.baseUid);

    // Group recurring occurrences by baseUid so we chain all EXDATEs onto one ICS per series
    const recurringByBase = new Map<string, CalendarEvent[]>();
    for (const ev of recurringOccurrences) {
      const arr = recurringByBase.get(ev.baseUid) ?? [];
      arr.push(ev);
      recurringByBase.set(ev.baseUid, arr);
    }

    // Build updated ICS strings for each affected series
    const seriesUpdates = [...recurringByBase.entries()].flatMap(([baseUid, occurrences]) => {
      const item = items.find((i) => i.component.uid === baseUid);
      if (!item) return [];
      let updatedICS = item.rawData;
      for (const ev of occurrences) {
        updatedICS = addExdate(updatedICS, ev.occurrenceStart ?? ev.start);
      }
      return [{ item, updatedICS }];
    });

    // Optimistic update: remove non-recurring items; patch exdate on recurring items
    const removedBaseUids = new Set(nonRecurring.map((e) => e.baseUid));
    let nextItems = items.filter((i) => !removedBaseUids.has(i.component.uid ?? ''));
    for (const { item, updatedICS } of seriesUpdates) {
      nextItems = nextItems.map((i) =>
        i === item ? { ...i, rawData: updatedICS } : i,
      );
    }
    // Also patch the in-memory exdate so expandItems hides the occurrences immediately
    for (const ev of recurringOccurrences) {
      const dateKey = (ev.occurrenceStart ?? ev.start).toISOString().substring(0, 10);
      nextItems = nextItems.map((i) => {
        if (i.component.uid !== ev.baseUid) return i;
        return {
          ...i,
          component: {
            ...i.component,
            exdate: { ...(i.component.exdate ?? {}), [dateKey]: ev.occurrenceStart ?? ev.start },
          },
        };
      });
    }
    set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
    // Undo: restore every removed object + each affected series' pre-EXDATE master.
    const undoOps: InverseOp[] = [];
    for (const ev of nonRecurring) {
      const it = items.find((i) => i.component.uid === ev.baseUid);
      if (it) undoOps.push(upsertOp(it));
    }
    for (const { item } of seriesUpdates) undoOps.push(upsertOp(item));
    get().recordUndo(`Delete ${eventsToDelete.length} events`, undoOps);

    try {
      const client = await getClient();
      await Promise.all([
        ...nonRecurring.map((ev) => {
          const item = items.find((i) => i.component.uid === ev.baseUid);
          if (!item) return Promise.resolve();
          return client.deleteCalendarObject({ calendarObject: { url: item.objectUrl, etag: item.etag } });
        }),
        ...seriesUpdates.map(({ item, updatedICS }) =>
          client.updateCalendarObject({
            calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
          }),
        ),
      ]);
    } catch (err) {
      console.error('[vcalendar] deleteEvents error:', err);
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  toggleTaskComplete: async (uid) => {
    const { items, weekOffset } = get();
    const item = items.find((i) => i.component.uid === uid && i.component.type === 'VTODO');
    if (!item) return;

    const wasCompleted = /^STATUS:COMPLETED/m.test(item.rawData);
    const updatedICS = setTaskStatus(item.rawData, !wasCompleted);

    const nextItems = items.map((i) => (i === item ? { ...i, rawData: updatedICS } : i));
    set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
    get().recordUndo(`${wasCompleted ? 'Reopen' : 'Complete'} "${sumOf(item)}"`, [upsertOp(item)]);

    try {
      const client = await getClient();
      await client.updateCalendarObject({
        calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
      });
    } catch (err) {
      console.error('[vcalendar] toggleTaskComplete error:', err);
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  updateTaskDetails: async (uid, opts, targetCalendarName) => {
    const { items, weekOffset, calendars } = get();
    const item = items.find((i) => i.component.uid === uid && i.component.type === 'VTODO');
    if (!item) return;

    const updatedICS = updateTaskFull(item.rawData, opts);
    const calendarChanged = !!targetCalendarName && targetCalendarName !== item.calendarName;
    const targetCalMeta = calendarChanged ? calendars.find((c) => c.name === targetCalendarName) : undefined;
    const undoSnapshot = upsertOp(item); // original ICS @ original calendar

    if (!calendarChanged) {
      // Optimistic update for same-calendar case
      const parsedNew = ical.parseICS(updatedICS);
      const newComponent = Object.values(parsedNew).find(
        (c) => (c.type === 'VTODO') && (c as any).uid === uid,
      ) as StoredItem['component'] | undefined;
      const nextItems = items.map((i) =>
        i === item ? { ...i, component: newComponent ?? i.component, rawData: updatedICS } : i,
      );
      set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
      get().recordUndo(`Edit task "${opts.summary}"`, [undoSnapshot]);
    }

    try {
      const client = await getClient();
      if (calendarChanged && targetCalMeta) {
        const targetUrl = targetCalMeta.url.endsWith('/') ? targetCalMeta.url : targetCalMeta.url + '/';
        const filename = item.objectUrl.split('/').pop() ?? `${crypto.randomUUID()}.ics`;
        await (client as any).createCalendarObject({
          calendar: { url: targetUrl },
          filename,
          iCalString: updatedICS,
        });
        await client.deleteCalendarObject({
          calendarObject: { url: item.objectUrl, etag: item.etag },
        });
        get().recordUndo(`Edit task "${opts.summary}"`, [removeOp(`${targetUrl}${filename}`), undoSnapshot]);
        await get().fetch();
      } else {
        await client.updateCalendarObject({
          calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
        });
      }
    } catch (err) {
      console.error('[vcalendar] updateTaskDetails error:', err);
      if (!calendarChanged) set({ items, events: expandItems(items, weekOffset) });
    }
  },

  deleteTask: async (uid) => {
    const { items, weekOffset } = get();
    const item = items.find((i) => i.component.uid === uid && i.component.type === 'VTODO');
    if (!item) return;
    const nextItems = items.filter((i) => i !== item);
    set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
    get().recordUndo(`Delete task "${sumOf(item)}"`, [upsertOp(item)]);
    try {
      const client = await getClient();
      await client.deleteCalendarObject({ calendarObject: { url: item.objectUrl, etag: item.etag } });
    } catch (err) {
      console.error('[vcalendar] deleteTask error:', err);
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  deleteTasks: async (uids) => {
    const uidSet = new Set(uids);
    const { items, weekOffset } = get();
    const toDelete = items.filter((i) => uidSet.has(i.component.uid ?? '') && i.component.type === 'VTODO');
    if (!toDelete.length) return;
    const nextItems = items.filter((i) => !toDelete.includes(i));
    set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
    get().recordUndo(`Delete ${toDelete.length} tasks`, toDelete.map(upsertOp));
    try {
      const client = await getClient();
      await Promise.all(
        toDelete.map((item) =>
          client.deleteCalendarObject({ calendarObject: { url: item.objectUrl, etag: item.etag } }),
        ),
      );
    } catch (err) {
      console.error('[vcalendar] deleteTasks error:', err);
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  createNewEvent: async (calendarName, opts) => {
    const { items, weekOffset, calendars } = get();
    const calMeta = calendars.find((c) => c.name === calendarName);
    if (!calMeta) return;

    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const fmtDate = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    };
    const now = new Date();
    const uid = crypto.randomUUID();
    const calendarUrl = calMeta.url.endsWith('/') ? calMeta.url : `${calMeta.url}/`;
    const objectUrl = `${calendarUrl}${uid}.ics`;

    const valarmLines = (opts.reminders ?? []).flatMap((m) => {
      const trigger = m >= 1440
        ? `TRIGGER:-P${Math.floor(m / 1440)}D`
        : m >= 60
          ? `TRIGGER:-PT${Math.floor(m / 60)}H`
          : `TRIGGER:-PT${m}M`;
      return ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', trigger, 'END:VALARM'];
    });

    const endKey = opts.type === 'VTODO' ? 'DUE' : 'DTEND';
    const dtStart = opts.start
      ? (opts.allDay ? `DTSTART;VALUE=DATE:${fmtDate(opts.start)}` : `DTSTART:${fmt(opts.start)}`)
      : null;
    const dtEnd = opts.end
      ? (opts.allDay ? `${endKey};VALUE=DATE:${fmtDate(opts.end)}` : `${endKey}:${fmt(opts.end)}`)
      : null;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//vcalendar//EN',
      `BEGIN:${opts.type}`,
      `UID:${uid}`,
      `DTSTAMP:${fmt(now)}`,
      ...(dtStart ? [dtStart] : []),
      ...(dtEnd ? [dtEnd] : []),
      `SUMMARY:${opts.summary || 'New Event'}`,
      ...(opts.description ? [`DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}`] : []),
      ...(opts.rrule ? [`RRULE:${opts.rrule}`] : []),
      ...valarmLines,
      `END:${opts.type}`,
      'END:VCALENDAR',
    ].join('\r\n');

    // Optimistic add — parse the ICS we already have and insert into local state immediately
    const parsed = ical.parseICS(ics);
    const component = Object.values(parsed).find(
      (c) => (c.type === 'VEVENT' || c.type === 'VTODO') && (c as any).uid === uid,
    ) as StoredItem['component'] | undefined;

    if (component) {
      const newItem: StoredItem = {
        component,
        calendarName,
        calendarColor: calMeta.color,
        objectUrl,
        etag: undefined,
        rawData: ics,
      };
      const nextItems = [...items, newItem];
      set({ items: nextItems, events: expandItems(nextItems, weekOffset) });
      // Undo: remove the created object. Recorded before any await so batches
      // (paste / preset drop) collect every item's op before commit.
      get().recordUndo(`Create "${opts.summary || 'event'}"`, [removeOp(objectUrl)]);
    }

    try {
      const client = await getClient();
      await (client as any).createCalendarObject({
        calendar: { url: calendarUrl },
        filename: `${uid}.ics`,
        iCalString: ics,
      });
    } catch (err) {
      console.error('[vcalendar] createNewEvent failed:', err);
      // Revert on failure
      set({ items, events: expandItems(items, weekOffset) });
    }
  },

  createEvent: async (event) => {
    const { items } = get();
    const item = items.find((i) => i.component.uid === event.baseUid);
    if (!item) return;
    await get().createNewEvent(item.calendarName, {
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description ?? '',
      rrule: '',
      reminders: [],
      type: event.type,
      allDay: event.allDay,
    });
  },

  createJournal: async (calendarName, opts) => {
    const { items, calendars } = get();
    const calMeta = calendars.find((c) => c.name === calendarName);
    if (!calMeta) return;

    const uid = crypto.randomUUID();
    const calendarUrl = calMeta.url.endsWith('/') ? calMeta.url : `${calMeta.url}/`;
    const objectUrl = `${calendarUrl}${uid}.ics`;
    const ics = buildJournalICS(uid, opts.summary, opts.description, opts.icon);

    const parsed = ical.parseICS(ics);
    const component = Object.values(parsed).find(
      (c) => c.type === 'VJOURNAL' && (c as any).uid === uid,
    ) as StoredItem['component'] | undefined;

    if (component) {
      const newItem: StoredItem = {
        component,
        calendarName,
        calendarColor: calMeta.color,
        objectUrl,
        etag: undefined,
        rawData: ics,
      };
      const nextItems = [...items, newItem];
      set({ items: nextItems, journals: nextItems.filter((i) => i.component.type === 'VJOURNAL') });
    }

    try {
      const client = await getClient();
      await (client as any).createCalendarObject({
        calendar: { url: calendarUrl },
        filename: `${uid}.ics`,
        iCalString: ics,
      });
    } catch (err) {
      console.error('[vcalendar] createJournal failed:', err);
      set({ items, journals: items.filter((i) => i.component.type === 'VJOURNAL') });
    }
  },

  updateJournal: async (uid, opts, targetCalendarName) => {
    const { items, calendars } = get();
    const item = items.find((i) => i.component.uid === uid && i.component.type === 'VJOURNAL');
    if (!item) return;

    const updatedICS = updateJournalFull(item.rawData, { summary: opts.summary, description: opts.description, icon: opts.icon });
    const calendarChanged = !!targetCalendarName && targetCalendarName !== item.calendarName;
    const targetCalMeta = calendarChanged ? calendars.find((c) => c.name === targetCalendarName) : undefined;

    if (!calendarChanged) {
      const parsed = ical.parseICS(updatedICS);
      const newComponent = Object.values(parsed).find(
        (c) => c.type === 'VJOURNAL' && (c as any).uid === uid,
      ) as StoredItem['component'] | undefined;
      const nextItems = items.map((i) =>
        i === item ? { ...i, component: newComponent ?? i.component, rawData: updatedICS } : i,
      );
      set({ items: nextItems, journals: nextItems.filter((i) => i.component.type === 'VJOURNAL') });
    }

    try {
      const client = await getClient();
      if (calendarChanged && targetCalMeta) {
        const targetUrl = targetCalMeta.url.endsWith('/') ? targetCalMeta.url : targetCalMeta.url + '/';
        const filename = item.objectUrl.split('/').pop() ?? `${uid}.ics`;
        await (client as any).createCalendarObject({ calendar: { url: targetUrl }, filename, iCalString: updatedICS });
        await client.deleteCalendarObject({ calendarObject: { url: item.objectUrl, etag: item.etag } });
        await get().fetch();
      } else {
        await client.updateCalendarObject({
          calendarObject: { url: item.objectUrl, data: updatedICS, etag: item.etag },
        });
      }
    } catch (err) {
      console.error('[vcalendar] updateJournal failed:', err);
      if (!calendarChanged) set({ items, journals: items.filter((i) => i.component.type === 'VJOURNAL') });
    }
  },

  deleteJournal: async (uid) => {
    const { items } = get();
    const item = items.find((i) => i.component.uid === uid && i.component.type === 'VJOURNAL');
    if (!item) return;
    const nextItems = items.filter((i) => i !== item);
    set({ items: nextItems, journals: nextItems.filter((i) => i.component.type === 'VJOURNAL') });
    try {
      const client = await getClient();
      await client.deleteCalendarObject({ calendarObject: { url: item.objectUrl, etag: item.etag } });
    } catch (err) {
      console.error('[vcalendar] deleteJournal failed:', err);
      set({ items, journals: items.filter((i) => i.component.type === 'VJOURNAL') });
    }
  },
}));
