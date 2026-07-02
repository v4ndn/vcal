import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarEvent } from '../../event/model/types';
import type { CalendarTask } from '../../task/model/types';

export interface PresetEvent {
  summary: string;
  description: string;
  offsetMs: number;    // ms from anchor (first event's start)
  durationMs: number;  // ms; 0 = no end time
  rrule: string;
  reminders: number[];
  calendarName: string;
  type: 'VEVENT' | 'VTODO';
  allDay?: boolean;
}

export interface TaskPreset {
  id: string;
  name: string;
  events: PresetEvent[];
}

interface PresetsStore {
  presets: TaskPreset[];
  // Selection — lifted out of WeekStrip so the sidebar can read it
  selectedUids: Set<string>;
  selectedTaskUids: Set<string>;
  clipboard: CalendarEvent[];
  // Transient drag state
  activeDragPreset: TaskPreset | null;

  savePreset: (name: string, events: CalendarEvent[], tasks?: CalendarTask[]) => void;
  deletePreset: (id: string) => void;
  setSelectedUids: (arg: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedTaskUids: (arg: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setClipboard: (events: CalendarEvent[]) => void;
  setActiveDragPreset: (preset: TaskPreset | null) => void;
}

export const usePresetsStore = create<PresetsStore>()(
  persist(
    (set) => ({
      presets: [],
      selectedUids: new Set<string>(),
      selectedTaskUids: new Set<string>(),
      clipboard: [],
      activeDragPreset: null,

      savePreset: (name, events, tasks = []) => {
        type Anchor = { ms: number; entry: Omit<PresetEvent, 'offsetMs'> & { _ms: number } };
        const entries: Anchor[] = [
          ...events.map((ev) => ({
            ms: ev.start.getTime(),
            entry: {
              _ms: ev.start.getTime(),
              summary: ev.summary,
              description: ev.description ?? '',
              durationMs: ev.end ? ev.end.getTime() - ev.start.getTime() : 3_600_000,
              rrule: '',
              reminders: [],
              calendarName: ev.calendarName,
              type: ev.type,
              allDay: ev.allDay ?? false,
            },
          })),
          ...tasks
            .filter((t) => t.start != null)
            .map((t) => ({
              ms: t.start!.getTime(),
              entry: {
                _ms: t.start!.getTime(),
                summary: t.summary,
                description: t.description ?? '',
                durationMs: t.due ? t.due.getTime() - t.start!.getTime() : 0,
                rrule: '',
                reminders: [],
                calendarName: t.calendarName,
                type: 'VTODO' as const,
                allDay: false,
              },
            })),
        ].sort((a, b) => a.ms - b.ms);

        if (!entries.length) return;
        const anchorMs = entries[0].ms;

        set((state) => ({
          presets: [
            ...state.presets,
            {
              id: crypto.randomUUID(),
              name: name.trim() || 'Preset',
              events: entries.map(({ entry }) => ({
                summary: entry.summary,
                description: entry.description,
                offsetMs: entry._ms - anchorMs,
                durationMs: entry.durationMs,
                rrule: entry.rrule,
                reminders: entry.reminders,
                calendarName: entry.calendarName,
                type: entry.type,
                allDay: entry.allDay,
              })),
            },
          ],
        }));
      },

      deletePreset: (id) =>
        set((state) => ({ presets: state.presets.filter((p) => p.id !== id) })),

      setSelectedUids: (arg) =>
        set((state) => ({
          selectedUids: typeof arg === 'function' ? arg(state.selectedUids) : arg,
        })),

      setSelectedTaskUids: (arg) =>
        set((state) => ({
          selectedTaskUids: typeof arg === 'function' ? arg(state.selectedTaskUids) : arg,
        })),

      setClipboard: (events) => set({ clipboard: events }),

      setActiveDragPreset: (preset) => set({ activeDragPreset: preset }),
    }),
    {
      name: 'vcalendar-presets',
      // Only persist the preset list; selection/drag/clipboard are transient
      partialize: (state) => ({ presets: state.presets }),
    },
  ),
);
