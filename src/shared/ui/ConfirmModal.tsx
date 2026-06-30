import Modal from './Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onClose }: Props) {
  return (
    <Modal onClose={onClose} className="w-full max-w-sm">
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-sm font-semibold text-th-text mb-1.5">{title}</h2>
        <p className="text-sm text-th-muted leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button
          autoFocus
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-th-border text-th-muted hover:bg-th-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
