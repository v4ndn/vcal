import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { X, Calendar, Clock, RefreshCw, Bell, Tag } from 'lucide-react';
import { useCalendarStore } from '../../entities/calendar/model/store';
import type { CalendarEvent } from '../../entities/event/model/types';
import { parseICSDescription, parseICSRrule, parseICSReminderMinutes } from '../../shared/lib/icsUpdate';

// ── RRULE → human label ────────────────────────────────────────────────────────

function rruleLabel(rrule: string): string {
  if (!rrule) return '';
  if (/FREQ=DAILY/.test(rrule)) return 'Every day';
  if (/FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/.test(rrule)) return 'Every weekday';
  if (/FREQ=WEEKLY/.test(rrule)) {
    const byday = rrule.match(/BYDAY=([^;]+)/);
    return byday ? `Every week on ${byday[1]}` : 'Every week';
  }
  if (/FREQ=MONTHLY/.test(rrule)) return 'Every month';
  if (/FREQ=YEARLY/.test(rrule)) return 'Every year';
  return rrule;
}

function reminderLabel(minutes: number): string {
  if (minutes === 0) return 'At start time';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} hr before`;
  return `${minutes / 1440} day before`;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── component ──────────────────────────────────────────────────────────────────

interface Props {
  event: CalendarEvent;
  onClose: () => void;
}

export default function EventOverviewModal({ event, onClose }: Props) {
  const items = useCalendarStore((s) => s.items);
  const item = items.find((i) => i.component.uid === event.baseUid);

  const description = item ? parseICSDescription(item.rawData) : (event.description ?? '');
  const rrule = item ? parseICSRrule(item.rawData) : '';
  const reminderMinutes = item ? parseICSReminderMinutes(item.rawData) : null;
  const isRecurring = event.uid !== event.baseUid;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <motion.div
        className="bg-th-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-th-border shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              {event.calendarColor && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: event.calendarColor }}
                />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-widest text-th-muted truncate">
                {event.calendarName}
              </span>
            </div>
            <h2 className="text-base font-bold text-th-text leading-snug break-words">
              {event.summary}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-th-muted hover:text-th-text hover:bg-th-subtle transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Description */}
          {description && (
            <>
              <div className="h-px bg-th-border" />
              <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{description}</ReactMarkdown>
              </div>
            </>
          )}

          {/* Date & time */}
          <Row icon={<Clock size={13} />}>
            <div>
              <p className="text-sm font-medium text-th-text">{formatDateTime(event.start)}</p>
              {event.end && (
                <p className="text-xs text-th-muted mt-0.5">
                  {formatTime(event.start)} – {formatTime(event.end)}
                </p>
              )}
            </div>
          </Row>

          {/* Type badge */}
          <Row icon={<Tag size={13} />}>
            <span className="text-xs font-medium text-th-muted">
              {event.type === 'VTODO' ? 'Task' : 'Event'}
              {isRecurring && ' · Recurring'}
            </span>
          </Row>

          {/* Recurrence */}
          {rrule && (
            <Row icon={<RefreshCw size={13} />}>
              <span className="text-xs font-medium text-th-muted">{rruleLabel(rrule)}</span>
            </Row>
          )}

          {/* Reminder */}
          {reminderMinutes !== null && (
            <Row icon={<Bell size={13} />}>
              <span className="text-xs font-medium text-th-muted">{reminderLabel(reminderMinutes)}</span>
            </Row>
          )}

          {/* Calendar */}
          <Row icon={<Calendar size={13} />}>
            <div className="flex items-center gap-1.5">
              {event.calendarColor && (
                <span
                  className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                  style={{ backgroundColor: event.calendarColor }}
                />
              )}
              <span className="text-xs font-medium text-th-muted">{event.calendarName}</span>
            </div>
          </Row>

        </div>
      </motion.div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-th-muted shrink-0 mt-0.5">{icon}</span>
      {children}
    </div>
  );
}
