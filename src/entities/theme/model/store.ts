import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeValues {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentFg: string;
  subtle: string;
  hover: string;
}

export interface PresetTheme {
  id: string;
  name: string;
  values: ThemeValues;
}

export const PRESET_THEMES: PresetTheme[] = [
  {
    id: 'light',
    name: 'Light',
    values: {
      bg: '#ffffff',
      surface: '#ffffff',
      border: '#f3f4f6',
      text: '#000000',
      muted: '#9ca3af',
      accent: '#000000',
      accentFg: '#ffffff',
      subtle: '#f3f4f6',
      hover: '#f9fafb',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    values: {
      bg: '#0f0f0f',
      surface: '#1a1a1a',
      border: '#2a2a2a',
      text: '#f9fafb',
      muted: '#6b7280',
      accent: '#f9fafb',
      accentFg: '#0f0f0f',
      subtle: '#262626',
      hover: '#1f1f1f',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    values: {
      bg: '#f5f0e8',
      surface: '#ede8dc',
      border: '#d4ccbb',
      text: '#3d2b1f',
      muted: '#8b7355',
      accent: '#5c3d2e',
      accentFg: '#f5f0e8',
      subtle: '#e0d8cc',
      hover: '#e8e0d0',
    },
  },
];

interface ThemeStore {
  activeId: string;
  custom: ThemeValues;
  hourHeight: number;
  setActiveId: (id: string) => void;
  applyPreset: (preset: PresetTheme) => void;
  setCustomValue: (key: keyof ThemeValues, value: string) => void;
  setHourHeight: (vh: number) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      activeId: 'light',
      custom: { ...PRESET_THEMES[0].values },
      hourHeight: 10,

      setActiveId: (id) => set({ activeId: id }),

      applyPreset: (preset) =>
        set({ activeId: preset.id, custom: { ...preset.values } }),

      setCustomValue: (key, value) =>
        set((s) => ({
          activeId: 'custom',
          custom: { ...s.custom, [key]: value },
        })),

      setHourHeight: (vh) => set({ hourHeight: Math.max(5, Math.min(30, vh)) }),
    }),
    { name: 'vcalendar-theme' },
  ),
);

export function resolveTheme(store: Pick<ThemeStore, 'activeId' | 'custom'>): ThemeValues {
  if (store.activeId === 'custom') return store.custom;
  return PRESET_THEMES.find((p) => p.id === store.activeId)?.values ?? PRESET_THEMES[0].values;
}
