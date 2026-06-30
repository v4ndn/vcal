import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Search, Check, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { useCalendarStore } from '../entities/calendar/model/store';
import { getTasks } from '../shared/lib/getTasks';
import type { CalendarTask } from '../entities/task/model/types';
import EventTaskModal from '../widgets/EventTaskModal/EventTaskModal';
import TasksDayPanel from '../widgets/TasksDayPanel/TasksDayPanel';
import ContextMenu from '../shared/ui/ContextMenu';
import { useTasksStore } from '../entities/tasks/model/store';

// ── helpers ───────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function formatDue(d: Date | undefined, now: Date): string {
  if (!d) return '';
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  if (isSameDay(d, now)) {
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    if (hasTime) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return 'Today';
  }
  if (isSameDay(d, tomorrowStart)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// ── group logic ───────────────────────────────────────────────────────────────

type GroupId = 'overdue' | 'today' | 'tomorrow' | 'thisweek' | 'later' | 'nodate';

interface Group {
  id: GroupId;
  label: string;
  accentClass: string;
  tasks: CalendarTask[];
}

function buildGroups(tasks: CalendarTask[], now: Date): Group[] {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowStart);
  const next7End = new Date(todayEnd);
  next7End.setDate(todayEnd.getDate() + 6);

  const incomplete = tasks.filter((t) => !t.completed);

  const buckets: Record<GroupId, CalendarTask[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisweek: [],
    later: [],
    nodate: [],
  };

  for (const t of incomplete) {
    const d = (t.start && t.due)
      ? new Date((t.start.getTime() + t.due.getTime()) / 2)
      : (t.start ?? t.due);
    if (!d) { buckets.nodate.push(t); continue; }
    if (d < todayStart) { buckets.overdue.push(t); continue; }
    if (d <= todayEnd) { buckets.today.push(t); continue; }
    if (d <= tomorrowEnd) { buckets.tomorrow.push(t); continue; }
    if (d <= next7End) { buckets.thisweek.push(t); continue; }
    buckets.later.push(t);
  }

  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const defs: { id: GroupId; label: string; accentClass: string }[] = [
    { id: 'overdue',  label: 'Overdue',                        accentClass: 'text-red-400' },
    { id: 'today',    label: `Today · ${weekday} ${monthDay}`, accentClass: 'text-th-text' },
    { id: 'tomorrow', label: 'Tomorrow',                       accentClass: 'text-th-muted' },
    { id: 'thisweek', label: 'This week',                      accentClass: 'text-th-muted' },
    { id: 'later',    label: 'Later',                          accentClass: 'text-th-muted' },
    { id: 'nodate',   label: 'No due date',                    accentClass: 'text-th-muted' },
  ];

  return defs
    .map((d) => ({ ...d, tasks: buckets[d.id] }))
    .filter((g) => g.tasks.length > 0);
}

// ── group header ──────────────────────────────────────────────────────────────

