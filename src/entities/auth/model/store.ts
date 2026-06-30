import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthConfig {
  serverUrl: string;
  username: string;
  password: string;
  authMethod: 'Basic' | 'Digest';
}

interface AuthStore {
  config: AuthConfig | null;
  setConfig: (config: AuthConfig) => void;
  clearConfig: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      config: null,
      setConfig: (config) => set({ config }),
      clearConfig: () => set({ config: null }),
    }),
    { name: 'vcalendar-auth' },
  ),
);
