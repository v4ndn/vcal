export interface CalendarTask {
  uid: string;
  summary: string;
  description?: string;
  start?: Date;
  due?: Date;
  completed: boolean;
  allDay: boolean;
  calendarName: string;
  calendarColor?: string;
}
