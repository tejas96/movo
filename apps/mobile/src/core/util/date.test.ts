import { afterEach, describe, expect, it, vi } from 'vitest';

// The real module reads the language from device storage; the helpers only need the locale.
vi.mock('../i18n', () => ({ currentLocale: () => 'en' }));

const {
  dateTime,
  day,
  displayTimeZone,
  fromIsoDay,
  greetingKey,
  isoDay,
  mediumDate,
  setSocietyTimeZone,
  shortWhen,
  timeAndDay,
  whenRange,
} = await import('./date');

afterEach(() => setSocietyTimeZone(null));

describe('time-zone policy', () => {
  it('falls back to Asia/Kolkata until the society zone is known', () => {
    expect(displayTimeZone()).toBe('Asia/Kolkata');
    setSocietyTimeZone('Not/AZone');
    expect(displayTimeZone()).toBe('Asia/Kolkata');
  });

  it('shows instants in the society zone', () => {
    // 19:30 UTC is 1:00 the next morning in India and 3:30 pm in New York.
    const iso = '2026-10-03T19:30:00Z';
    expect(dateTime(iso)).toBe('Sun, 4 Oct, 1:00 am');
    expect(mediumDate(iso)).toBe('4 Oct 2026');
    setSocietyTimeZone('America/New_York');
    expect(dateTime(iso)).toBe('Sat, 3 Oct, 3:30 pm');
    expect(mediumDate(iso)).toBe('3 Oct 2026');
  });

  it('keeps calendar dates on their day in any zone', () => {
    setSocietyTimeZone('America/New_York');
    expect(day('2026-10-10')).toBe('10 Oct 2026');
    expect(day('2026-10-10', 'short')).toBe('10 Oct');
  });

  it('greets by the society clock', () => {
    const now = new Date('2026-10-03T03:30:00Z'); // 9:00 am in India
    expect(greetingKey(now)).toBe('morning');
    setSocietyTimeZone('America/New_York'); // 11:30 pm the day before
    expect(greetingKey(now)).toBe('evening');
  });
});

describe('formats', () => {
  it('ranges on one day show the end time only', () => {
    expect(whenRange('2026-10-03T13:30:00Z', '2026-10-03T14:30:00Z')).toBe(
      'Sat, 3 Oct, 7:00 pm – 8:00 pm',
    );
    expect(whenRange('2026-10-03T13:30:00Z', null)).toBe('Sat, 3 Oct, 7:00 pm');
  });

  it('shortWhen drops the date for today', () => {
    const now = new Date('2026-10-03T06:00:00Z');
    expect(shortWhen('2026-10-03T07:00:00Z', now)).toBe('12:30 pm');
    expect(shortWhen('2026-10-04T07:00:00Z', now)).toBe('Sun, 4 Oct, 12:30 pm');
    expect(shortWhen(null, now)).toBe('');
  });

  it('timeAndDay splits time and day', () => {
    expect(timeAndDay('2026-09-28T03:00:00Z')).toEqual({ time: '8:30 am', day: '28 Sept' });
  });

  it('isoDay and fromIsoDay round-trip a picker date', () => {
    expect(isoDay(fromIsoDay('2026-02-07'))).toBe('2026-02-07');
  });
});
