declare module 'ical' {
  interface RRule {
    between(after: Date, before: Date, inc?: boolean): Date[];
  }

  // Sparse object keyed by "YYYY-MM-DD" date string
  type ExDateMap = Record<string, Date>;

  interface VEvent {
    type: 'VEVENT';
    uid: string;
    summary: string;
    description?: string;
    start: Date;
    end?: Date;
    location?: string;
    rrule?: RRule;
    exdate?: ExDateMap;
    recurrences?: Record<string, VEvent>;
  }

  interface VTodo {
    type: 'VTODO';
    uid: string;
    summary: string;
    description?: string;
    start?: Date;
    due?: string;
    completed?: Date;
    rrule?: RRule;
    exdate?: ExDateMap;
  }

  interface Other {
    type: string;
    [key: string]: unknown;
  }

  type CalendarComponent = VEvent | VTodo | Other;

  function parseICS(data: string): Record<string, CalendarComponent>;
}
