import { describe, expect, it } from 'vitest';

import { datesWithAvailability, isWithinAvailability, slotsForDate, zonedTimeToIso } from '../src/availability';

const mondayWindow = [{ day: 'mon' as const, startTime: '09:00', endTime: '12:00' }];

describe('professional availability', () => {
  it('creates only half-hour starts that fit the saved window and consultation duration', () => {
    const slots = slotsForDate(
      '2026-11-16',
      'Asia/Kolkata',
      60,
      mondayWindow,
      new Date('2026-11-16T03:45:00.000Z'),
    );
    expect(slots.map((slot) => slot.time)).toEqual(['09:30', '10:00', '10:30', '11:00']);
    expect(slots[0]?.startsAt).toBe('2026-11-16T04:00:00.000Z');
  });

  it('uses the professional time zone to find dates with bookable availability', () => {
    const dates = datesWithAvailability(
      new Date('2026-11-16T06:15:00.000Z'),
      'Asia/Kolkata',
      60,
      mondayWindow,
      8,
    );
    expect(dates).toEqual(['2026-11-23']);
  });

  it('converts professional wall-clock time to the matching UTC instant', () => {
    expect(zonedTimeToIso('2026-11-16', '09:00', 'Asia/Kolkata')).toBe('2026-11-16T03:30:00.000Z');
  });

  it('does not offer nonexistent wall-clock times during a daylight-saving jump', () => {
    expect(zonedTimeToIso('2026-03-08', '02:30', 'America/New_York')).toBeNull();
  });

  it('validates the full duration against the saved local window', () => {
    expect(isWithinAvailability(new Date('2026-11-16T03:30:00.000Z'), 'Asia/Kolkata', 60, mondayWindow)).toBe(true);
    expect(isWithinAvailability(new Date('2026-11-16T03:40:00.000Z'), 'Asia/Kolkata', 60, mondayWindow)).toBe(false);
    expect(isWithinAvailability(new Date('2026-11-16T06:00:00.000Z'), 'Asia/Kolkata', 60, mondayWindow)).toBe(false);
    expect(isWithinAvailability(new Date('2026-11-17T03:30:00.000Z'), 'Asia/Kolkata', 60, mondayWindow)).toBe(false);
  });
});
