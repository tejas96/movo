export const minutes = (n: number): number => n * 60 * 1000;
export const hours = (n: number): number => minutes(n * 60);
export const days = (n: number): number => hours(n * 24);
export const addMs = (date: Date, ms: number): Date => new Date(date.getTime() + ms);
export const iso = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;
