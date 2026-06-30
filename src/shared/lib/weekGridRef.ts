// Module-level reference to the WeekStrip scrollable grid element.
// Used by the sidebar's preset-drag drop handler to compute column/time from cursor position.
export let weekGridEl: HTMLDivElement | null = null;

export function registerWeekGrid(el: HTMLDivElement | null): void {
  weekGridEl = el;
}
