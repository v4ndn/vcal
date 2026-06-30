import { create } from 'zustand';

export type TimeFilter =
  | 'all'
  | 'today'
  | 'next7'
  | 'current'
  | 'notStarted'
  | 'overdue'
  | 'completed'
  | 'incomplete';

interface TasksUIStore {
  timeFilter: TimeFilter;
  selectedDate: Date;
  setTimeFilter: (f: TimeFilter) => void;
  setSelectedDate: (d: Date) => void;
}

export const useTasksStore = create<TasksUIStore>((set) => ({
  timeFilter: 'all',
  selectedDate: new Date(),
  setTimeFilter: (f) => set({ timeFilter: f }),
  setSelectedDate: (d) => set({ selectedDate: d }),
}));
