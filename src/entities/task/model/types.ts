export interface CalendarTask {
  uid: string;
  summary: string;
  description?: string;
  start?: Date;
  due?: Date;
  completed: boolean;
  repeating: boolean;
  calendarName: string;
  calendarColor?: string;
}
