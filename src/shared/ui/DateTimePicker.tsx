import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// ── constants ──────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function buildTimes(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++)
    for (const m of [0, 30])
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return out;
}
const TIMES = buildTimes();

// ── date helpers ───────────────────────────────────────────────────────────────

function midnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const wd = (first.getDay() + 6) % 7; // Monday = 0
  const start = addDays(midnight(first), -wd);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function fmtDisplay(d: Date, t: string): string {
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${t}`;
}

function toLocal(d: Date, t: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const [hh, mm] = t.split(':');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hh}:${mm}`;
}

function fromLocal(v: string): { date: Date; time: string } | null {
  if (!v) return null;
  const [dp, tp] = v.split('T');
  const [y, mo, d] = dp.split('-').map(Number);
  const date = midnight(new Date(y, mo - 1, d));
  const time = tp ? tp.slice(0, 5) : '09:00';
  return { date, time };
}

function parseTyped(str: string): Date | null {
  str = str.trim();
  let m;
  if ((m = str.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/))) {
    const mi = MON.findIndex(x => x.toLowerCase() === m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return midnight(new Date(+m[3], mi, +m[1]));
  }
  if ((m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)))
    return midnight(new Date(+m[1], +m[2] - 1, +m[3]));
  const t = Date.parse(str);
  return isNaN(t) ? null : midnight(new Date(t));
}

// ── component ──────────────────────────────────────────────────────────────────

interface Props {
  value: string;           // datetime-local "YYYY-MM-DDTHH:mm", empty string = no selection
  onChange: (v: string) => void;
  placeholder?: string;
}

