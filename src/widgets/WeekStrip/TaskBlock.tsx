import type { CalendarTask } from '../../entities/task/model/types';

interface TaskBlockProps {
  task: CalendarTask;
  top: number;
  height: number;
  isSelected: boolean;
  isDragging: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

export default function TaskBlock({
  task, top, height, isSelected, isDragging, onToggle, onContextMenu, onPointerDown,
}: TaskBlockProps) {
  const color = task.calendarColor ?? '#9ca3af';
  const bgColor = `color-mix(in srgb, ${color} 25%, transparent)`;

  return (
    <div
      data-block-uid={task.uid}
      data-block-kind="task"
      className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden z-20 cursor-grab active:cursor-grabbing${isSelected ? ' ring-2 ring-th-accent ring-offset-1 ring-offset-th-bg' : ''}`}
      style={{
        top: `${top}vh`,
        height: `${height}vh`,
        minHeight: '1.25rem',
        backgroundColor: bgColor,
        border: `2px solid ${color}`,
        opacity: isDragging ? 0 : 1,
      }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-center gap-1">
        <button
          className="shrink-0 w-3 h-3 rounded flex items-center justify-center transition-colors"
          style={{
            border: `1.5px solid ${color}`,
            backgroundColor: task.completed ? color : 'transparent',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggle}
        >
          {task.completed && (
            <svg viewBox="0 0 8 8" width="7" height="7" fill="none">
              <polyline
                points="1.5,4 3.2,6 6.5,2"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <span
          className="text-[11px] font-semibold leading-tight truncate"
          style={{
            color,
            textDecoration: task.completed ? 'line-through' : 'none',
            opacity: task.completed ? 0.6 : 1,
          }}
        >
          {task.summary}
        </span>
      </div>
    </div>
  );
}
