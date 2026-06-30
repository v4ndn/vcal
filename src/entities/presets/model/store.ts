import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarEvent } from '../../event/model/types';

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
  clipboard: CalendarEvent[];
  // Transient drag state
  activeDragPreset: TaskPreset | null;

  savePreset: (name: string, events: CalendarEvent[]) => void;
  deletePreset: (id: string) => void;
  setSelectedUids: (arg: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setClipboard: (events: CalendarEvent[]) => void;
  setActiveDragPreset: (preset: TaskPreset | null) => void;
}

export const usePresetsStore = create<PresetsStore>()(
  persist(
    (set) => ({
      presets: [],
      selectedUids: new Set<string>(),
      clipboard: [],
      activeDragPreset: null,

      savePreset: (name, events) => {
        if (!events.length) return;
        // Each selected occurrence becomes its own non-recurring preset entry (rrule stripped).
        const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
        const anchorMs = sorted[0].start.getTime();
        set((state) => ({
          presets: [
            ...state.presets,
            {
              id: crypto.randomUUID(),
              name: name.trim() || 'Preset',
              events: sorted.map((ev) => ({
                summary: ev.summary,
                description: ev.description ?? '',
                offsetMs: ev.start.getTime() - anchorMs,
                durationMs: ev.end ? ev.end.getTime() - ev.start.getTime() : 3_600_000,
                rrule: '',
                reminders: [],
                calendarName: ev.calendarName,
                type: ev.type,
                allDay: ev.allDay ?? false,
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
