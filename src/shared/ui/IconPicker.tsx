import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { X, Search } from 'lucide-react';

// All unique non-aliased lucide icon names
const ALL_ICON_NAMES: string[] = Object.keys(LucideIcons).filter(
  (k) =>
    !k.endsWith('Icon') &&
    !['createLucideIcon', 'LucideProvider', 'icons'].includes(k) &&
    k[0] >= 'A' && k[0] <= 'Z',
);

function DynamicIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = (LucideIcons as Record<string, any>)[name];
  if (!Icon) return null;
  return <Icon size={size} />;
}

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().replace(/[\s-_]/g, '');
    if (!q) return ALL_ICON_NAMES;
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().replace(/[\s-_]/g, '').includes(q));
  }, [search]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelH = 300;
    const panelW = 280;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= panelH + 8 ? r.bottom + 4 : r.top - panelH - 4;
    const left = Math.min(r.left, window.innerWidth - panelW - 8);
    setPanelStyle({ position: 'fixed', top, left, width: panelW, zIndex: 9999 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => searchRef.current?.focus(), 50);
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const panel = (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-th-surface border border-th-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-th-border shrink-0">
        <Search size={12} className="text-th-muted shrink-0" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons…"
          className="flex-1 text-xs bg-transparent outline-none text-th-text placeholder-th-muted/50"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="text-th-muted hover:text-th-text transition-colors"
            title="Clear icon"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {/* Grid */}
      <div className="overflow-y-auto" style={{ height: 252 }}>
        <div className="grid p-2" style={{ gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
          {filtered.slice(0, 400).map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => { onChange(name); setOpen(false); setSearch(''); }}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
                ${value === name ? 'bg-th-accent text-th-accent-fg' : 'text-th-muted hover:bg-th-hover hover:text-th-text'}`}
            >
              <DynamicIcon name={name} size={15} />
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-8 py-6 text-center text-xs text-th-muted/50">No icons found</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors
          ${open ? 'border-th-subtle bg-th-subtle' : 'border-th-border hover:bg-th-hover'}
          text-th-muted hover:text-th-text`}
        title={value ? `Icon: ${value}` : 'Select icon'}
      >
        {value ? <DynamicIcon name={value} size={16} /> : <Search size={14} />}
      </button>
      {open && createPortal(panel, document.body)}
    </div>
  );
}
