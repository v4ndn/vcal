import { useState } from 'react';
import { X } from 'lucide-react';
import Modal from '../../shared/ui/Modal';
import { Dropdown } from '../../shared/ui/Dropdown';
import { MarkdownEditor } from '../../shared/ui/MarkdownEditor';
import { useCalendarStore } from '../../entities/calendar/model/store';
import type { CalendarJournal } from '../../entities/journal/model/types';
import { IconPicker } from '../../shared/ui/IconPicker';

interface CreateProps {
  mode: 'create';
  initialTitle?: string;
  initialCalendar?: string;
  onClose: () => void;
  onCreated: (uid: string) => void;
}

interface EditProps {
  mode: 'edit';
  journal: CalendarJournal;
  onClose: () => void;
  onSaved: () => void;
}

type Props = CreateProps | EditProps;

export default function JournalNoteModal(props: Props) {
  const calendars = useCalendarStore((s) => s.calendars);
  const createJournal = useCalendarStore((s) => s.createJournal);
  const updateJournal = useCalendarStore((s) => s.updateJournal);
  const journals = useCalendarStore((s) => s.journals);

  const isEdit = props.mode === 'edit';
  const calOptions = calendars.filter((c) => c.isJournal).map((c) => ({ value: c.name, label: c.name }));

  const [calendar, setCalendar] = useState(
    isEdit ? (props as EditProps).journal.calendarName : ((props as CreateProps).initialCalendar || calOptions[0]?.value || ''),
  );
  const [title, setTitle] = useState(
    isEdit ? (props as EditProps).journal.summary : ((props as CreateProps).initialTitle ?? ''),
  );
  const [body, setBody] = useState(
    isEdit ? (props as EditProps).journal.description : '',
  );
  const [icon, setIcon] = useState(
    isEdit ? ((props as EditProps).journal.icon ?? '') : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (!calendar) { setError('Select a journal'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const editProps = props as EditProps;
        await updateJournal(editProps.journal.uid, { summary: title.trim(), description: body, icon: icon || undefined });
        editProps.onSaved();
      } else {
        const createProps = props as CreateProps;
        const prevUids = new Set(journals.map((j) => j.component.uid));
        await createJournal(calendar, { summary: title.trim(), description: body, icon: icon || undefined });
        const newItem = useCalendarStore.getState().journals.find((j) => !prevUids.has(j.component.uid));
        createProps.onCreated(newItem?.component.uid ?? '');
      }
    } catch {
      setError(isEdit ? 'Failed to save note' : 'Failed to create note');
      setSaving(false);
    }
  };

  return (
    <Modal onClose={props.onClose} className="w-full max-w-lg">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-th-border">
          <h2 className="text-sm font-semibold text-th-text">{isEdit ? 'Edit note' : 'New journal note'}</h2>
          <button type="button" onClick={props.onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:bg-th-hover transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-th-muted uppercase tracking-wide">Journal</label>
            <Dropdown
              value={calendar}
              onChange={setCalendar}
              options={calOptions}
              placeholder="Select journal…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-th-muted uppercase tracking-wide">Title</label>
            <div className="flex items-center gap-2">
              <IconPicker value={icon} onChange={setIcon} />
              <input
                autoFocus
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(''); }}
                placeholder="Folder/Note name (slashes = folders)"
                className="flex-1 px-3 py-2 rounded-xl border border-th-border bg-th-surface text-sm text-th-text placeholder-th-muted/40 outline-none focus:border-th-subtle transition-colors"
              />
            </div>
            <p className="text-[10px] text-th-muted/50">Use / to nest: <em>February/24th</em></p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-th-muted uppercase tracking-wide">Content</label>
            <div className="min-h-[120px] rounded-xl border border-th-border bg-th-surface px-3 py-2">
              <MarkdownEditor
                key={isEdit ? (props as EditProps).journal.uid : 'new'}
                defaultValue={body}
                onChange={setBody}
                placeholder="Start writing…"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={props.onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-th-border text-th-muted hover:bg-th-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-th-accent text-th-accent-fg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
