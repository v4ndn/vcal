export function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function fmtDateOnly(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// ── RFC 5545 text utilities ───────────────────────────────────────────────────

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function unescapeICSText(text: string): string {
  // Process escapes atomically to avoid double-unescaping (e.g. \\n → \n, not newline)
  return text.replace(/\\(n|N|;|,|\\)/g, (_, c) =>
    c === 'n' || c === 'N' ? '\n' : c,
  );
}

// RFC 5545 §3.1: fold lines at 75 octets using CRLF + SPACE continuation
function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    chunks.push('\r\n ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('');
}

// Join CRLF+SPACE (or LF+SPACE) continuation lines before parsing
function unfoldBlock(block: string): string {
  return block.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

// Replace or insert DTEND within a single component block.
// Prefers replacing DTEND; falls back to DURATION; inserts after DTSTART as last resort.
function replaceDtend(block: string, formatted: string): string {
  const line = `DTEND:${formatted}`;
  if (/^DTEND/m.test(block))
    return block.replace(/^DTEND(?:;[^:\r\n]*)?: *[^\r\n]+/m, line);
  if (/^DURATION/m.test(block))
    return block.replace(/^DURATION:[^\r\n]+/m, line);
  return block.replace(/^(DTSTART[^\r\n]+)/m, `$1\r\n${line}`);
}

// Apply a transform to the first VEVENT or VTODO block in the ICS string.
function updateFirstComponent(
  ics: string,
  transform: (block: string) => string,
): string {
  if (/BEGIN:VEVENT/.test(ics))
    return ics.replace(/(BEGIN:VEVENT[\s\S]*?END:VEVENT)/, transform);
  return ics.replace(/(BEGIN:VTODO[\s\S]*?END:VTODO)/, transform);
}


// ── Parse helpers (for pre-filling edit forms) ────────────────────────────────

function getMasterBlock(ics: string): string {
  const vevent = [...ics.matchAll(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g)].find(m => !/^RECURRENCE-ID/m.test(m[0]));
  if (vevent) return vevent[0];
  const vtodo = [...ics.matchAll(/BEGIN:VTODO[\s\S]*?END:VTODO/g)].find(m => !/^RECURRENCE-ID/m.test(m[0]));
  return vtodo ? vtodo[0] : '';
}

export function parseICSDescription(ics: string, occurrenceStart?: Date): string {
  let block = getMasterBlock(ics);
  if (occurrenceStart) {
    const rid = formatICSDate(occurrenceStart);
    const override = [...ics.matchAll(/BEGIN:(?:VEVENT|VTODO)[\s\S]*?END:(?:VEVENT|VTODO)/g)]
      .find(m => {
        const ridMatch = m[0].match(/^RECURRENCE-ID:([^\r\n]+)/m);
        return ridMatch && ridMatch[1].trim() === rid;
      });
    if (override) block = override[0];
  }
  const unfolded = unfoldBlock(block).replace(/BEGIN:VALARM[\s\S]*?END:VALARM/g, '');
  const m = unfolded.match(/^DESCRIPTION(?:;[^:\r\n]*)?:([^\r\n]*)/m);
  return m ? unescapeICSText(m[1]) : '';
}

export function parseICSRrule(ics: string): string {
  const block = getMasterBlock(ics);
  const m = block.match(/^RRULE:([^\r\n]+)/m);
  return m ? m[1].trim() : '';
}

export function parseICSRemindersList(ics: string): number[] {
  const block = getMasterBlock(ics);
  const alarms = block.match(/BEGIN:VALARM[\s\S]*?END:VALARM/g) ?? [];
  return alarms.flatMap((alarm) => {
    const d = alarm.match(/^TRIGGER(?:;[^:\r\n]*)?:-P(\d+)D/m);
    if (d) return [parseInt(d[1]) * 1440];
    const h = alarm.match(/^TRIGGER(?:;[^:\r\n]*)?:-PT(\d+)H/m);
    if (h) return [parseInt(h[1]) * 60];
    const m = alarm.match(/^TRIGGER(?:;[^:\r\n]*)?:-PT(\d+)M/m);
    if (m) return [parseInt(m[1])];
    return [] as number[];
  });
}

export function parseICSReminderMinutes(ics: string): number | null {
  const list = parseICSRemindersList(ics);
  return list.length > 0 ? list[0] : null;
}

export function parseICSIsAllDay(ics: string): boolean {
  return /^DTSTART(?:;[^:\r\n]*)?:\d{8}\s*$/m.test(getMasterBlock(ics));
}

// ── Full event update (for edit modal) ────────────────────────────────────────

function makeValarm(mins: number): string {
  const trigger = mins >= 1440
    ? `TRIGGER:-P${Math.floor(mins / 1440)}D`
    : mins >= 60
      ? `TRIGGER:-PT${Math.floor(mins / 60)}H`
      : `TRIGGER:-PT${mins}M`;
  return `\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\n${trigger}\r\nEND:VALARM`;
}

interface UpdateFullOpts {
  summary: string;
  start: Date;
  end: Date | undefined;
  description: string;
  rrule: string;
  reminders: number[];
  allDay?: boolean;
}

function applyAllFields(block: string, opts: UpdateFullOpts): string {
  let r = block;

  // DTSTART
  r = r.replace(
    /^DTSTART(?:;[^:\r\n]*)?: *[^\r\n]+/m,
    opts.allDay
      ? `DTSTART;VALUE=DATE:${fmtDateOnly(opts.start)}`
      : `DTSTART:${formatICSDate(opts.start)}`,
  );

  // DTEND / DURATION
  if (opts.end) {
    const dtendLine = opts.allDay
      ? `DTEND;VALUE=DATE:${fmtDateOnly(opts.end)}`
      : `DTEND:${formatICSDate(opts.end)}`;
    if (/^DTEND/m.test(r))
      r = r.replace(/^DTEND(?:;[^:\r\n]*)?: *[^\r\n]+/m, dtendLine);
    else if (/^DURATION/m.test(r))
      r = r.replace(/^DURATION:[^\r\n]+/m, dtendLine);
    else
      r = r.replace(/^(DTSTART[^\r\n]+)/m, `$1\r\n${dtendLine}`);
  }

  // Strip VALARMs early so DESCRIPTION/SUMMARY regexes don't match inside alarm blocks
  r = r.replace(/\r?\nBEGIN:VALARM[\s\S]*?END:VALARM/g, '');

  // SUMMARY
  const summaryLine = foldICSLine(`SUMMARY:${escapeICSText(opts.summary)}`);
  if (/^SUMMARY/m.test(r)) r = r.replace(/^SUMMARY:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*/m, summaryLine);
  else r = r.replace(/(UID:[^\r\n]+)/, `$1\r\n${summaryLine}`);

  // DESCRIPTION
  if (opts.description) {
    const line = foldICSLine(`DESCRIPTION:${escapeICSText(opts.description)}`);
    if (/^DESCRIPTION/m.test(r)) r = r.replace(/^DESCRIPTION(?:;[^:\r\n]*)?:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*/m, line);
    else r = r.replace(/(SUMMARY:[^\r\n]+(?:\r\n[ \t][^\r\n]*)*)/, `$1\r\n${line}`);
  } else {
    r = r.replace(/^DESCRIPTION(?:;[^:\r\n]*)?:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*\r?\n?/m, '');
  }

  // RRULE
  if (opts.rrule) {
    if (/^RRULE/m.test(r)) r = r.replace(/^RRULE:[^\r\n]*/m, `RRULE:${opts.rrule}`);
    else r = r.replace(/(DTSTART[^\r\n]+)/, `$1\r\nRRULE:${opts.rrule}`);
  } else {
    r = r.replace(/^RRULE:[^\r\n]*\r?\n?/m, '');
  }

  // Re-add VALARMs (already stripped above)
  if (opts.reminders.length > 0) {
    const valarms = opts.reminders.map(makeValarm).join('');
    r = r.replace(/END:(VEVENT|VTODO)/, `${valarms}\r\nEND:$1`);
  }

  return r;
}

export function updateEventFull(
  ics: string,
  opts: UpdateFullOpts,
  scope: 'single' | 'all',
  occurrenceStart?: Date,
  componentType: 'VEVENT' | 'VTODO' = 'VEVENT',
): string {
  if (scope === 'single' && occurrenceStart) {
    const uid = (ics.match(/^UID:([^\r\n]+)/m) ?? [])[1]?.trim() ?? '';
    const recurrenceId = formatICSDate(occurrenceStart);

    // Remove existing override for this RECURRENCE-ID
    const stripOverride = (block: string) => {
      const rid = block.match(/^RECURRENCE-ID:([^\r\n]+)/m);
      return rid && rid[1].trim() === recurrenceId ? '' : block;
    };
    let cleaned = ics
      .replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g, stripOverride)
      .replace(/BEGIN:VTODO[\s\S]*?END:VTODO/g, stripOverride);

    const valarmBlock = opts.reminders.length > 0
      ? opts.reminders.map(makeValarm).join('')
      : '';

    const descLine = opts.description
      ? `\r\n${foldICSLine(`DESCRIPTION:${escapeICSText(opts.description)}`)}`
      : '';

    const rruleLine = opts.rrule ? `\r\nRRULE:${opts.rrule}` : '';

    const fallbackEnd = opts.allDay
      ? new Date(opts.start.getTime() + 86_400_000)
      : new Date(opts.start.getTime() + 3_600_000);
    const dtStartLine = opts.allDay
      ? `DTSTART;VALUE=DATE:${fmtDateOnly(opts.start)}`
      : `DTSTART:${formatICSDate(opts.start)}`;
    const dtEndLine = opts.allDay
      ? `DTEND;VALUE=DATE:${fmtDateOnly(opts.end ?? fallbackEnd)}`
      : `DTEND:${formatICSDate(opts.end ?? fallbackEnd)}`;

    const override = [
      `BEGIN:${componentType}`,
      `UID:${uid}`,
      `RECURRENCE-ID:${recurrenceId}`,
      dtStartLine,
      dtEndLine,
      `SUMMARY:${opts.summary}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
    ].join('\r\n') + descLine + rruleLine + valarmBlock + `\r\nEND:${componentType}`;

    return cleaned.replace(/END:VCALENDAR/, `${override}\r\nEND:VCALENDAR`);
  }

  // scope='all' or non-recurring: update master component (skip RECURRENCE-ID blocks)
  const updateMaster = (block: string) =>
    /^RECURRENCE-ID/m.test(block) ? block : applyAllFields(block, opts);

  return ics
    .replace(/(BEGIN:VEVENT[\s\S]*?END:VEVENT)/g, updateMaster)
    .replace(/(BEGIN:VTODO[\s\S]*?END:VTODO)/g, updateMaster);
}

// Add an EXDATE entry to exclude one occurrence from a recurring event.
// Also strips any existing override block with the same RECURRENCE-ID.
export function addExdate(ics: string, occurrenceStart: Date): string {
  const dateStr = formatICSDate(occurrenceStart);

  // Remove any existing single-occurrence override for this date
  const stripOverride = (block: string) => {
    const rid = block.match(/^RECURRENCE-ID:([^\r\n]+)/m);
    return rid && rid[1].trim() === dateStr ? '' : block;
  };
  let result = ics
    .replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g, stripOverride)
    .replace(/BEGIN:VTODO[\s\S]*?END:VTODO/g, stripOverride);

  // Add EXDATE to the master component (no RECURRENCE-ID)
  const addToMaster = (block: string) => {
    if (/^RECURRENCE-ID/m.test(block)) return block;
    if (/^EXDATE/m.test(block))
      return block.replace(/^(EXDATE:[^\r\n]+)/m, `$1,${dateStr}`);
    return block.replace(/^(DTSTART[^\r\n]+)/m, `$1\r\nEXDATE:${dateStr}`);
  };
  return result
    .replace(/(BEGIN:VEVENT[\s\S]*?END:VEVENT)/g, addToMaster)
    .replace(/(BEGIN:VTODO[\s\S]*?END:VTODO)/g, addToMaster);
}

// Parse DTSTART and DUE dates from a VTODO ICS for pre-filling an edit form.
function parseICSDateStr(str: string): Date | undefined {
  const s = str.trim();
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const dtm = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dtm) {
    d = dtm[7]
      ? new Date(Date.UTC(+dtm[1], +dtm[2] - 1, +dtm[3], +dtm[4], +dtm[5], +dtm[6]))
      : new Date(+dtm[1], +dtm[2] - 1, +dtm[3], +dtm[4], +dtm[5], +dtm[6]);
    if (!isNaN(d.getTime())) return d;
  }
  const dtd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dtd) return new Date(+dtd[1], +dtd[2] - 1, +dtd[3]);
  return undefined;
}

export function parseICSTaskDates(ics: string): { start?: Date; due?: Date } {
  const block = getMasterBlock(ics);
  const sm = block.match(/^DTSTART(?:;[^:\r\n]*)?:([^\r\n]+)/m);
  const dm = block.match(/^DUE(?:;[^:\r\n]*)?:([^\r\n]+)/m);
  return {
    start: sm ? parseICSDateStr(sm[1]) : undefined,
    due: dm ? parseICSDateStr(dm[1]) : undefined,
  };
}

// Full VTODO update: summary, description, start (optional), due (optional), rrule, reminder.
interface UpdateTaskOpts {
  summary: string;
  start: Date | undefined;
  due: Date | undefined;
  description: string;
  rrule: string;
  reminders: number[];
  allDay?: boolean;
}

export function updateTaskFull(ics: string, opts: UpdateTaskOpts): string {
  return updateFirstComponent(ics, (block) => {
    let r = block;

    // DTSTART (optional for VTODO)
    if (opts.start) {
      const dtLine = opts.allDay
        ? `DTSTART;VALUE=DATE:${fmtDateOnly(opts.start)}`
        : `DTSTART:${formatICSDate(opts.start)}`;
      if (/^DTSTART/m.test(r)) r = r.replace(/^DTSTART(?:;[^:\r\n]*)?:[^\r\n]+/m, dtLine);
      else r = r.replace(/(DTSTAMP:[^\r\n]+)/, `$1\r\n${dtLine}`);
    } else {
      r = r.replace(/^DTSTART(?:;[^:\r\n]*)?:[^\r\n]*\r?\n?/m, '');
    }

    // DUE
    if (opts.due) {
      const dueLine = opts.allDay
        ? `DUE;VALUE=DATE:${fmtDateOnly(opts.due)}`
        : `DUE:${formatICSDate(opts.due)}`;
      if (/^DUE/m.test(r)) r = r.replace(/^DUE(?:;[^:\r\n]*)?:[^\r\n]+/m, dueLine);
      else r = r.replace(/(DTSTAMP:[^\r\n]+)/, `$1\r\n${dueLine}`);
    } else {
      r = r.replace(/^DUE(?:;[^:\r\n]*)?:[^\r\n]*\r?\n?/m, '');
    }

    // Strip VALARMs early so DESCRIPTION/SUMMARY regexes don't match inside alarm blocks
    r = r.replace(/\r?\nBEGIN:VALARM[\s\S]*?END:VALARM/g, '');

    // SUMMARY
    const summaryLine = foldICSLine(`SUMMARY:${escapeICSText(opts.summary)}`);
    if (/^SUMMARY/m.test(r)) r = r.replace(/^SUMMARY:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*/m, summaryLine);
    else r = r.replace(/(UID:[^\r\n]+)/, `$1\r\n${summaryLine}`);

    // DESCRIPTION
    if (opts.description) {
      const line = foldICSLine(`DESCRIPTION:${escapeICSText(opts.description)}`);
      if (/^DESCRIPTION/m.test(r)) r = r.replace(/^DESCRIPTION(?:;[^:\r\n]*)?:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*/m, line);
      else r = r.replace(/(SUMMARY:[^\r\n]+(?:\r\n[ \t][^\r\n]*)*)/, `$1\r\n${line}`);
    } else {
      r = r.replace(/^DESCRIPTION(?:;[^:\r\n]*)?:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*\r?\n?/m, '');
    }

    // RRULE
    if (opts.rrule) {
      if (/^RRULE/m.test(r)) r = r.replace(/^RRULE:[^\r\n]*/m, `RRULE:${opts.rrule}`);
      else r = r.replace(/(DTSTART[^\r\n]+|DTSTAMP[^\r\n]+)/, `$1\r\nRRULE:${opts.rrule}`);
    } else {
      r = r.replace(/^RRULE:[^\r\n]*\r?\n?/m, '');
    }

    // Re-add VALARMs (already stripped above)
    if (opts.reminders.length > 0) {
      const valarms = opts.reminders.map(makeValarm).join('');
      r = r.replace(/END:VTODO/, `${valarms}\r\nEND:VTODO`);
    }

    return r;
  });
}

// Toggle VTODO STATUS:COMPLETED (and COMPLETED / PERCENT-COMPLETE fields).
export function setTaskStatus(ics: string, completed: boolean): string {
  return updateFirstComponent(ics, (block) => {
    let r = block;
    r = r.replace(/^STATUS:[^\r\n]*\r?\n?/m, '');
    r = r.replace(/^COMPLETED:[^\r\n]*\r?\n?/m, '');
    r = r.replace(/^PERCENT-COMPLETE:[^\r\n]*\r?\n?/m, '');
    if (completed) {
      const now = formatICSDate(new Date());
      r = r.replace(
        /END:(VTODO|VEVENT)/,
        `STATUS:COMPLETED\r\nCOMPLETED:${now}\r\nPERCENT-COMPLETE:100\r\nEND:$1`,
      );
    }
    return r;
  });
}

// Replace DTSTART / DTEND in a raw ICS string.
// Scoped to the first VEVENT or VTODO block so VTIMEZONE's DTSTART is never touched.
// Strips TZID params and rewrites as UTC — safe for Radicale.
// Inserts DTEND if missing (replacing DURATION if present).
export function updateICSTimes(
  ics: string,
  newStart: Date,
  newEnd: Date | undefined,
): string {
  return updateFirstComponent(ics, (block) => {
    let result = block.replace(
      /^DTSTART(?:;[^:\r\n]*)?: *[^\r\n]+/m,
      `DTSTART:${formatICSDate(newStart)}`,
    );
    if (newEnd) result = replaceDtend(result, formatICSDate(newEnd));
    return result;
  });
}

// For recurring events: replace only the TIME portion of DTSTART/DTEND on the

// ── VJOURNAL helpers ──────────────────────────────────────────────────────────

export function parseJournalIcon(ics: string): string {
  const m = ics.match(/^X-ICON:([^\r\n]+)/m);
  return m ? m[1].trim() : '';
}

export function buildJournalICS(uid: string, summary: string, description: string, icon?: string): string {
  const now = formatICSDate(new Date());
  const summaryLine = foldICSLine(`SUMMARY:${escapeICSText(summary)}`);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//vcalendar//EN',
    'BEGIN:VJOURNAL',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    summaryLine,
  ];
  if (description) lines.push(foldICSLine(`DESCRIPTION:${escapeICSText(description)}`));
  if (icon) lines.push(`X-ICON:${icon}`);
  lines.push('END:VJOURNAL', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function updateJournalFull(ics: string, opts: { summary: string; description: string; icon?: string }): string {
  return ics.replace(/(BEGIN:VJOURNAL[\s\S]*?END:VJOURNAL)/, (block) => {
    let r = block;

    const summaryLine = foldICSLine(`SUMMARY:${escapeICSText(opts.summary)}`);
    if (/^SUMMARY/m.test(r)) r = r.replace(/^SUMMARY:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*/m, summaryLine);
    else r = r.replace(/(UID:[^\r\n]+)/, `$1\r\n${summaryLine}`);

    if (opts.description) {
      const descLine = foldICSLine(`DESCRIPTION:${escapeICSText(opts.description)}`);
      if (/^DESCRIPTION/m.test(r)) r = r.replace(/^DESCRIPTION(?:;[^:\r\n]*)?:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*/m, descLine);
      else r = r.replace(/(SUMMARY:[^\r\n]+(?:\r\n[ \t][^\r\n]*)*)/, `$1\r\n${descLine}`);
    } else {
      r = r.replace(/^DESCRIPTION(?:;[^:\r\n]*)?:[^\r\n]*(?:\r\n[ \t][^\r\n]*)*\r?\n?/m, '');
    }

    if (opts.icon) {
      if (/^X-ICON/m.test(r)) r = r.replace(/^X-ICON:[^\r\n]*/m, `X-ICON:${opts.icon}`);
      else r = r.replace(/(END:VJOURNAL)/, `X-ICON:${opts.icon}\r\n$1`);
    } else {
      r = r.replace(/^X-ICON:[^\r\n]*\r?\n?/m, '');
    }

    return r;
  });
}

