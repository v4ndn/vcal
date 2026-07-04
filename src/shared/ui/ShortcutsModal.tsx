import Modal from './Modal';

interface ShortcutRowProps {
  keys: string[];
  label: string;
}

function ShortcutRow({ keys, label }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-th-muted">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 text-[11px] font-mono font-medium text-th-text bg-th-subtle border border-th-border rounded-md leading-none"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted mb-1 mt-4 first:mt-0">
        {title}
      </p>
      <div className="divide-y divide-th-border/50">{children}</div>
    </div>
  );
}

interface ShortcutsModalProps {
  onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <Modal onClose={onClose} className="w-full max-w-sm p-5">
      <h2 className="text-sm font-bold text-th-text mb-4">Keyboard shortcuts</h2>

      <Section title="Global">
        <ShortcutRow keys={['?']} label="Show this help" />
        <ShortcutRow keys={['Ctrl', 'Z']} label="Undo last action" />
        <ShortcutRow keys={['R']} label="Refresh / sync" />
        <ShortcutRow keys={['1']} label="Go to Calendar" />
        <ShortcutRow keys={['2']} label="Go to Tasks" />
        <ShortcutRow keys={['3']} label="Go to Journal" />
      </Section>

      <Section title="Calendar">
        <ShortcutRow keys={['N']} label="New event" />
        <ShortcutRow keys={['T']} label="Go to today" />
        <ShortcutRow keys={['←']} label="Previous week" />
        <ShortcutRow keys={['→']} label="Next week" />
        <ShortcutRow keys={['Shift', 'Scroll']} label="Navigate weeks" />
        <ShortcutRow keys={['Ctrl', 'C']} label="Copy selected events" />
        <ShortcutRow keys={['Ctrl', 'V']} label="Paste events" />
        <ShortcutRow keys={['Esc']} label="Clear selection" />
      </Section>

      <Section title="Tasks">
        <ShortcutRow keys={['N']} label="New task" />
        <ShortcutRow keys={['Esc']} label="Clear selection" />
      </Section>

      <Section title="Journal">
        <ShortcutRow keys={['N']} label="New note" />
      </Section>
    </Modal>
  );
}
