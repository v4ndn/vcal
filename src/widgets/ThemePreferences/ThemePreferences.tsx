import { useState } from 'react';
import { X } from 'lucide-react';
import { useThemeStore, PRESET_THEMES, type ThemeValues } from '../../entities/theme/model/store';
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

interface Props {
  onClose: () => void;
}

export default function ThemePreferences({ onClose }: Props) {
  const activeId = useThemeStore((s) => s.activeId);
  const custom = useThemeStore((s) => s.custom);
  const applyPreset = useThemeStore((s) => s.applyPreset);
  const setCustomValue = useThemeStore((s) => s.setCustomValue);
  const hourHeight = useThemeStore((s) => s.hourHeight);
  const setHourHeight = useThemeStore((s) => s.setHourHeight);
  const [hourInput, setHourInput] = useState(String(hourHeight));

  return (
    <Modal onClose={onClose} className="w-full max-w-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-th-border">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">Preferences</p>
          <h2 className="text-sm font-bold text-th-text mt-0.5">Theme</h2>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
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
    </Modal>
  );
}
