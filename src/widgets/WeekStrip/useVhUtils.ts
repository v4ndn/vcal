import { useThemeStore } from '../../entities/theme/model/store';

export interface VhUtils {
  HOUR_HEIGHT: number;
  SNAP_VH: number;
  timeToVh: (date: Date) => number;
  durationToVh: (start: Date, end: Date) => number;
  snapVh: (vh: number) => number;
  vhToDate: (vh: number, day: Date) => Date;
}

export function useVhUtils(): VhUtils {
  const HOUR_HEIGHT = useThemeStore((s) => s.hourHeight);
  const SNAP_VH = HOUR_HEIGHT / 4;

  const timeToVh = (date: Date) =>
    (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;

  const durationToVh = (start: Date, end: Date) =>
    Math.max((end.getTime() - start.getTime()) / 3_600_000 * HOUR_HEIGHT, 2.5);

  const snapVh = (vh: number) => Math.round(vh / SNAP_VH) * SNAP_VH;

  const vhToDate = (vh: number, day: Date): Date => {
    const totalMinutes = Math.round((vh / HOUR_HEIGHT) * 60);
    const d = new Date(day);
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return d;
  };

  return { HOUR_HEIGHT, SNAP_VH, timeToVh, durationToVh, snapVh, vhToDate };
}
