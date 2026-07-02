import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarDays, ListTodo, Check, LogOut, RefreshCw,
  GripVertical, Plus, X, ChevronLeft, ChevronDown,
  Bookmark, LayoutList, Settings, BookOpen,
} from 'lucide-react';
import Preferences from '../ThemePreferences/ThemePreferences';
import { useUIStore } from '../../entities/ui/model/store';
import { useCalendarStore } from '../../entities/calendar/model/store';
import { useAuthStore } from '../../entities/auth/model/store';
import { usePresetsStore, type TaskPreset } from '../../entities/presets/model/store';
import { useTasksStore } from '../../entities/tasks/model/store';
import { useThemeStore } from '../../entities/theme/model/store';
import { weekGridEl } from '../../shared/lib/weekGridRef';
import { getWeekDays } from '../../shared/lib/week';
import { getTasks } from '../../shared/lib/getTasks';
import MiniCalendar from '../MiniCalendar/MiniCalendar';

// ── collapsible section ────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="px-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-th-hover transition-colors group"
      >
        <Icon size={12} className="text-th-muted shrink-0" />
        <span className="flex-1 text-[9px] font-semibold uppercase tracking-widest text-th-muted text-left">
          {label}
        </span>
        <ChevronDown
          size={11}
          className={`text-th-muted/50 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-0.5 pb-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── sidebar ────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/', label: 'Calendar', icon: CalendarDays },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/journals', label: 'Journals', icon: BookOpen },
] as const;


export default function CalendarSidebar() {
  const location = useLocation();
  const isCalendarRoute = location.pathname === '/';
  const isTasksRoute = location.pathname === '/tasks';
  const isJournalsRoute = location.pathname === '/journals';

  const calendarsMeta = useCalendarStore((s) => s.calendars);
  const hiddenCalendars = useCalendarStore((s) => s.hiddenCalendars);
  const toggleCalendar = useCalendarStore((s) => s.toggleCalendar);
  const loading = useCalendarStore((s) => s.loading);
  const fetch = useCalendarStore((s) => s.fetch);
  const weekOffset = useCalendarStore((s) => s.weekOffset);
  const createNewEvent = useCalendarStore((s) => s.createNewEvent);
  const allEvents = useCalendarStore((s) => s.events);
  const allItems = useCalendarStore((s) => s.items);
  const clearConfig = useAuthStore((s) => s.clearConfig);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const selectedJournalCollection = useUIStore((s) => s.selectedJournalCollection);
  const setSelectedJournalCollection = useUIStore((s) => s.setSelectedJournalCollection);

  const presets = usePresetsStore((s) => s.presets);
  const selectedUids = usePresetsStore((s) => s.selectedUids);
  const selectedTaskUids = usePresetsStore((s) => s.selectedTaskUids);
  const savePreset = usePresetsStore((s) => s.savePreset);
  const deletePreset = usePresetsStore((s) => s.deletePreset);
  const setActiveDragPreset = usePresetsStore((s) => s.setActiveDragPreset);

  const setSelectedDate = useTasksStore((s) => s.setSelectedDate);
  const HOUR_HEIGHT = useThemeStore((s) => s.hourHeight);
  const sidebarCompact = useThemeStore((s) => s.sidebarCompact);
  const sidebarSide = useThemeStore((s) => s.sidebarSide);
  const SNAP_VH = HOUR_HEIGHT / 4;

  const [showSaveForm, setShowSaveForm] = useState(false);
  const [showThemePrefs, setShowThemePrefs] = useState(false);

  const { register: registerPreset, handleSubmit: handlePresetSubmit, reset: resetPreset, watch: watchPreset } = useForm({
    defaultValues: { presetName: '' },
  });
  const presetName = watchPreset('presetName');

  const totalSelected = selectedUids.size + selectedTaskUids.size;

  function handleSavePreset({ presetName: name }: { presetName: string }) {
    const selectedEvents = allEvents.filter((ev) => selectedUids.has(ev.uid));
    const allTasksList = getTasks(allItems);
    const selectedTasks = allTasksList.filter((t) => selectedTaskUids.has(t.uid) && t.start != null);
    if (selectedEvents.length + selectedTasks.length < 2) return;
    savePreset(name, selectedEvents, selectedTasks);
    resetPreset();
    setShowSaveForm(false);
  }

  function startPresetDrag(e: React.PointerEvent, preset: TaskPreset) {
    e.preventDefault();
    setActiveDragPreset(preset);
    const days = getWeekDays(weekOffset);

    function onUp(ev: PointerEvent) {
      window.removeEventListener('pointerup', onUp);
      setActiveDragPreset(null);

      const el = weekGridEl;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (
        ev.clientX < rect.left || ev.clientX > rect.right ||
        ev.clientY < rect.top || ev.clientY > rect.bottom
      ) return;

      const gutterPx = 48;
      const colW = (rect.width - gutterPx) / 7;
      const dropColIdx = Math.max(0, Math.min(6, Math.floor((ev.clientX - rect.left - gutterPx) / colW)));
      const dropVh = Math.round(
        (((ev.clientY - rect.top + el.scrollTop) / window.innerHeight) * 100) / SNAP_VH,
      ) * SNAP_VH;

      const anchorDay = new Date(days[dropColIdx]);
      anchorDay.setHours(0, 0, 0, 0);
      const anchorStart = new Date(anchorDay.getTime() + (dropVh / HOUR_HEIGHT) * 3_600_000);

      // First timed event's offsetMs becomes the new zero so it aligns with the mouse
      const firstTimedOffset = preset.events.find(ev => !ev.allDay)?.offsetMs ?? 0;

      for (const presetEv of preset.events) {
        let evStart: Date;
        let evEnd: Date | undefined;

        if (presetEv.allDay) {
          // All-day: place on the correct day using day-count offset; ignore mouse Y entirely
          const dayOffset = Math.round(presetEv.offsetMs / 86_400_000);
          const targetDay = new Date(anchorDay);
          targetDay.setDate(targetDay.getDate() + dayOffset);
          targetDay.setHours(0, 0, 0, 0);
          evStart = targetDay;
          evEnd = new Date(targetDay);
          evEnd.setDate(evEnd.getDate() + 1);
        } else {
          evStart = new Date(anchorStart.getTime() + (presetEv.offsetMs - firstTimedOffset));
          evEnd = presetEv.durationMs > 0 ? new Date(evStart.getTime() + presetEv.durationMs) : undefined;
        }

        createNewEvent(presetEv.calendarName, {
          summary: presetEv.summary,
          start: evStart,
          end: evEnd,
          description: presetEv.description,
          rrule: presetEv.rrule,
          // backward-compat: old saved presets may have reminderMinutes instead of reminders
          reminders: (presetEv as any).reminders ?? ((presetEv as any).reminderMinutes != null ? [(presetEv as any).reminderMinutes] : []),
          type: presetEv.type,
          allDay: presetEv.allDay,
        }).catch(console.error);
      }
    }

    window.addEventListener('pointerup', onUp, { once: true });
  }

  return (
    <>
    <aside className={`${sidebarCompact ? 'w-14' : 'w-52'} shrink-0 h-full flex flex-col ${sidebarSide === 'right' ? 'border-l' : 'border-r'} border-th-border bg-th-surface
      fixed inset-y-0 ${sidebarSide === 'right' ? 'right-0' : 'left-0'} z-40 transition-all duration-200
      md:static md:translate-x-0
      ${sidebarOpen ? 'translate-x-0' : sidebarSide === 'right' ? 'translate-x-full' : '-translate-x-full'}`}>

      {sidebarCompact ? (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Compact: action buttons */}
          <div className="flex flex-col items-center gap-0.5 px-1 py-2 border-b border-th-border shrink-0">
            <button onClick={() => setShowThemePrefs(true)} title="Preferences" className="w-8 h-8 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors">
              <Settings size={14} />
            </button>
            <button onClick={() => fetch().catch(console.error)} disabled={loading} title="Refresh" className="w-8 h-8 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors disabled:opacity-30">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={clearConfig} title="Disconnect" className="w-8 h-8 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors">
              <LogOut size={14} />
            </button>
            <button onClick={() => setSidebarOpen(false)} title="Close" className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors">
              <ChevronLeft size={14} />
            </button>
          </div>
          {/* Compact: nav links */}
          <div className="flex flex-col items-center gap-0.5 px-1 py-2 border-b border-th-border">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                title={label}
                className={({ isActive }) =>
                  `w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    isActive ? 'bg-th-subtle text-th-text' : 'text-th-muted hover:text-th-text hover:bg-th-hover'
                  }`
                }
              >
                <Icon size={16} />
              </NavLink>
            ))}
          </div>
          {/* Compact: calendar toggles */}
          {(isCalendarRoute || isTasksRoute) && (
            <div className="flex flex-col items-center gap-1.5 px-1 py-2">
              {calendarsMeta.filter((c) => !c.isJournal).map(({ name, color }) => {
                const visible = !hiddenCalendars.has(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleCalendar(name)}
                    title={name}
                    className="w-4 h-4 rounded-[3px] border-2 flex items-center justify-center transition-all shrink-0"
                    style={{
                      backgroundColor: visible ? (color ?? '#9ca3af') : 'transparent',
                      borderColor: visible ? (color ?? '#9ca3af') : '#d1d5db',
                    }}
                  >
                    {visible && <Check size={9} strokeWidth={3} className="text-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-th-border shrink-0 h-[49px]">
        <span className="text-sm font-bold tracking-tight text-th-text">vcalendar</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowThemePrefs(true)}
            title="Preferences"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
          >
            <Settings size={12} />
          </button>
          <button
            onClick={() => fetch().catch(console.error)}
            disabled={loading}
            title="Refresh"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors disabled:opacity-30"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={clearConfig}
            title="Disconnect"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
          >
            <LogOut size={12} />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            title="Close"
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1">

        {/* Mini calendar */}
        {isCalendarRoute && <MiniCalendar />}
        {isTasksRoute && <MiniCalendar onDayClick={setSelectedDate} />}
        {isJournalsRoute && <MiniCalendar />}

        {/* Navigation — desktop only */}
        <div className="hidden md:block">
          <Section icon={LayoutList} label="Navigation">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-th-subtle text-th-text'
                      : 'text-th-muted hover:text-th-text hover:bg-th-hover'
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </Section>
        </div>

        {/* Calendars — hidden on journals route; excludes journal-only collections */}
        {!isJournalsRoute && <Section icon={CalendarDays} label="Calendars">
          {calendarsMeta.filter((c) => !c.isJournal).length === 0 && (
            <p className="px-2 text-xs text-th-muted/50">No calendars</p>
          )}
          {calendarsMeta.filter((c) => !c.isJournal).map(({ name, color }) => {
            const visible = !hiddenCalendars.has(name);
            return (
              <button
                key={name}
                onClick={() => toggleCalendar(name)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-th-hover transition-colors text-left"
              >
                <span
                  className="w-3.5 h-3.5 rounded-[3px] border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: visible ? (color ?? '#9ca3af') : 'transparent',
                    borderColor: visible ? (color ?? '#9ca3af') : '#d1d5db',
                  }}
                >
                  {visible && <Check size={9} strokeWidth={3} className="text-white" />}
                </span>
                <span className={`text-xs font-medium truncate transition-colors ${visible ? 'text-th-text' : 'text-th-muted'}`}>
                  {name}
                </span>
              </button>
            );
          })}
        </Section>}


        {/* Journals — journals route only; only journal-typed collections */}
        {isJournalsRoute && (
          <Section icon={BookOpen} label="Journals">
            {calendarsMeta.filter((c) => c.isJournal).length === 0 && (
              <p className="px-2 text-xs text-th-muted/50">No journal collections found</p>
            )}
            {calendarsMeta.filter((c) => c.isJournal).map(({ name, color }) => {
              const isSelected = selectedJournalCollection === name;
              return (
                <button
                  key={name}
                  onClick={() => setSelectedJournalCollection(isSelected ? null : name)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors
                    ${isSelected ? 'bg-th-subtle text-th-text' : 'hover:bg-th-hover text-th-muted hover:text-th-text'}`}
                >
                  <BookOpen size={12} className="shrink-0" style={{ color: color ?? '#9ca3af' }} />
                  <span className="text-xs font-medium truncate">{name}</span>
                </button>
              );
            })}
          </Section>
        )}

        {/* Presets — calendar route only */}
        {isCalendarRoute && (
          <Section icon={Bookmark} label="Presets">
            {/* Save as preset */}
            {totalSelected >= 2 && !showSaveForm && (
              <button
                onClick={() => setShowSaveForm(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-th-hover transition-colors text-left"
              >
                <Plus size={12} className="text-th-muted shrink-0" />
                <span className="text-xs text-th-muted">Save selection as preset</span>
              </button>
            )}

            {/* Inline name form */}
            {showSaveForm && (
              <form
                onSubmit={handlePresetSubmit(handleSavePreset)}
                className="flex flex-col gap-1.5 px-1 py-1.5 bg-th-subtle rounded-xl mb-1"
              >
                <input
                  type="text"
                  {...registerPreset('presetName', { required: true, validate: (v) => !!v.trim() })}
                  placeholder="Preset name"
                  autoFocus
                  className="w-full border border-th-border rounded-lg px-2 py-1.5 text-xs text-th-text placeholder-th-muted/50 outline-none focus:border-th-subtle bg-th-surface"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setShowSaveForm(false); resetPreset(); }
                  }}
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={!presetName.trim()}
                    className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-th-accent text-th-accent-fg hover:opacity-90 transition-opacity disabled:opacity-30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSaveForm(false); resetPreset(); }}
                    className="flex-1 text-[11px] font-semibold py-1 rounded-lg border border-th-border text-th-muted hover:bg-th-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {presets.length === 0 && !showSaveForm && (
              <p className="px-2 text-xs text-th-muted/50">
                {totalSelected >= 2 ? '' : 'No presets yet'}
              </p>
            )}

            {presets.map((preset) => (
              <div
                key={preset.id}
                className="group flex items-center gap-1.5 px-1 py-1.5 rounded-lg hover:bg-th-hover"
              >
                <div
                  onPointerDown={(e) => startPresetDrag(e, preset)}
                  className="cursor-grab active:cursor-grabbing text-th-muted/50 hover:text-th-muted transition-colors shrink-0 touch-none p-0.5"
                >
                  <GripVertical size={12} />
                </div>
                <span className="text-xs font-medium text-th-text truncate flex-1">{preset.name}</span>
                <span className="text-[9px] text-th-muted shrink-0">{preset.events.length}×</span>
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-th-muted hover:text-red-500 p-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </Section>
        )}

      </div>
        </>
      )}
    </aside>

    <AnimatePresence>
      {showThemePrefs && <Preferences onClose={() => setShowThemePrefs(false)} />}
    </AnimatePresence>
    </>
  );
}
