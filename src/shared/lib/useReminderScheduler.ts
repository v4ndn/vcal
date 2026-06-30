import { useEffect, useRef } from 'react';
import { useCalendarStore } from '../../entities/calendar/model/store';
import { parseICSRemindersList, parseICSTaskDates } from './icsUpdate';
import notificationSoundUrl from '../../assets/notification.mp3';

const POLL_MS = 30_000;
const isTauri = '__TAURI_INTERNALS__' in window;

async function sendNotification(title: string, body: string) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('notify', { title, body });
  } else if (Notification.permission === 'granted') {
    new Notification(title, { body, silent: true });
  }
}

async function requestPermission() {
  if (!isTauri && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => {});
  }
}

function parseReminderMinutesList(rawData: string): number[] {
  const list = parseICSRemindersList(rawData);
  if (list.length > 0) return list;
  // Fallback: handle TRIGGER with property parameters (e.g. TRIGGER;VALUE=DURATION:-PT5M)
  const d = rawData.match(/^TRIGGER(?:;[^:\r\n]*)?:-P(\d+)D/m);
  if (d) return [parseInt(d[1]) * 1440];
  const h = rawData.match(/^TRIGGER(?:;[^:\r\n]*)?:-PT(\d+)H/m);
  if (h) return [parseInt(h[1]) * 60];
  const m = rawData.match(/^TRIGGER(?:;[^:\r\n]*)?:-PT(\d+)M/m);
  if (m) return [parseInt(m[1])];
  return [];
}

function getItemStart(item: { component: { start?: Date; type: 'VEVENT' | 'VTODO' }; rawData: string }): Date | undefined {
  if (item.component.start) return item.component.start;
  if (item.component.type === 'VTODO') {
    const { start, due } = parseICSTaskDates(item.rawData);
    return start ?? due;
  }
  return undefined;
}

function notificationBody(type: 'VEVENT' | 'VTODO', mins: number): string {
  if (mins === 0) return type === 'VTODO' ? 'Due now' : 'Starting now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return type === 'VTODO' ? `Due in ${parts.join(' ')}` : `Starting in ${parts.join(' ')}`;
}

export function useReminderScheduler() {
  const items = useCalendarStore((s) => s.items);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestPermission().catch(() => {});

    function check() {
      const now = Date.now();

      for (const item of items) {
        if (item.component.type === 'VJOURNAL') continue;
        const reminderList = parseReminderMinutesList(item.rawData);
        if (reminderList.length === 0) continue;

        const start = getItemStart(item as Parameters<typeof getItemStart>[0]);
        if (!start) continue;

        for (const mins of reminderList) {
          if (mins < 0) continue;

          const offsetMs = mins * 60_000;
          const searchFrom = new Date(now - POLL_MS + offsetMs);
          const searchTo = new Date(now + offsetMs);

          const occurrences: Date[] = item.component.rrule
            ? item.component.rrule.between(searchFrom, searchTo, true)
            : (start >= searchFrom && start <= searchTo ? [start] : []);

          for (const occ of occurrences) {
            const triggerTime = occ.getTime() - offsetMs;
            const key = `${item.component.uid}::${mins}::${triggerTime}`;
            if (firedRef.current.has(key)) continue;
            firedRef.current.add(key);

            const title = item.component.summary ?? 'Reminder';
            const body = notificationBody(item.component.type as 'VEVENT' | 'VTODO', mins);
            console.log('[reminder] firing:', title, '—', body, '| trigger:', new Date(triggerTime).toLocaleTimeString());
            sendNotification(title, body).catch((err) => console.error('[reminder] sendNotification failed:', err));
            if (!isTauri) {
              new Audio(notificationSoundUrl).play().catch((err) => console.error('[reminder] audio failed:', err));
            }
          }
        }
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [items]);
}
