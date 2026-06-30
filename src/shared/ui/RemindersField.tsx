import { useRef, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dropdown } from './Dropdown';

const BASE_OPTIONS = [
  { value: '5',    label: '5 min before' },
  { value: '15',   label: '15 min before' },
  { value: '30',   label: '30 min before' },
  { value: '60',   label: '1 hour before' },
  { value: '120',  label: '2 hours before' },
  { value: '1440', label: '1 day before' },
];

const PRESET_VALUES = new Set([0, 5, 15, 30, 60, 120, 1440]);

interface Props {
  reminders: number[];
  onChange: (v: number[]) => void;
  zeroLabel?: string;
}

export function RemindersField({ reminders, onChange, zeroLabel = 'At start' }: Props) {
  // null = preset mode, string = custom text input value
  const [texts, setTexts] = useState<(string | null)[]>(() =>
    reminders.map(m => (PRESET_VALUES.has(m) ? null : String(m))),
  );

  // Sync texts when reminders change externally (e.g. edit-modal useEffect load)
  const prevKey = useRef(reminders.join(','));
  useEffect(() => {
    const key = reminders.join(',');
    if (key !== prevKey.current) {
      prevKey.current = key;
      setTexts(reminders.map(m => (PRESET_VALUES.has(m) ? null : String(m))));
    }
  });

  const options = [
    { value: '0', label: zeroLabel },
    ...BASE_OPTIONS,
    { value: '__custom__', label: 'Custom…' },
  ];

  function updateRow(i: number, mins: number, text: string | null) {
    const nextR = reminders.map((m, j) => (j === i ? mins : m));
    const nextT = texts.map((t, j) => (j === i ? text : t));
    setTexts(nextT);
    onChange(nextR);
  }

  function addRow() {
    setTexts(t => [...t, null]);
    onChange([...reminders, 15]);
  }

  function removeRow(i: number) {
    setTexts(t => t.filter((_, j) => j !== i));
    onChange(reminders.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {reminders.map((mins, i) => {
        const isCustom = texts[i] !== null;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-1 min-w-0">
              <div className={isCustom ? 'w-28 shrink-0' : 'flex-1'}>
                <Dropdown
                  value={isCustom ? '__custom__' : String(mins)}
                  onChange={(v) => {
                    if (v === '__custom__') {
                      const nextT = [...texts];
                      nextT[i] = String(mins);
                      setTexts(nextT);
                    } else {
                      updateRow(i, Number(v), null);
                    }
                  }}
                  options={options}
                />
              </div>
              {isCustom && (
                <>
                  <input
                    type="number"
                    min="1"
                    value={texts[i]!}
                    autoFocus
                    onChange={(e) => {
                      const nextT = [...texts];
                      nextT[i] = e.target.value;
                      setTexts(nextT);
                      const n = parseInt(e.target.value);
                      if (!isNaN(n) && n >= 1) {
                        const nextR = reminders.map((m, j) => (j === i ? n : m));
                        onChange(nextR);
                      }
                    }}
                    className="flex-1 min-w-0 border border-th-border rounded-xl px-3 py-2 text-sm text-th-text bg-th-surface outline-none focus:border-th-subtle transition-colors"
                  />
                  <span className="text-xs text-th-muted self-center shrink-0">min</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      {reminders.length < 5 && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-xs font-medium text-th-muted hover:text-th-text transition-colors py-0.5"
        >
          <Plus size={12} />
          Add reminder
        </button>
      )}
    </div>
  );
}
