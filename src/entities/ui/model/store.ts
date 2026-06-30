import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  selectedJournalCollection: string | null;
  setSelectedJournalCollection: (name: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  selectedJournalCollection: null,
  setSelectedJournalCollection: (name) => set({ selectedJournalCollection: name }),
}));
