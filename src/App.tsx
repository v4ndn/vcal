import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { CalendarDays, ListTodo, BookOpen } from 'lucide-react';
import { useCalendarStore, resetCalendarClient } from './entities/calendar/model/store';
import { useAuthStore } from './entities/auth/model/store';
import { usePresetsStore } from './entities/presets/model/store';
import { useUIStore } from './entities/ui/model/store';
import { useThemeStore, resolveTheme } from './entities/theme/model/store';
import { useReminderScheduler } from './shared/lib/useReminderScheduler';
import CalendarSidebar from './widgets/CalendarSidebar/CalendarSidebar';
import WeekStrip from './widgets/WeekStrip/WeekStrip';
import LoginScreen from './widgets/LoginScreen/LoginScreen';
import TasksPage from './pages/TasksPage';
import JournalPage from './pages/JournalPage';

function PresetDragOverlay() {
  const activeDragPreset = usePresetsStore((s) => s.activeDragPreset);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!activeDragPreset) return;
    function onMove(e: PointerEvent) {
      setPos({ x: e.clientX, y: e.clientY });
    }
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [activeDragPreset]);

  if (!activeDragPreset) return null;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ left: pos.x + 14, top: pos.y - 12 }}
    >
      <div className="bg-black text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl shadow-lg whitespace-nowrap">
        {activeDragPreset.name}
        <span className="ml-1.5 opacity-50">{activeDragPreset.events.length}×</span>
      </div>
    </div>
  );
}

function App() {
  const config = useAuthStore((s) => s.config);
  const fetch = useCalendarStore((s) => s.fetch);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const activeId = useThemeStore((s) => s.activeId);
  const custom = useThemeStore((s) => s.custom);

  useReminderScheduler();

  useEffect(() => {
    const theme = resolveTheme({ activeId, custom });
    const root = document.documentElement;
    root.style.setProperty('--th-bg', theme.bg);
    root.style.setProperty('--th-surface', theme.surface);
    root.style.setProperty('--th-border', theme.border);
    root.style.setProperty('--th-text', theme.text);
    root.style.setProperty('--th-muted', theme.muted);
    root.style.setProperty('--th-accent', theme.accent);
    root.style.setProperty('--th-accent-fg', theme.accentFg);
    root.style.setProperty('--th-subtle', theme.subtle);
    root.style.setProperty('--th-hover', theme.hover);
  }, [activeId, custom]);

  useEffect(() => {
    if (!config) return;
    resetCalendarClient();
    fetch().catch(console.error);
  }, [config, fetch]);

  if (!config) return <LoginScreen />;

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <CalendarSidebar />

      <div className="flex-1 min-w-0">
        <Routes>
          <Route path="/" element={<WeekStrip />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/journals" element={<JournalPage />} />
        </Routes>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-th-surface border-t border-th-border flex md:hidden z-20">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-th-text' : 'text-th-muted'
            }`
          }
        >
          <CalendarDays size={20} />
          Calendar
        </NavLink>
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-th-text' : 'text-th-muted'
            }`
          }
        >
          <ListTodo size={20} />
          Tasks
        </NavLink>
        <NavLink
          to="/journals"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-th-text' : 'text-th-muted'
            }`
          }
        >
          <BookOpen size={20} />
          Journal
        </NavLink>
      </nav>

      <PresetDragOverlay />
    </div>
  );
}

export default App;
