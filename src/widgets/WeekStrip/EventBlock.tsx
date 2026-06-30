import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import type { CalendarEvent } from '../../entities/event/model/types';

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => <p className="m-0">{children}</p>,
  ul: ({ children }) => <ul className="m-0 pl-3 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 pl-3 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="m-0">{children}</li>,
  h1: ({ children }) => <strong className="block">{children}</strong>,
  h2: ({ children }) => <strong className="block">{children}</strong>,
  h3: ({ children }) => <strong className="block">{children}</strong>,
  code: ({ children }) => <code>{children}</code>,
  img: () => null,
  a: ({ children }) => <span>{children}</span>,
};

interface EventBlockProps {
  event: CalendarEvent;
  top: number;
  height: number;
  col: number;
  numCols: number;
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}

export default function EventBlock({
  event, top, height, col, numCols, isDragging, isSelected,
  onPointerDown, onContextMenu, onResizeStart,
}: EventBlockProps) {
  const color = event.calendarColor;
  const colPct = (col / numCols) * 100;
  const widthPct = (1 / numCols) * 100;

  return (
    <motion.div
      className={`absolute rounded-md px-1.5 py-1 overflow-hidden z-20 hover:brightness-90 transition-[filter] cursor-grab active:cursor-grabbing${isSelected ? ' ring-2 ring-th-accent ring-offset-1 ring-offset-th-bg' : ''}`}
      style={{
        top: `${top}vh`,
        height: `${height}vh`,
        minHeight: '1.25rem',
        left: `calc(${colPct}% + 2px)`,
        width: `calc(${widthPct}% - ${numCols > 1 ? 3 : 4}px)`,
        backgroundColor: color ?? 'var(--th-subtle)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0 : 1 }}
      transition={{ opacity: { duration: isDragging ? 0 : 0.2 } }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <div className={`text-[11px] font-semibold leading-tight truncate ${color ? 'text-white' : 'text-th-text'}`}>
        {event.summary}
      </div>
      {height > 3 && (
        <div className={`text-[9px] leading-none mt-0.5 ${color ? 'text-white/70' : 'text-th-muted'}`}>
          {event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      {height > 7 && event.description && (
        <div
          className={`mt-0.5 overflow-hidden text-[8px] leading-snug ${color ? 'text-white/70' : 'text-th-muted'}`}
          style={{
            maxHeight: `${(height - 4.5) * 1.4}vh`,
            maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
          }}
        >
          <ReactMarkdown components={mdComponents}>{event.description}</ReactMarkdown>
        </div>
      )}
      {height > 4 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize flex items-end justify-center pb-0.5"
          onPointerDown={onResizeStart}
        >
          <div className={`w-6 h-0.5 rounded-full ${color ? 'bg-white/40' : 'bg-th-muted/40'}`} />
        </div>
      )}
    </motion.div>
  );
}
