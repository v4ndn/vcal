export interface CalendarMeta {
  name: string;
  color?: string;
  url: string;
  isJournal?: boolean;  // supports VJOURNAL (can hold notes)
  isCalendar?: boolean; // supports VEVENT/VTODO (can hold events/tasks)
}

export interface StoredComponent {
  type: 'VEVENT' | 'VTODO' | 'VJOURNAL';
  uid?: string;
  summary?: string;
  start?: Date;
  end?: Date;
  due?: string;
  rrule?: { between(a: Date, b: Date, inc?: boolean): Date[] };
  exdate?: Record<string, Date>;
  recurrences?: Record<string, { summary?: string; description?: string; start?: Date; end?: Date }>;
}

export interface StoredItem {
  component: StoredComponent;
  calendarName: string;
  calendarColor?: string;
  objectUrl: string;
  etag?: string;
  rawData: string;
}
