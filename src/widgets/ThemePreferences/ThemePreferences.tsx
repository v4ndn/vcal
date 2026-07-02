import { useState, useRef, useEffect } from 'react';
import { X, Palette, PanelLeft, BookOpen, FolderUp, Loader2 } from 'lucide-react';
import { Dropdown } from '../../shared/ui/Dropdown';
import { useThemeStore, PRESET_THEMES, type ThemeValues } from '../../entities/theme/model/store';
import { useCalendarStore } from '../../entities/calendar/model/store';
import Modal from '../../shared/ui/Modal';
import { Input } from '../../shared/ui/Input';

const COLOR_FIELDS: { key: keyof ThemeValues; label: string }[] = [
  { key: 'bg',       label: 'Background' },
  { key: 'surface',  label: 'Surface' },
  { key: 'accent',   label: 'Accent' },
  { key: 'accentFg', label: 'Accent text' },
  { key: 'text',     label: 'Text' },
  { key: 'muted',    label: 'Muted text' },
  { key: 'border',   label: 'Border' },
  { key: 'subtle',   label: 'Subtle bg' },
  { key: 'hover',    label: 'Hover bg' },
];

const SECTIONS = [
  { id: 'theme' as const, label: 'Theme', icon: Palette },
  { id: 'layout' as const, label: 'Layout', icon: PanelLeft },
  { id: 'journal' as const, label: 'Journal', icon: BookOpen },
];


