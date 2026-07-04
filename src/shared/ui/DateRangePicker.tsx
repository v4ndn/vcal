import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown } from './Dropdown';

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MON    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WSHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WD     = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function buildTimes(): string[] {
  const o: string[] = [];
  for (let h = 0; h < 24; h++)
    for (const m of [0, 30])
      o.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  return o;
}
const TIMES     = buildTimes();
const TIME_OPTS = TIMES.map(t => ({ value: t, label: t }));

const p2 = (n: number) => String(n).padStart(2, '0');

function mid(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addD(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate()+n); return mid(x); }
function sameD(a: Date|null, b: Date|null): boolean {
  return !!a && !!b &&
    a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function mkGrid(y: number, m: number): Date[] {
  const f = new Date(y,m,1), wd = (f.getDay()+6)%7, s = addD(mid(f),-wd);
  return Array.from({length:42}, (_,i) => addD(s,i));
}

const fmtS   = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;
const fmtC   = (d: Date) => `${WSHORT[d.getDay()]} ${fmtS(d)}`;
const toL    = (d: Date, t: string) => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${t}`;
const toDStr = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T00:00`;

function parseDt(v: string): Date|null {
  if (!v) return null;
  const [y,mo,d] = v.split('T')[0].split('-').map(Number);
  if (!y || !mo || !d) return null;
  return mid(new Date(y, mo-1, d));
}
const parseTm = (v: string): string => v?.split('T')[1]?.slice(0,5) ?? '09:00';

// ── CalGrid ───────────────────────────────────────────────────────────────────

interface CGridProps {
  vy: number; vm: number;
  lo: Date|null; hi: Date|null;
  focus: Date;
  onDay(d: Date): void;
  onKey(e: React.KeyboardEvent): void;
  onPrev(): void;
  onNext(): void;
  minDate?: Date|null;
}

function CalGrid({ vy, vm, lo, hi, focus, onDay, onKey, onPrev, onNext, minDate }: CGridProps) {
  const today = mid(new Date());
  const cells = mkGrid(vy, vm);
  const minT = minDate ? mid(minDate).getTime() : null;
  const isDisabled = (d: Date) => minT !== null && d.getTime() < minT;

  function cs(d: Date): React.CSSProperties {
    const inM  = d.getMonth() === vm;
    const t    = d.getTime();
    const isLo = sameD(d,lo), isHi = sameD(d,hi);
    const bet  = lo && hi && !isLo && !isHi && t > lo.getTime() && t < hi.getTime();
    const foc  = sameD(d,focus) && !isLo && !isHi && !bet;
    const both = sameD(lo,hi);
    const disabled = isDisabled(d);
    let bg = 'transparent', col = 'var(--th-text)', fw: string|undefined, r = '8px';
    const opacity = disabled ? 0.2 : (isLo || isHi || bet) ? 1 : inM ? 1 : 0.35;
    if (sameD(d,today) && !isLo && !isHi) fw = '700';
    if (bet)          { bg = 'var(--th-subtle)'; r = '0'; }
    if (isLo || isHi) {
      bg = 'var(--th-accent)'; col = 'var(--th-accent-fg)'; fw = '600';
      r  = both ? '8px' : isLo ? '8px 0 0 8px' : '0 8px 8px 0';
    }
    return {
      width: '100%', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', background: bg, color: col, borderRadius: r,
      fontSize: 12, fontWeight: fw, cursor: disabled ? 'default' : 'pointer', padding: 0, opacity,
      boxShadow: foc ? 'inset 0 0 0 1.5px var(--th-accent)' : 'none',
    };
  }

  return (
    <div tabIndex={0} onKeyDown={onKey} style={{outline:'none'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9,height:28}}>
        <button type="button" onClick={onPrev} className="hover:bg-th-hover transition-colors"
          style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',border:'none',background:'transparent',borderRadius:7,cursor:'pointer',color:'var(--th-text)',fontSize:16}}>
          ‹
        </button>
        <span style={{fontSize:13,fontWeight:600,color:'var(--th-text)'}}>{MONTHS[vm]} {vy}</span>
        <button type="button" onClick={onNext} className="hover:bg-th-hover transition-colors"
          style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',border:'none',background:'transparent',borderRadius:7,cursor:'pointer',color:'var(--th-text)',fontSize:16}}>
          ›
        </button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:4}}>
        {WD.map(w => (
          <span key={w} style={{textAlign:'center',fontSize:10,fontWeight:600,color:'#c0c4cc',textTransform:'uppercase',letterSpacing:'.04em'}}>
            {w}
          </span>
        ))}
      </div>
      {Array.from({length:6}, (_,w) => (
        <div key={w} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',rowGap:2}}>
          {cells.slice(w*7, w*7+7).map((d,i) => (
            <button key={i} type="button" disabled={isDisabled(d)} onClick={() => onDay(d)}
              className={!isDisabled(d) && !sameD(d,lo) && !sameD(d,hi) ? 'hover:!bg-th-hover' : ''}
              style={cs(d)}>
              {d.getDate()}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── shared range state hook ────────────────────────────────────────────────────

function useRangePicker(startProp: string, endProp: string) {
  const today = mid(new Date());
  const [vy, setVy]     = useState(() => parseDt(startProp)?.getFullYear() ?? today.getFullYear());
  const [vm, setVm]     = useState(() => parseDt(startProp)?.getMonth() ?? today.getMonth());
  const [sd, setSd]     = useState<Date|null>(() => parseDt(startProp));
  const [ed, setEd]     = useState<Date|null>(() => parseDt(endProp));
  const [pick, setPick] = useState<'start'|'end'>('start');
  const [foc, setFoc]   = useState<Date>(() => parseDt(startProp) ?? today);

  const prevS = useRef(startProp), prevE = useRef(endProp);
  // runs every render; only resets internal state when props actually changed
  useEffect(() => {
    if (startProp !== prevS.current || endProp !== prevE.current) {
      prevS.current = startProp; prevE.current = endProp;
      const d = parseDt(startProp), e = parseDt(endProp);
      setSd(d); setEd(e);
      if (d) { setFoc(d); setVy(d.getFullYear()); setVm(d.getMonth()); }
    }
  });

  function onDay(d: Date) {
    if (pick === 'start') {
      setSd(d); setEd(d); setFoc(d); setPick('end');
    } else {
      if (sd && d.getTime() < sd.getTime()) {
        const prev = sd; setSd(d); setEd(prev); setFoc(d); setPick('start');
      } else {
        setEd(d); setFoc(d); setPick('start');
      }
    }
  }

  function prevM() { let m=vm-1,y=vy; if(m<0){m=11;y--;} setVm(m); setVy(y); }
  function nextM() { let m=vm+1,y=vy; if(m>11){m=0;y++;} setVm(m); setVy(y); }

  function onKey(e: React.KeyboardEvent, close: () => void) {
    const map: Record<string,number> = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if (e.key in map) {
      e.preventDefault();
      const f = addD(foc, map[e.key]);
      setFoc(f); setVy(f.getFullYear()); setVm(f.getMonth());
    } else if (e.key === 'Enter') {
      e.preventDefault(); onDay(foc);
    } else if (e.key === 'Escape') {
      close();
    }
  }

  function setRange(s: Date, e: Date) {
    setSd(s); setEd(e); setFoc(s); setVy(s.getFullYear()); setVm(s.getMonth()); setPick('start');
  }

  function clear() { setSd(null); setEd(null); setPick('start'); }

  const lo = sd && ed ? (sd.getTime() <= ed.getTime() ? sd : ed) : sd;
  const hi = sd && ed ? (sd.getTime() <= ed.getTime() ? ed : sd) : ed;

  return { vy, vm, sd, ed, pick, setPick, foc, onDay, prevM, nextM, onKey, setRange, clear, lo, hi };
}

// ── shared panel subcomponents ─────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  position: 'fixed', zIndex: 9999, width: 320,
  background: 'var(--th-surface)', border: '1px solid var(--th-border)',
  borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,.16)',
  padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
};

function ChipRow({
  lo, hi, pick, setPick,
}: { lo: Date|null; hi: Date|null; pick: 'start'|'end'; setPick: (v: 'start'|'end') => void }) {
  return (
    <div style={{display:'flex',gap:8}}>
      {(['start','end'] as const).map(w => {
        const d = w === 'start' ? lo : hi;
        const active = pick === w;
        return (
          <button key={w} type="button" onClick={() => setPick(w)} style={{
            flex: 1, textAlign: 'left', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${active ? 'var(--th-accent)' : 'var(--th-border)'}`,
            background: active ? 'var(--th-subtle)' : 'var(--th-surface)',
          }}>
            <span style={{display:'block',fontSize:9,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--th-muted)'}}>
              {w.charAt(0).toUpperCase() + w.slice(1)}
            </span>
            <span style={{display:'block',fontSize:13,fontWeight:600,color:'var(--th-text)',marginTop:2}}>
              {d ? fmtC(d) : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PresetRow({ presets }: { presets: { label: string; run: () => void }[] }) {
  return (
    <div style={{display:'flex',gap:6}}>
      {presets.map(p => (
        <button key={p.label} type="button" onClick={p.run}
          className="hover:bg-th-hover transition-colors"
          style={{flex:1,border:'1px solid var(--th-border)',background:'var(--th-surface)',borderRadius:9,padding:'6px 0',fontSize:11,fontWeight:600,color:'var(--th-text)',cursor:'pointer'}}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function FooterRow({
  summary, onClear, onApply,
}: { summary: string; onClear: () => void; onApply: () => void }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderTop:'1px solid var(--th-border)',paddingTop:11}}>
      <span style={{fontSize:12,fontWeight:500,color:'var(--th-muted)'}}>{summary}</span>
      <div style={{display:'flex',gap:7}}>
        <button type="button" onClick={onClear}
          className="text-th-muted hover:text-th-text transition-colors"
          style={{border:'none',background:'transparent',fontSize:12.5,fontWeight:600,cursor:'pointer',padding:'7px 10px',borderRadius:9}}>
          Clear
        </button>
        <button type="button" onClick={onApply}
          className="bg-th-accent text-th-accent-fg hover:opacity-90 transition-opacity"
          style={{border:'none',fontSize:12.5,fontWeight:600,cursor:'pointer',padding:'7px 16px',borderRadius:9}}>
          Apply
        </button>
      </div>
    </div>
  );
}

function usePanelPos(open: boolean, cRef: React.RefObject<HTMLElement | null>, panelH: number) {
  const [pos, setPos] = useState({top:0,left:0});
  useLayoutEffect(() => {
    if (!open || !cRef.current) return;
    const r = cRef.current.getBoundingClientRect();
    const top  = window.innerHeight - r.bottom >= panelH ? r.bottom + 4 : r.top - panelH - 4;
    const left = Math.min(r.left, window.innerWidth - 328);
    setPos({top, left});
  }, [open]);
  return pos;
}

function useCloseOnOutside(
  open: boolean,
  refs: React.RefObject<HTMLElement | null>[],
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: PointerEvent) => {
      const t = e.target as Node;
      // Don't close if the click is inside an open Dropdown portal
      if ((t as Element).closest?.('[data-dropdown-panel]')) return;
      if (refs.every(r => !r.current?.contains(t))) close();
    };
    document.addEventListener('pointerdown', fn);
    return () => document.removeEventListener('pointerdown', fn);
  }, [open]);
}

function buildPresets(today: Date) {
  const wd = (today.getDay()+6)%7;
  const monThis = addD(today, -wd);
  const daysToSat = (6 - today.getDay() + 7) % 7 || 7;
  const sat = addD(today, daysToSat);
  return { monThis, sat };
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

// ── DateRangePicker ────────────────────────────────────────────────────────────

interface DRPProps {
  start: string;
  end: string;
  onApply(start: string, end: string): void;
  placeholder?: string;
}

export function DateRangePicker({ start, end, onApply, placeholder = 'Select dates & times' }: DRPProps) {
  const [open, setOpen] = useState(false);
  const [st, setSt]     = useState(() => parseTm(start));
  const [et, setEt]     = useState(() => parseTm(end));
  const cRef = useRef<HTMLDivElement>(null);
  const pRef = useRef<HTMLDivElement>(null);
  const rng  = useRangePicker(start, end);

  // sync times when props change externally (e.g. edit modal reset)
  const prevS = useRef(start), prevE = useRef(end);
  useEffect(() => {
    if (start !== prevS.current || end !== prevE.current) {
      prevS.current = start; prevE.current = end;
      if (start) setSt(parseTm(start));
      if (end)   setEt(parseTm(end));
    }
  });

  const pos = usePanelPos(open, cRef, 470);
  useCloseOnOutside(open, [cRef, pRef], () => setOpen(false));

  const today = mid(new Date());
  const { monThis, sat } = buildPresets(today);
  const presets = [
    { label: 'This week',   run: () => rng.setRange(monThis, addD(monThis,6)) },
    { label: 'Next 7 days', run: () => rng.setRange(today, addD(today,6)) },
    { label: 'Weekend',     run: () => rng.setRange(sat, addD(sat,1)) },
  ];

  function handleApply() {
    if (rng.lo && rng.hi) onApply(toL(rng.lo, st), toL(rng.hi, et));
    setOpen(false);
  }
  function handleClear() { rng.clear(); setSt('09:00'); setEt('10:00'); onApply('', ''); setOpen(false); }

  const sd = parseDt(start), ed = parseDt(end);
  const displayVal = sd && ed
    ? `${fmtS(sd)}, ${parseTm(start)}  –  ${fmtS(ed)}, ${parseTm(end)}`
    : '';

  const footerSummary = rng.lo && rng.hi
    ? `${fmtS(rng.lo)} – ${fmtS(rng.hi)} · ${rng.hi.getFullYear()}`
    : 'No dates selected';

  const panel = (
    <div ref={pRef} style={{...PANEL_STYLE, top: pos.top, left: pos.left}}>
      <ChipRow lo={rng.lo} hi={rng.hi} pick={rng.pick} setPick={rng.setPick} />
      <PresetRow presets={presets} />
      <CalGrid vy={rng.vy} vm={rng.vm} lo={rng.lo} hi={rng.hi} focus={rng.foc}
        onDay={rng.onDay} onKey={e => rng.onKey(e, () => setOpen(false))}
        onPrev={rng.prevM} onNext={rng.nextM} />
      <div style={{display:'flex',gap:10}}>
        {([
          { label: 'Start', val: st, set: setSt },
          { label: 'End',   val: et, set: setEt },
        ]).map(({ label, val, set }) => (
          <div key={label} style={{flex:1}}>
            <div style={{fontSize:10,fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--th-muted)',marginBottom:5}}>
              {label}
            </div>
            <Dropdown value={val} onChange={set} options={TIME_OPTS} />
          </div>
        ))}
      </div>
      <FooterRow summary={footerSummary} onClear={handleClear} onApply={handleApply} />
    </div>
  );

  return (
    <div ref={cRef} className="relative">
      <div className="relative">
        <input type="text" readOnly value={displayVal} onClick={() => setOpen(v => !v)}
          placeholder={placeholder}
          className="w-full border border-th-border rounded-xl px-3 py-2 pr-9 text-sm text-th-text bg-th-surface cursor-pointer outline-none focus:border-th-subtle transition-colors placeholder:text-th-muted/50"
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
        <button type="button" tabIndex={-1} onClick={() => setOpen(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
          <CalendarIcon />
        </button>
      </div>
      {open && createPortal(panel, document.body)}
    </div>
  );
}

// ── DatePicker (single date) ────────────────────────────────────────────────────

interface DPProps {
  value: string;                 // 'YYYY-MM-DD' (time part, if any, is ignored)
  onChange(date: string): void;  // emits 'YYYY-MM-DD' (or '' when cleared)
  placeholder?: string;
  minDate?: Date | null;
  clearable?: boolean;
}

export function DatePicker({ value, onChange, placeholder = 'Select date', minDate, clearable }: DPProps) {
  const today = mid(new Date());
  const [open, setOpen] = useState(false);
  const cRef = useRef<HTMLDivElement>(null);
  const pRef = useRef<HTMLDivElement>(null);

  const sel = parseDt(value);
  const [vy, setVy]   = useState(() => sel?.getFullYear() ?? today.getFullYear());
  const [vm, setVm]   = useState(() => sel?.getMonth() ?? today.getMonth());
  const [foc, setFoc] = useState<Date>(() => sel ?? today);

  // sync view to external value changes (e.g. edit modal reset)
  const prevV = useRef(value);
  useEffect(() => {
    if (value !== prevV.current) {
      prevV.current = value;
      const d = parseDt(value);
      if (d) { setFoc(d); setVy(d.getFullYear()); setVm(d.getMonth()); }
    }
  });

  const pos = usePanelPos(open, cRef, 380);
  useCloseOnOutside(open, [cRef, pRef], () => setOpen(false));

  function commit(d: Date) {
    if (minDate && d.getTime() < mid(minDate).getTime()) return;
    onChange(toDStr(d).slice(0, 10));
    setOpen(false);
  }
  function prevM() { let m=vm-1,y=vy; if(m<0){m=11;y--;} setVm(m); setVy(y); }
  function nextM() { let m=vm+1,y=vy; if(m>11){m=0;y++;} setVm(m); setVy(y); }
  function onKey(e: React.KeyboardEvent) {
    const map: Record<string,number> = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if (e.key in map) {
      e.preventDefault();
      const f = addD(foc, map[e.key]);
      setFoc(f); setVy(f.getFullYear()); setVm(f.getMonth());
    } else if (e.key === 'Enter') {
      e.preventDefault(); commit(foc);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const displayVal = sel ? `${fmtC(sel)} ${sel.getFullYear()}` : '';

  const panel = (
    <div ref={pRef} style={{...PANEL_STYLE, top: pos.top, left: pos.left, width: 300}}>
      <CalGrid vy={vy} vm={vm} lo={sel} hi={sel} focus={foc}
        onDay={commit} onKey={onKey} onPrev={prevM} onNext={nextM} minDate={minDate ?? null} />
      {clearable && sel && (
        <div style={{display:'flex',justifyContent:'flex-end',borderTop:'1px solid var(--th-border)',paddingTop:11}}>
          <button type="button" onClick={() => { onChange(''); setOpen(false); }}
            className="text-th-muted hover:text-th-text transition-colors"
            style={{border:'none',background:'transparent',fontSize:12.5,fontWeight:600,cursor:'pointer',padding:'7px 10px',borderRadius:9}}>
            Clear
          </button>
        </div>
      )}
    </div>
  );

  const showClear = clearable && !!sel;

  return (
    <div ref={cRef} className="relative">
      <div className="relative">
        <input type="text" readOnly value={displayVal} onClick={() => setOpen(v => !v)}
          placeholder={placeholder}
          className="w-full border border-th-border rounded-xl px-3 py-2 pr-9 text-sm text-th-text bg-th-surface cursor-pointer outline-none focus:border-th-subtle transition-colors placeholder:text-th-muted/50"
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
        {showClear ? (
          <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange(''); }}
            title="Clear date"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        ) : (
          <button type="button" tabIndex={-1} onClick={() => setOpen(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
            <CalendarIcon />
          </button>
        )}
      </div>
      {open && createPortal(panel, document.body)}
    </div>
  );
}

// ── DateRangeOnlyPicker ────────────────────────────────────────────────────────

interface DROPProps {
  start: string;
  end: string;
  onApply(start: string, end: string): void;
  placeholder?: string;
}

export function DateRangeOnlyPicker({ start, end, onApply, placeholder = 'Select dates' }: DROPProps) {
  const [open, setOpen] = useState(false);
  const cRef = useRef<HTMLDivElement>(null);
  const pRef = useRef<HTMLDivElement>(null);
  const rng  = useRangePicker(start, end);

  const pos = usePanelPos(open, cRef, 400);
  useCloseOnOutside(open, [cRef, pRef], () => setOpen(false));

  const today = mid(new Date());
  const { monThis, sat } = buildPresets(today);
  const presets = [
    { label: 'This week',   run: () => rng.setRange(monThis, addD(monThis,6)) },
    { label: 'Next 7 days', run: () => rng.setRange(today, addD(today,6)) },
    { label: 'Weekend',     run: () => rng.setRange(sat, addD(sat,1)) },
  ];

  function handleApply() {
    if (rng.lo && rng.hi) onApply(toDStr(rng.lo), toDStr(rng.hi));
    setOpen(false);
  }
  function handleClear() { rng.clear(); onApply('', ''); setOpen(false); }

  const sd = parseDt(start), ed = parseDt(end);
  const displayVal = sd && ed
    ? sd.getFullYear() === ed.getFullYear()
      ? `${fmtS(sd)} – ${fmtS(ed)} ${sd.getFullYear()}`
      : `${fmtS(sd)} ${sd.getFullYear()} – ${fmtS(ed)} ${ed.getFullYear()}`
    : '';

  const days = rng.lo && rng.hi
    ? Math.round((rng.hi.getTime() - rng.lo.getTime()) / 86_400_000)
    : 0;
  const footerSummary = rng.lo && rng.hi
    ? `${days} ${days === 1 ? 'day' : 'days'} selected`
    : 'No dates selected';

  const panel = (
    <div ref={pRef} style={{...PANEL_STYLE, top: pos.top, left: pos.left}}>
      <ChipRow lo={rng.lo} hi={rng.hi} pick={rng.pick} setPick={rng.setPick} />
      <PresetRow presets={presets} />
      <CalGrid vy={rng.vy} vm={rng.vm} lo={rng.lo} hi={rng.hi} focus={rng.foc}
        onDay={rng.onDay} onKey={e => rng.onKey(e, () => setOpen(false))}
        onPrev={rng.prevM} onNext={rng.nextM} />
      <FooterRow summary={footerSummary} onClear={handleClear} onApply={handleApply} />
    </div>
  );

  return (
    <div ref={cRef} className="relative">
      <div className="relative">
        <input type="text" readOnly value={displayVal} onClick={() => setOpen(v => !v)}
          placeholder={placeholder}
          className="w-full border border-th-border rounded-xl px-3 py-2 pr-9 text-sm text-th-text bg-th-surface cursor-pointer outline-none focus:border-th-subtle transition-colors placeholder:text-th-muted/50"
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
        <button type="button" tabIndex={-1} onClick={() => setOpen(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
          <CalendarIcon />
        </button>
      </div>
      {open && createPortal(panel, document.body)}
    </div>
  );
}
