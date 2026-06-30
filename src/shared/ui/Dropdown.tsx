import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  prefix?: React.ReactNode;
}

export function Dropdown({ value, onChange, options, placeholder = 'Select…', prefix }: Props) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const maxH = 288;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= maxH + 8 ? r.bottom + 8 : r.top - maxH - 8;
    setPanelStyle({ position: 'fixed', top, left: r.left, width: r.width, zIndex: 9999 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const selected = options.find(o => o.value === value);

  const panel = (
    <div
      ref={panelRef}
      data-dropdown-panel
      style={{ ...panelStyle, boxShadow: '0 4px 24px rgba(0,0,0,.12)', padding: '4px 0', maxHeight: 288 }}
      className="bg-th-surface border border-th-border rounded-xl overflow-y-auto"
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => { onChange(opt.value); setOpen(false); }}
          className="w-full flex items-center justify-between gap-2.5 px-3 py-[9px] text-sm font-medium text-th-text hover:bg-th-hover text-left bg-transparent border-none cursor-pointer transition-colors"
        >
          <span>{opt.label}</span>
          {opt.value === value && <Check size={14} strokeWidth={2.5} className="shrink-0" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-th-border rounded-xl text-sm font-medium bg-th-surface hover:bg-th-hover text-th-text cursor-pointer transition-colors focus:outline-none focus:border-th-subtle"
      >
        <span className="flex items-center gap-2 overflow-hidden min-w-0">
          {prefix}
          {selected
            ? <span className="truncate">{selected.label}</span>
            : <span className="text-th-muted/50 truncate">{placeholder}</span>
          }
        </span>
        <ChevronDown
          size={14}
          className={`text-th-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && createPortal(panel, document.body)}
    </div>
  );
}
