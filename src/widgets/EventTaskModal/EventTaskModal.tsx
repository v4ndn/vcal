import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { X } from 'lucide-react';
import { useCalendarStore } from '../../entities/calendar/model/store';
import type { CalendarEvent } from '../../entities/event/model/types';
import type { CalendarTask } from '../../entities/task/model/types';
import {
  parseICSDescription, parseICSRrule, parseICSRemindersList,
  parseICSTaskDates, parseICSIsAllDay,
} from '../../shared/lib/icsUpdate';
import Modal from '../../shared/ui/Modal';
import Button from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { MarkdownEditor } from '../../shared/ui/MarkdownEditor';
import { DateRangePicker, DateRangeOnlyPicker } from '../../shared/ui/DateRangePicker';
import { Dropdown } from '../../shared/ui/Dropdown';
import { RemindersField } from '../../shared/ui/RemindersField';
import Field from '../../shared/ui/Field';

// ── helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocal(d: Date | undefined): string {
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function addOneDay(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() + 1); r.setHours(0, 0, 0, 0); return r;
}

function subOneDay(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() - 1); r.setHours(0, 0, 0, 0); return r;
}

const RRULE_PRESETS = [
  { label: 'No repeat',    value: '' },
  { label: 'Every day',   value: 'FREQ=DAILY' },
  { label: 'Every week',  value: 'FREQ=WEEKLY' },
  { label: 'Every month', value: 'FREQ=MONTHLY' },
  { label: 'Every year',  value: 'FREQ=YEARLY' },
  { label: 'Weekdays',    value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Custom…',     value: '__custom__' },
] as const;

function rruleToPreset(raw: string): string {
  if (!raw) return '';
  const found = RRULE_PRESETS.find((p) => p.value !== '__custom__' && p.value === raw);
  return found ? found.value : '__custom__';
}

// ── types ─────────────────────────────────────────────────────────────────────

type FormValues = {
  summary: string;
  start: string;
  end: string;
  rrulePreset: string;
  rruleCustom: string;
};

export type Props =
  | { type: 'event'; mode: 'create'; initialStart: Date; initialEnd: Date; onClose: () => void }
  | { type: 'event'; mode: 'edit';   event: CalendarEvent;                  onClose: () => void }
  | { type: 'task';  mode: 'create'; initialDue?: Date;                     onClose: () => void }
  | { type: 'task';  mode: 'edit';   task: CalendarTask;                    onClose: () => void };

// ── component ─────────────────────────────────────────────────────────────────

export default function EventTaskModal(props: Props) {
  const { type, mode, onClose } = props;

  const isEditing = mode === 'edit';
  const isEvent   = type === 'event';

  // Unwrap discriminated union once so the rest of the component is simple
  const editEvent = isEditing && isEvent  ? (props as Extract<Props, { type: 'event'; mode: 'edit' }>).event : undefined;
  const editTask  = isEditing && !isEvent ? (props as Extract<Props, { type: 'task'; mode: 'edit' }>).task  : undefined;
  const initStart = !isEditing && isEvent  ? (props as Extract<Props, { type: 'event'; mode: 'create' }>).initialStart : undefined;
  const initEnd   = !isEditing && isEvent  ? (props as Extract<Props, { type: 'event'; mode: 'create' }>).initialEnd   : undefined;
  const initDue   = !isEditing && !isEvent ? (props as Extract<Props, { type: 'task'; mode: 'create' }>).initialDue   : undefined;

  const isRecurring = !!(editEvent && editEvent.uid !== editEvent.baseUid);

  // Store
  const items              = useCalendarStore((s) => s.items);
  const calendars          = useCalendarStore((s) => s.calendars);
  const createNewEvent     = useCalendarStore((s) => s.createNewEvent);
  const updateEventDetails = useCalendarStore((s) => s.updateEventDetails);
  const updateTaskDetails  = useCalendarStore((s) => s.updateTaskDetails);

  // State
  const [allDay,    setAllDay]    = useState(false);
  const [reminders, setReminders] = useState<number[]>([]);
  const [scope,     setScope]     = useState<'single' | 'all'>('single');
  const [mdValue,   setMdValue]   = useState('');
  const [mdReady,   setMdReady]   = useState(!isEditing);
  const [targetCal, setTargetCal] = useState(() => {
    if (editEvent) return items.find((i) => i.component.uid === editEvent.baseUid)?.calendarName ?? '';
    if (editTask)  return items.find((i) => i.component.uid === editTask.uid && i.component.type === 'VTODO')?.calendarName ?? '';
    return calendars[0]?.name ?? '';
  });

  // Compute create-mode defaults once
  const now = new Date();
  const createStart = isEvent ? initStart! : now;
  const createEnd   = isEvent ? initEnd!   : (initDue ?? new Date(now.getTime() + 86_400_000));

  const { register, handleSubmit, watch, reset, setValue, control, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      summary:     editEvent?.summary ?? editTask?.summary ?? '',
      start:       isEditing ? '' : toDatetimeLocal(createStart),
      end:         isEditing ? '' : toDatetimeLocal(createEnd),
      rrulePreset: '',
      rruleCustom: '',
    },
  });

  // Populate form from raw ICS when in edit mode
  useEffect(() => {
    if (!isEditing) return;

    if (editEvent) {
      const item = items.find((i) => i.component.uid === editEvent.baseUid);
      if (!item) return;
      const raw   = item.rawData;
      const rrule = parseICSRrule(raw);
      const isAD  = parseICSIsAllDay(raw);
      const desc  = parseICSDescription(raw, isRecurring ? editEvent.occurrenceStart ?? editEvent.start : undefined);
      setReminders(parseICSRemindersList(raw));
      setAllDay(isAD);
      setTargetCal(item.calendarName);
      setMdValue(desc);
      setMdReady(true);
      reset({
        summary:     editEvent.summary,
        start:       toDatetimeLocal(editEvent.start),
        end:         editEvent.end ? toDatetimeLocal(isAD ? subOneDay(editEvent.end) : editEvent.end) : '',
        rrulePreset: rruleToPreset(rrule),
        rruleCustom: rrule,
      });
    } else if (editTask) {
      const item = items.find((i) => i.component.uid === editTask.uid && i.component.type === 'VTODO');
      if (!item) return;
      const raw   = item.rawData;
      const rrule = parseICSRrule(raw);
      const { start, due } = parseICSTaskDates(raw);
      const isAD  = parseICSIsAllDay(raw);
      const desc  = parseICSDescription(raw);
      setReminders(parseICSRemindersList(raw));
      setAllDay(isAD);
      setTargetCal(item.calendarName);
      setMdValue(desc);
      setMdReady(true);
      reset({
        summary:     editTask.summary,
        start:       toDatetimeLocal(start),
        end:         toDatetimeLocal(isAD && due ? subOneDay(due) : due),
        rrulePreset: rruleToPreset(rrule),
        rruleCustom: rrule,
      });
    }
  }, [editEvent?.baseUid, editTask?.uid, items]);

  const rrulePreset = watch('rrulePreset');
  const start       = watch('start');
  const end         = watch('end');

  async function onSubmit(data: FormValues) {
    const rrule   = data.rrulePreset === '__custom__' ? data.rruleCustom : data.rrulePreset;
    const endDate = data.end ? (allDay ? addOneDay(new Date(data.end)) : new Date(data.end)) : undefined;

    if (mode === 'create') {
      await createNewEvent(targetCal, {
        summary:     data.summary.trim() || (isEvent ? 'New Event' : 'New Task'),
        start:       data.start ? new Date(data.start) : now,
        end:         endDate,
        description: mdValue.trim(),
        rrule,
        reminders,
        type:        isEvent ? 'VEVENT' : 'VTODO',
        allDay,
      });
    } else if (editEvent) {
      await updateEventDetails(
        editEvent,
        {
          summary:     data.summary.trim() || 'Untitled',
          start:       new Date(data.start),
          end:         endDate,
          description: mdValue.trim(),
          rrule,
          reminders,
          allDay,
        },
        scope,
        targetCal,
      );
    } else if (editTask) {
      await updateTaskDetails(editTask.uid, {
        summary:     data.summary.trim() || 'Untitled',
        start:       data.start ? new Date(data.start) : undefined,
        due:         endDate,
        description: mdValue.trim(),
        rrule,
        reminders,
        allDay,
      }, targetCal);
    }

    onClose();
  }

  // Header
  const headerLabel = isEditing
    ? `${isEvent ? 'Event' : 'Task'}${isRecurring ? ' · Recurring' : ''}`
    : isEvent ? 'New event' : 'New task';
  const headerTitle = isEditing
    ? (editEvent?.summary ?? editTask?.summary ?? '')
    : (start ? new Date(start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '');

  const calColor = calendars.find((c) => c.name === targetCal)?.color;

  return (
    <Modal onClose={onClose} className="w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-th-border shrink-0">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">{headerLabel}</p>
          <h2 className="text-sm font-bold text-th-text mt-0.5 truncate max-w-[500px]">{headerTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 min-h-0 px-5 py-4 flex gap-5 overflow-hidden">
        {/* Left — info fields */}
        <div className="flex-[1] flex flex-col gap-4 min-w-0 overflow-y-auto pr-1">

          <Field label="Title">
            <Input
              type="text"
              {...register('summary', { required: true })}
              placeholder={isEvent ? 'New event' : 'New task'}
              autoFocus
            />
          </Field>

          <Field label="Calendar">
            <Dropdown
              value={targetCal}
              onChange={setTargetCal}
              options={calendars.map((c) => ({ value: c.name, label: c.name }))}
              prefix={calColor
                ? <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: calColor }} />
                : undefined}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">Date & time</span>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="w-3.5 h-3.5 accent-th-accent cursor-pointer"
                />
                <span className="text-xs text-th-muted">All day</span>
              </label>
            </div>
            <input type="hidden" {...register('start', { required: isEvent })} />
            <input type="hidden" {...register('end')} />
            {allDay
              ? <DateRangeOnlyPicker
                  start={start} end={end}
                  onApply={(s, e) => { setValue('start', s); setValue('end', e); }}
                  placeholder={isEvent ? 'Select dates' : 'Select start & due dates'}
                />
              : <DateRangePicker
                  start={start} end={end}
                  onApply={(s, e) => { setValue('start', s); setValue('end', e); }}
                  placeholder={isEvent ? 'Select dates & times' : 'Select start & due dates & times'}
                />
            }
          </div>

          {isEvent && (
            <Field label="Repeat">
              <Controller
                control={control}
                name="rrulePreset"
                render={({ field }) => (
                  <Dropdown
                    value={field.value}
                    onChange={field.onChange}
                    options={RRULE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                  />
                )}
              />
              {rrulePreset === '__custom__' && (
                <Input
                  type="text"
                  {...register('rruleCustom')}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
                  className="mt-2 font-mono text-xs"
                />
              )}
            </Field>
          )}

          <Field label="Reminders">
            <RemindersField
              reminders={reminders}
              onChange={setReminders}
              zeroLabel={isEvent ? undefined : 'At due time'}
            />
          </Field>

          {/* Scope selector — only shown when editing a recurring event */}
          {isRecurring && (
            <div className="flex flex-col gap-2 pt-1 border-t border-th-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-th-muted">Apply to</p>
              <div className="flex gap-2">
                {([['single', 'This event only'], ['all', 'All events in series']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setScope(val)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      scope === val
                        ? 'bg-th-accent text-th-accent-fg border-th-accent'
                        : 'bg-transparent text-th-muted border-th-border hover:border-th-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1 mt-auto">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 py-2.5">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !targetCal} className="flex-1 py-2.5">
              {isSubmitting
                ? (isEditing ? 'Saving…'   : 'Creating…')
                : (isEditing ? 'Save'       : 'Create')}
            </Button>
          </div>
        </div>

        {/* Right — description */}
        <div className="flex-[2] flex flex-col gap-1.5 min-w-0 min-h-0">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-th-muted shrink-0">
            Description
          </label>
          {mdReady
            ? <MarkdownEditor
                key={editEvent?.baseUid ?? editTask?.uid ?? 'create'}
                defaultValue={mdValue}
                onChange={setMdValue}
                className="flex-1 min-h-0 rounded-xl border border-th-border bg-th-surface"
                placeholder="Add a description…"
              />
            : <div className="flex-1 min-h-0 rounded-xl bg-th-subtle animate-pulse" />
          }
        </div>
      </form>
    </Modal>
  );
}
