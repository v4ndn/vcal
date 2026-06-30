export interface CalendarEvent {
  uid: string;
  baseUid: string; // component uid without dateKey suffix (for store lookup)
  summary: string;
  description?: string;
  start: Date;
  end?: Date;
  calendarName: string;
  calendarColor?: string;
  type: 'VEVENT' | 'VTODO';
  allDay?: boolean;
  occurrenceStart?: Date; // original rrule occurrence time; set for recurring events, used for RECURRENCE-ID
}