export function DateTimePicker({ value, onChange, placeholder = 'Select date & time' }: Props) {
  const today = midnight(new Date());
  const parsed = value ? fromLocal(value) : null;

  const [open, setOpen] = useState(false);
  const [selDate, setSelDate] = useState<Date | null>(parsed?.date ?? null);
  const [selTime, setSelTime] = useState(parsed?.time ?? '09:00');
  const [viewY, setViewY] = useState(parsed?.date.getFullYear() ?? today.getFullYear());
  const [viewM, setViewM] = useState(parsed?.date.getMonth() ?? today.getMonth());
  const [focusD, setFocusD] = useState<Date>(parsed?.date ?? today);
  const [draft, setDraft] = useState(parsed ? fmtDisplay(parsed.date, parsed.time) : '');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  // Sync external value (e.g. RHF reset())
  useEffect(() => {
    if (value === lastEmitted.current) return;
    if (value) {
      const p = fromLocal(value);
      if (p) { setSelDate(p.date); setSelTime(p.time); setDraft(fmtDisplay(p.date, p.time)); }
    } else {
      setSelDate(null); setSelTime('09:00'); setDraft('');
    }
  }, [value]);

  // Position dropdown before paint
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const dropH = 370;
    const top = window.innerHeight - r.bottom >= dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top, left: r.left });
  }, [open]);

  // Scroll time to current selection when opening
  useEffect(() => {
    if (!open || !timeRef.current) return;
    const idx = TIMES.indexOf(selTime);
    if (idx >= 0) timeRef.current.scrollTop = Math.max(0, idx * 32 - 90);
  }, [open]);

  // Close on outside pointer
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!containerRef.current?.contains(t) && !dropdownRef.current?.contains(t))
        setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  function emit(d: Date, t: string) {
    const v = toLocal(d, t);
    lastEmitted.current = v;
    onChange(v);
    setDraft(fmtDisplay(d, t));
  }

  function selectDay(d: Date) {
    setSelDate(d); setFocusD(d);
    emit(d, selTime);
  }

  function selectTime(t: string) {
    setSelTime(t);
    const base = selDate ?? today;
    if (!selDate) setSelDate(base);
    emit(base, t);
  }

  function clear() {
    setSelDate(null); setSelTime('09:00'); setDraft('');
    lastEmitted.current = '';
    onChange('');
    setOpen(false);
  }

  function prevMonth() {
    let m = viewM - 1, y = viewY;
    if (m < 0) { m = 11; y--; }
    setViewM(m); setViewY(y);
  }

  function nextMonth() {
    let m = viewM + 1, y = viewY;
    if (m > 11) { m = 0; y++; }
    setViewM(m); setViewY(y);
  }

  function onGridKey(e: React.KeyboardEvent) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      const f = addDays(focusD, step[e.key]);
      setFocusD(f); setViewY(f.getFullYear()); setViewM(f.getMonth());
    } else if (e.key === 'Enter') {
      e.preventDefault(); selectDay(focusD);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function commitDraft() {
    const tm = draft.match(/(\d{1,2}):(\d{2})/);
    let time = selTime;
    if (tm) {
      const hh = Math.min(23, +tm[1]);
      const mm = Math.min(59, +tm[2]);
      time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
    const datePart = draft.replace(/,?\s*\d{1,2}:\d{2}.*$/, '').trim();
    const d = parseTyped(datePart);
    if (d) {
      setSelDate(d); setFocusD(d); setSelTime(time);
      setViewY(d.getFullYear()); setViewM(d.getMonth());
      emit(d, time);
    } else {
      setDraft(selDate ? fmtDisplay(selDate, selTime) : '');
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') { commitDraft(); setOpen(false); }
  }

  const grid = buildGrid(viewY, viewM);
  const weeks = Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7));
  const presets = [
    { label: 'Today', d: today },
    { label: 'Tomorrow', d: addDays(today, 1) },
    { label: 'Next week', d: addDays(today, 7) },
  ];

  function dayStyle(d: Date): React.CSSProperties {
    const inM = d.getMonth() === viewM;
    const isSel = sameDay(d, selDate);
    const isFoc = sameDay(d, focusD) && !isSel;
    const isToday = sameDay(d, today);
    return {
      width: 34, height: 32,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', borderRadius: 8, padding: 0,
      fontSize: 12, fontWeight: isSel || isToday ? 600 : 500,
      cursor: 'pointer',
      background: isSel ? 'var(--th-accent)' : 'transparent',
      color: isSel ? 'var(--th-accent-fg)' : 'var(--th-text)',
      opacity: !inM ? 0.3 : 1,
      boxShadow: isFoc ? 'inset 0 0 0 1.5px var(--th-accent)' : 'none',
      transition: 'background .1s',
    };
  }

  const navBtnStyle: React.CSSProperties = {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', borderRadius: 7,
    cursor: 'pointer', color: 'var(--th-text)', fontSize: 16,
  };

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed', top: dropPos.top, left: dropPos.left,
        zIndex: 9999, width: 352,
        background: 'var(--th-surface)', border: '1px solid var(--th-border)',
        borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,.16)',
        padding: 14, display: 'flex', flexDirection: 'column', gap: 13,
      }}
    >
      {/* Presets */}
      <div style={{ display: 'flex', gap: 7 }}>
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => selectDay(p.d)}
            className="flex-1 border border-th-border bg-th-surface hover:bg-th-hover rounded-[9px] py-[7px] text-[11.5px] font-semibold text-th-text cursor-pointer transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Calendar + Time */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Calendar */}
        <div tabIndex={0} onKeyDown={onGridKey} style={{ outline: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, height: 28 }}>
            <button type="button" onClick={prevMonth} style={navBtnStyle}
              className="hover:bg-th-hover transition-colors">‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--th-text)' }}>
              {MONTHS[viewM]} {viewY}
            </span>
            <button type="button" onClick={nextMonth} style={navBtnStyle}
              className="hover:bg-th-hover transition-colors">›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,34px)', marginBottom: 4 }}>
            {WEEKDAYS.map(d => (
              <span key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#c0c4cc', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</span>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,34px)', rowGap: 2 }}>
              {week.map((d, di) => (
                <button
                  key={di}
                  type="button"
                  onClick={() => selectDay(d)}
                  style={dayStyle(d)}
                  className={!sameDay(d, selDate) ? 'hover:!bg-th-hover' : ''}
                >
                  {d.getDate()}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Time scroll */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#c0c4cc', marginBottom: 7, textAlign: 'center' }}>
            Time
          </div>
          <div ref={timeRef} className="dtp-scroll" style={{ height: 222, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => selectTime(t)}
                style={{
                  padding: '7px 6px', border: 'none', borderRadius: 7,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  textAlign: 'center', flexShrink: 0,
                  background: t === selTime ? 'var(--th-accent)' : 'transparent',
                  color: t === selTime ? 'var(--th-accent-fg)' : 'var(--th-text)',
                }}
                className={t !== selTime ? 'hover:!bg-th-hover' : ''}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--th-border)', paddingTop: 11 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
          {selDate ? fmtDisplay(selDate, selTime) : 'No date selected'}
        </span>
        <div style={{ display: 'flex', gap: 7 }}>
          <button
            type="button"
            onClick={clear}
            className="border-none bg-transparent text-[12.5px] font-semibold text-th-muted hover:text-th-text cursor-pointer px-[10px] py-[7px] rounded-[9px]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="border-none bg-th-accent text-th-accent-fg text-[12.5px] font-semibold cursor-pointer px-4 py-[7px] rounded-[9px] hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={commitDraft}
          onKeyDown={onInputKey}
          placeholder={placeholder}
          className="w-full border border-th-border rounded-xl px-3 py-2 pr-9 text-sm text-th-text bg-th-surface outline-none focus:border-th-subtle transition-colors placeholder:text-th-muted/50"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}