function ThemeSection() {
  const activeId = useThemeStore((s) => s.activeId);
  const custom = useThemeStore((s) => s.custom);
  const applyPreset = useThemeStore((s) => s.applyPreset);
  const setCustomValue = useThemeStore((s) => s.setCustomValue);
  const hourHeight = useThemeStore((s) => s.hourHeight);
  const setHourHeight = useThemeStore((s) => s.setHourHeight);
  const [hourInput, setHourInput] = useState(String(hourHeight));

  return (
    <div className="flex flex-col gap-5">
      {/* Presets */}
      <div className="flex gap-2">
        {PRESET_THEMES.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              activeId === preset.id
                ? 'bg-th-accent text-th-accent-fg border-th-accent'
                : 'border-th-border text-th-muted hover:text-th-text hover:bg-th-hover'
            }`}
          >
            {preset.name}
          </button>
        ))}
        <button
          onClick={() => useThemeStore.getState().setActiveId('custom')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            activeId === 'custom'
              ? 'bg-th-accent text-th-accent-fg border-th-accent'
              : 'border-th-border text-th-muted hover:text-th-text hover:bg-th-hover'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Color pickers */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {COLOR_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="relative w-7 h-7 shrink-0">
              <span
                className="block w-full h-full rounded-lg border border-th-border"
                style={{ backgroundColor: custom[key] }}
              />
              <input
                type="color"
                value={custom[key]}
                onChange={(e) => setCustomValue(key, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <span className="text-xs text-th-muted group-hover:text-th-text transition-colors truncate">
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* Swatch row */}
      <div className="flex gap-1.5 rounded-xl overflow-hidden border border-th-border">
        {COLOR_FIELDS.slice(0, 5).map(({ key }) => (
          <div key={key} className="flex-1 h-3" style={{ backgroundColor: custom[key] }} />
        ))}
      </div>

      {/* Hour height */}
      <div className="flex flex-col gap-2 pt-1 border-t border-th-border">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">1 hour height</p>
          <span className="text-[10px] text-th-muted">{hourHeight} vh</span>
        </div>
        <input
          type="range"
          min={5}
          max={30}
          step={1}
          value={hourHeight}
          onChange={(e) => {
            const v = Number(e.target.value);
            setHourInput(String(v));
            setHourHeight(v);
          }}
          className="w-full accent-[var(--th-accent)]"
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={5}
            max={30}
            value={hourInput}
            onChange={(e) => setHourInput(e.target.value)}
            onBlur={() => {
              const v = Number(hourInput);
              if (!isNaN(v)) setHourHeight(v);
              setHourInput(String(hourHeight));
            }}
            className="w-16 text-center py-1 text-xs"
          />
          <span className="text-xs text-th-muted">vh per hour (5–30)</span>
        </div>
      </div>
    </div>
  );
}

const SIDEBAR_SIDE_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

function LayoutSection() {
  const sidebarCompact = useThemeStore((s) => s.sidebarCompact);
  const setSidebarCompact = useThemeStore((s) => s.setSidebarCompact);
  const sidebarSide = useThemeStore((s) => s.sidebarSide);
  const setSidebarSide = useThemeStore((s) => s.setSidebarSide);
  const calendarHeaderBottom = useThemeStore((s) => s.calendarHeaderBottom);
  const setCalendarHeaderBottom = useThemeStore((s) => s.setCalendarHeaderBottom);
  const hideScrollbars = useThemeStore((s) => s.hideScrollbars);
  const setHideScrollbars = useThemeStore((s) => s.setHideScrollbars);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">Sidebar position</p>
        <Dropdown
          value={sidebarSide}
          onChange={(v) => setSidebarSide(v as 'left' | 'right')}
          options={SIDEBAR_SIDE_OPTIONS}
        />
      </div>

      <div className="border-t border-th-border pt-4 flex flex-col gap-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={sidebarCompact}
            onChange={(e) => setSidebarCompact(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 shrink-0 cursor-pointer accent-[var(--th-accent)]"
          />
          <div>
            <p className="text-xs font-medium text-th-text">Compact sidebar</p>
            <p className="text-[11px] text-th-muted mt-0.5">Show icons only in the main sidebar</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={calendarHeaderBottom}
            onChange={(e) => setCalendarHeaderBottom(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 shrink-0 cursor-pointer accent-[var(--th-accent)]"
          />
          <div>
            <p className="text-xs font-medium text-th-text">Calendar header at bottom</p>
            <p className="text-[11px] text-th-muted mt-0.5">Move the top bar, day headers, and all-day row to the bottom</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={hideScrollbars}
            onChange={(e) => setHideScrollbars(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 shrink-0 cursor-pointer accent-[var(--th-accent)]"
          />
          <div>
            <p className="text-xs font-medium text-th-text">Hide scrollbars</p>
            <p className="text-[11px] text-th-muted mt-0.5">Scrolling still works, bars are just invisible</p>
          </div>
        </label>
      </div>
    </div>
  );
}

const isTauri = '__TAURI_INTERNALS__' in window;

function JournalSection() {
  const calendars = useCalendarStore((s) => s.calendars);
  const createJournal = useCalendarStore((s) => s.createJournal);

  const journalCalendars = calendars.filter((c) => c.isJournal);

  const [selectedCalendar, setSelectedCalendar] = useState(journalCalendars[0]?.name ?? '');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = fileInputRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, []);

  const calendarOptions = journalCalendars.map((c) => ({ value: c.name, label: c.name }));

  async function uploadFiles(files: Array<{ relative_path: string; content: string }>) {
    const calName = selectedCalendar || journalCalendars[0]?.name;
    if (!calName) return;

    if (files.length === 0) {
      setLastResult('No .md files found in selected folder.');
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: files.length });
    setLastResult(null);

    let done = 0;
    for (const file of files) {
      const parts = file.relative_path.split('/');
      parts[parts.length - 1] = parts[parts.length - 1].replace(/\.md$/i, '');
      const summary = parts.join('/');
      await createJournal(calName, { summary, description: file.content });
      done++;
      setProgress({ done, total: files.length });
    }

    setUploading(false);
    setLastResult(`Uploaded ${done} note${done !== 1 ? 's' : ''} to "${calName}".`);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleTauriPick() {
    const { invoke } = await import('@tauri-apps/api/core');
    const files = await invoke<Array<{ relative_path: string; content: string }>>('pick_md_folder');
    await uploadFiles(files);
  }

  async function handleBrowserFiles(fileList: FileList) {
    const files = Array.from(fileList)
      .filter((f) => f.name.toLowerCase().endsWith('.md'))
      .map(async (f) => ({
        relative_path: f.webkitRelativePath || f.name,
        content: await f.text(),
      }));
    await uploadFiles(await Promise.all(files));
  }

  function handleClick() {
    if (isTauri) {
      handleTauriPick();
    } else {
      fileInputRef.current?.click();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {journalCalendars.length === 0 ? (
        <p className="text-xs text-th-muted">No journal calendars found. Create one first.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">Target journal</p>
            <Dropdown
              value={selectedCalendar || journalCalendars[0]?.name}
              onChange={setSelectedCalendar}
              options={calendarOptions}
            />
          </div>

          <div className="border-t border-th-border pt-4 flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium text-th-text">Import folder</p>
              <p className="text-[11px] text-th-muted mt-0.5">
                Select a folder — all .md files are uploaded preserving the folder hierarchy.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleBrowserFiles(e.target.files)}
            />

            <button
              onClick={handleClick}
              disabled={uploading}
              className="flex items-center gap-2 self-start px-3 py-2 rounded-lg border border-th-border text-xs font-medium text-th-text hover:bg-th-hover transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {uploading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FolderUp size={13} />
              )}
              {uploading && progress
                ? `Uploading… ${progress.done}/${progress.total}`
                : 'Choose folder'}
            </button>

            {lastResult && (
              <p className="text-[11px] text-th-muted">{lastResult}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function Preferences({ onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function scrollToSection(id: string) {
    const el = sectionRefs.current[id];
    const container = contentRef.current;
    if (!el || !container) return;
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <Modal onClose={onClose} className="w-full max-w-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-th-border">
        <h2 className="text-sm font-bold text-th-text">Preferences</h2>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Left nav */}
        <div className="w-36 shrink-0 border-r border-th-border px-2 py-3 flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left text-th-muted hover:text-th-text hover:bg-th-hover"
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Right content — single scrollable column */}
        <div ref={contentRef} className="flex-1 overflow-y-auto max-h-[500px] flex flex-col gap-10 py-6">
          {SECTIONS.map(({ id, label }, i) => (
            <div
              key={id}
              ref={(el) => { sectionRefs.current[id] = el; }}
              className={`px-5${i < SECTIONS.length - 1 ? ' pb-10 border-b border-th-border' : ''}`}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-th-muted mb-6">{label}</p>
              {id === 'theme' && <ThemeSection />}
              {id === 'layout' && <LayoutSection />}
              {id === 'journal' && <JournalSection />}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
