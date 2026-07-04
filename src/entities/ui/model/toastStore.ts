import { create } from 'zustand';

interface ToastStore {
  message: string | null;
  seq: number; // bumped each show so the Toast can restart its dismiss timer
  showToast: (message: string) => void;
  clearToast: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  message: null,
  seq: 0,
  showToast: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  clearToast: () => set({ message: null }),
}));