function GroupHeader({
  label,
  count,
  accentClass,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  accentClass: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-[18px] py-[13px] hover:bg-th-hover/40 transition-colors"
    >
      <ChevronDown
        size={11}
        className={`text-th-muted shrink-0 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
      />
      <span className={`text-[11.5px] font-semibold uppercase tracking-[0.04em] ${accentClass}`}>
        {label}
      </span>
      <span className="text-[11px] text-th-muted bg-th-subtle rounded-full px-2 py-px">
        {count}
      </span>
      <div className="flex-1 h-px bg-th-border/60" />
    </button>
  );
}

// ── task row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  now,
  overdue,
  isSelected,
  onToggleSelect,
  onEdit,
  onContextMenu,
}: {
  task: CalendarTask;
  now: Date;
  overdue: boolean;
  isSelected: boolean;
  onToggleSelect: (uid: string) => void;
  onEdit: (t: CalendarTask) => void;
  onContextMenu: (e: React.MouseEvent, uid: string) => void;
}) {
  const toggleTaskComplete = useCalendarStore((s) => s.toggleTaskComplete);
  const effectiveDate = (task.start && task.due)
    ? new Date((task.start.getTime() + task.due.getTime()) / 2)
    : (task.start ?? task.due);
  const dueStr = formatDue(effectiveDate, now);

  return (
    <div
      className={`flex items-start gap-3 px-[18px] py-[9px] border-b border-th-border/40 transition-colors cursor-default select-none group ${
        isSelected ? 'bg-th-subtle' : 'hover:bg-th-hover'
      }`}
      onClick={(e) => { if (e.shiftKey) { e.preventDefault(); onToggleSelect(task.uid); } }}
      onDoubleClick={() => onEdit(task)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, task.uid); }}
    >
      {/* Calendar color strip */}
      <span
        className="w-[3px] min-h-[26px] self-stretch rounded-sm shrink-0"
        style={{ backgroundColor: task.calendarColor ?? '#9ca3af' }}
      />

      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.uid); }}
        className={`w-[17px] h-[17px] mt-[2px] rounded-[5px] shrink-0 flex items-center justify-center transition-all ${
          task.completed
            ? 'bg-th-accent'
            : 'border border-th-border group-hover:border-th-muted'
        }`}
      >
        {task.completed && <Check size={10} strokeWidth={3.2} className="text-th-accent-fg" />}
      </button>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Title + due row */}
        <div className="flex items-baseline gap-2">
          <span
            className={`flex-1 min-w-0 text-[13px] truncate ${
              task.completed ? 'line-through text-th-muted' : 'text-th-text'
            }`}
          >
            {task.summary}
            {task.repeating && <span className="ml-1.5 text-[10px] text-th-muted">↻</span>}
          </span>
          {dueStr && (
            <span
              className={`text-xs shrink-0 tabular-nums ${
                overdue && !task.completed ? 'text-red-400' : 'text-th-muted'
              }`}
            >
              {dueStr}
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && !task.completed && (
          <div className="mt-0.5 text-[11.5px] text-th-muted leading-relaxed
            [&_p]:m-0 [&_p+p]:mt-1
            [&_ul]:pl-3.5 [&_ul]:mt-0.5 [&_ul]:mb-0 [&_ol]:pl-3.5 [&_ol]:mt-0.5 [&_ol]:mb-0
            [&_li]:m-0
            [&_strong]:font-semibold [&_strong]:text-th-text/70
            [&_em]:italic
            [&_a]:text-th-accent [&_a]:underline
            [&_code]:font-mono [&_code]:text-[10.5px] [&_code]:bg-th-subtle [&_code]:px-1 [&_code]:rounded
            [&_h1]:text-[12px] [&_h1]:font-semibold [&_h1]:m-0
            [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:m-0
            [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:m-0">
            <Markdown>{task.description}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const items = useCalendarStore((s) => s.items);
  const hiddenCalendars = useCalendarStore((s) => s.hiddenCalendars);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const deleteTasks = useCalendarStore((s) => s.deleteTasks);
  const selectedDate = useTasksStore((s) => s.selectedDate);

  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialDue, setCreateInitialDue] = useState<Date | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; uid: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Partial<Record<GroupId, boolean>>>({});
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  const searchRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setSelectedUids(new Set()); setContextMenu(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleToggleSelect = useCallback((uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, uid: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, uid });
  }, []);

  const allTasks = useMemo(() => getTasks(items), [items]);

  const visibleTasks = useMemo(() => {
    let tasks = allTasks.filter((t) => !hiddenCalendars.has(t.calendarName));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter((t) => t.summary.toLowerCase().includes(q));
    }
    return tasks;
  }, [allTasks, hiddenCalendars, searchQuery]);

  const groups = useMemo(() => buildGroups(visibleTasks, now), [visibleTasks, now]);
  const completedTasks = useMemo(() => visibleTasks.filter((t) => t.completed), [visibleTasks]);

  const openCount = visibleTasks.filter((t) => !t.completed).length;
  const doneCount = completedTasks.length;

  function openNewTask(initialDue?: Date) {
    setCreateInitialDue(initialDue);
    setCreateModalOpen(true);
  }

  function toggleGroup(id: GroupId) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const contextTask = contextMenu
    ? (visibleTasks.find((t) => t.uid === contextMenu.uid) ?? allTasks.find((t) => t.uid === contextMenu.uid))
    : null;

  return (
    <div className="flex h-full">
      {/* Center: grouped task list */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center gap-3.5 px-[18px] h-[52px] shrink-0 border-b border-th-border">
          <span className="text-[15px] font-semibold tracking-tight text-th-text">Tasks</span>
          <span className="text-xs text-th-muted bg-th-subtle px-2 py-0.5 rounded-md">
            {openCount} open · {doneCount} done
          </span>
          <div className="flex-1" />
          {/* Search */}
          <div className="flex items-center gap-2 w-[220px] h-8 px-2.5 border border-th-border rounded-lg bg-th-subtle">
            <Search size={13} className="text-th-muted shrink-0" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks"
              className="flex-1 bg-transparent outline-none text-[12.5px] placeholder:text-th-muted text-th-text"
            />
          </div>
        </div>

        {/* Quick-add bar */}
        <button
          onClick={() => openNewTask(selectedDate)}
          className="flex items-center gap-3 mx-[18px] my-3 h-[42px] px-3.5 border border-th-border rounded-[10px] bg-th-surface hover:bg-th-hover transition-colors text-left"
        >
          <Plus size={16} className="text-th-muted shrink-0" />
          <span className="text-[13px] text-th-muted">Add a task…</span>
        </button>

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto pb-6">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-sm font-semibold text-th-text">No tasks</p>
              <p className="text-xs text-th-muted">
                {searchQuery ? 'No tasks match your search.' : 'Add a task to get started.'}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id}>
                <GroupHeader
                  label={group.label}
                  count={group.tasks.length}
                  accentClass={group.accentClass}
                  collapsed={!!collapsed[group.id]}
                  onToggle={() => toggleGroup(group.id)}
                />
                {!collapsed[group.id] && group.tasks.map((task) => (
                  <TaskRow
                    key={task.uid}
                    task={task}
                    now={now}
                    overdue={group.id === 'overdue'}
                    isSelected={selectedUids.has(task.uid)}
                    onToggleSelect={handleToggleSelect}
                    onEdit={(t) => setEditingTask(t)}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            ))
          )}

          {completedTasks.length > 0 && (
            <div>
              <GroupHeader
                label="Completed"
                count={completedTasks.length}
                accentClass="text-th-muted"
                collapsed={completedCollapsed}
                onToggle={() => setCompletedCollapsed((v) => !v)}
              />
              {!completedCollapsed && completedTasks.map((task) => (
                <TaskRow
                  key={task.uid}
                  task={task}
                  now={now}
                  overdue={false}
                  isSelected={selectedUids.has(task.uid)}
                  onToggleSelect={handleToggleSelect}
                  onEdit={(t) => setEditingTask(t)}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: day panel */}
      <TasksDayPanel onNewTask={openNewTask} />

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (() => {
          const isMulti = selectedUids.size > 1 && selectedUids.has(contextMenu.uid);
          return (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              items={[
                ...(!isMulti ? [{
                  label: 'Edit',
                  icon: <Pencil size={14} />,
                  onClick: () => { if (contextTask) setEditingTask(contextTask); },
                }] : []),
                {
                  label: isMulti ? `Delete ${selectedUids.size} tasks` : 'Delete',
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onClick: () => {
                    if (isMulti) {
                      deleteTasks([...selectedUids]);
                      setSelectedUids(new Set());
                    } else {
                      deleteTask(contextMenu.uid);
                    }
                  },
                },
              ]}
            />
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {createModalOpen && (
          <EventTaskModal
            type="task" mode="create"
            initialDue={createInitialDue}
            onClose={() => setCreateModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTask && (
          <EventTaskModal
            type="task" mode="edit"
            task={editingTask}
            onClose={() => setEditingTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
