interface RecurringScopeModalProps {
  title: string;
  eventSummary?: string;
  subtitle?: string;
  confirmLabel: string;
  confirmAllLabel: string;
  variant?: 'primary' | 'danger';
  onConfirm: (scope: 'single' | 'all') => void;
  onCancel: () => void;
}

export default function RecurringScopeModal({
  title, eventSummary, subtitle, confirmLabel, confirmAllLabel, variant = 'primary',
  onConfirm, onCancel,
}: RecurringScopeModalProps) {
  const confirmClass = variant === 'danger'
    ? 'bg-red-500 text-white hover:bg-red-600 transition-colors'
    : 'bg-th-accent text-th-accent-fg hover:opacity-90 transition-opacity';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onCancel}
    >
      <div
        className="bg-th-surface rounded-2xl shadow-2xl p-6 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted mb-1">
          {title}
        </p>
        {eventSummary && (
          <h3 className="text-sm font-bold text-th-text mb-1 truncate">{eventSummary}</h3>
        )}
        {subtitle && (
          <p className="text-xs text-th-muted mb-5">{subtitle}</p>
        )}
        <div className="flex flex-col gap-2">
          <button
            className={`w-full text-sm py-2.5 px-4 rounded-xl font-semibold text-left ${confirmClass}`}
            onClick={() => onConfirm('single')}
          >
            {confirmLabel}
          </button>
          <button
            className="w-full text-sm py-2.5 px-4 rounded-xl border border-th-border text-th-text font-semibold hover:bg-th-hover transition-colors text-left"
            onClick={() => onConfirm('all')}
          >
            {confirmAllLabel}
          </button>
        </div>
        <button
          className="mt-3 w-full text-xs text-th-muted hover:text-th-text transition-colors py-1"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
