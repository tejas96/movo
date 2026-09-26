import { describe, expect, it } from 'vitest';
import { hours, minutes } from '../../common/util/dates';
import { dueWindows, isOver } from './schedule';

const now = new Date('2026-10-01T10:00:00Z');
const at = (ms: number) => new Date(now.getTime() + ms);

describe('dueWindows', () => {
  it('is empty before the first window opens', () => {
    expect(dueWindows(at(hours(30)), now, [24, 1])).toEqual([]);
  });
  it('opens the 24 h window a day before', () => {
    expect(dueWindows(at(hours(23)), now, [24, 1])).toEqual([24]);
  });
  it('lists every open window, smallest first', () => {
    expect(dueWindows(at(minutes(50)), now, [24, 1])).toEqual([1, 24]);
  });
  it('is empty once the start has passed', () => {
    expect(dueWindows(at(-minutes(1)), now, [24, 1])).toEqual([]);
  });
  it('ignores duplicate windows', () => {
    expect(dueWindows(at(minutes(30)), now, [1, 1])).toEqual([1]);
  });
});

describe('isOver', () => {
  it('uses the end time when there is one', () => {
    expect(isOver({ startsAt: at(-hours(3)), endsAt: at(minutes(5)) }, now)).toBe(false);
    expect(isOver({ startsAt: at(-hours(3)), endsAt: at(-minutes(5)) }, now)).toBe(true);
  });
  it('treats an open-ended item as running for two hours', () => {
    expect(isOver({ startsAt: at(-hours(1)), endsAt: null }, now)).toBe(false);
    expect(isOver({ startsAt: at(-hours(2)), endsAt: null }, now)).toBe(true);
  });
});
