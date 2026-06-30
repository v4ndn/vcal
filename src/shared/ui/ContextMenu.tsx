import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Adjust position so menu doesn't overflow viewport
  const menuW = 172;
  const menuH = items.length * 36 + 8;
  const left = x + menuW > window.innerWidth ? x - menuW : x;
  const top = y + menuH > window.innerHeight ? y - menuH : y;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="fixed z-50 bg-th-surface rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-th-border py-1 min-w-[172px]"
      style={{ left, top }}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.1 }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors text-left
            ${item.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-th-text hover:bg-th-hover'
            }`}
          onClick={() => { item.onClick(); onClose(); }}
        >
          <span className="shrink-0 opacity-70">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </motion.div>
  );
}
