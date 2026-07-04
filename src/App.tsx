import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, ListTodo, BookOpen, Settings, RefreshCw, LogOut, Keyboard } from 'lucide-react';
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
import Preferences from './widgets/ThemePreferences/ThemePreferences';
import ShortcutsModal from './shared/ui/ShortcutsModal';
import Toast from './shared/ui/Toast';

const pageVariants = {
  enter:  { opacity: 0, scale: 1.01 },
  center: { opacity: 1, scale: 1 },
  exit:   { opacity: 0, scale: 0.99 },
};

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
  const location = useLocation();

  const config = useAuthStore((s) => s.config);
  const clearConfig = useAuthStore((s) => s.clearConfig);
  const fetch = useCalendarStore((s) => s.fetch);
  const loading = useCalendarStore((s) => s.loading);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const [showThemePrefs, setShowThemePrefs] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigate = useNavigate();

  const activeId = useThemeStore((s) => s.activeId);
  const custom = useThemeStore((s) => s.custom);
  const sidebarSide = useThemeStore((s) => s.sidebarSide);
  const hideScrollbars = useThemeStore((s) => s.hideScrollbars);

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
    const suppress = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('hide-scrollbars', hideScrollbars);
  }, [hideScrollbars]);

  useEffect(() => {
    if (!config) return;
    resetCalendarClient();
    fetch().catch(console.error);
  }, [config, fetch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        useCalendarStore.getState().undo().catch(console.error);
        return;
      }
      if (e.key === '?') { setShowShortcuts((v) => !v); return; }
      if (e.key === 'r' || e.key === 'R') { if (!loading) fetch().catch(console.error); return; }
      if (e.key === '1') { navigate('/'); return; }
      if (e.key === '2') { navigate('/tasks'); return; }
      if (e.key === '3') { navigate('/journals'); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetch, loading, navigate]);

  if (!config) return <LoginScreen />;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-th-bg">
      {/* Top navbar */}
      <header className="flex items-center justify-between px-4 h-[49px] border-b border-th-border bg-th-surface shrink-0 z-50">
        <span className="text-sm font-bold tracking-tight text-th-text">vcal</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts (?)"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
          >
            <Keyboard size={13} />
          </button>
          <button
            onClick={() => setShowThemePrefs(true)}
            title="Preferences"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={() => fetch().catch(console.error)}
            disabled={loading}
            title="Refresh"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors disabled:opacity-30"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={clearConfig}
            title="Disconnect"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {sidebarSide !== 'right' && <CalendarSidebar />}

        <div className="flex-1 min-w-0 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              className="absolute inset-0"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.09, ease: 'easeOut' }}
            >
              <Routes location={location}>
                <Route path="/" element={<WeekStrip />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/journals" element={<JournalPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>

        {sidebarSide === 'right' && <CalendarSidebar />}
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

      {showThemePrefs && <Preferences onClose={() => setShowThemePrefs(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <Toast />
      <PresetDragOverlay />
    </div>
  );
}

export default App;
