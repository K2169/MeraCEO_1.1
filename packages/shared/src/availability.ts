import type { DAYS } from './enums';

export type AvailabilityDay = (typeof DAYS)[number];
export interface WeeklyAvailabilityWindow {
  day: AvailabilityDay;
  startTime: string;
  endTime: string;
}
export interface AvailableSlot {
  time: string;
  startsAt: string;
}

const DAY_BY_WEEKDAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const HALF_HOUR_MINUTES = 30;

function dateParts(dateKey: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function formatter(timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
}

function formattedParts(date: Date, timezone: string) {
  const parts = formatter(timezone).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(value('year'));
  const month = Number(value('month'));
  const day = Number(value('day'));
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  const second = Number(value('second'));
  const weekday = value('weekday')?.toLowerCase().slice(0, 3) as AvailabilityDay | undefined;
  if (![year, month, day, hour, minute, second].every(Number.isFinite) || !weekday) return null;
  return { year, month, day, hour, minute, second, weekday };
}

function dateKeyOf(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function localDateKey(now: Date, timezone: string): string | null {
  if (!validTimezone(timezone)) return null;
  const parts = formattedParts(now, timezone);
  return parts ? dateKeyOf(parts) : null;
}

export function addDateKey(dateKey: string, days: number): string | null {
  const parts = dateParts(dateKey);
  if (!parts || !Number.isInteger(days)) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateKeyOf({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

function weekdayForDateKey(dateKey: string): AvailabilityDay | null {
  const parts = dateParts(dateKey);
  if (!parts) return null;
  return DAY_BY_WEEKDAY[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()] ?? null;
}

function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function timeText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// Convert a professional's wall-clock time to an instant. The round-trip check rejects
// nonexistent local times during a daylight-saving jump.
export function zonedTimeToIso(dateKey: string, time: string, timezone: string): string | null {
  const date = dateParts(dateKey);
  const minutes = parseTime(time);
  if (!date || minutes === null || !validTimezone(timezone)) return null;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const target = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let instant = target;
  try {
    const zoneFormatter = formatter(timezone);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = zoneFormatter.formatToParts(new Date(instant));
      const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
      const shownAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
      const correction = target - shownAsUtc;
      if (correction === 0) break;
      instant += correction;
    }
    const final = zoneFormatter.formatToParts(new Date(instant));
    const finalValue = (type: Intl.DateTimeFormatPartTypes) => Number(final.find((part) => part.type === type)?.value);
    if (
      finalValue('year') !== date.year || finalValue('month') !== date.month || finalValue('day') !== date.day
      || finalValue('hour') !== hour || finalValue('minute') !== minute
    ) return null;
  } catch {
    return null;
  }
  return new Date(instant).toISOString();
}

export function slotsForDate(
  dateKey: string,
  timezone: string,
  durationMinutes: number,
  windows: readonly WeeklyAvailabilityWindow[],
  now = new Date(),
): AvailableSlot[] {
  const weekday = weekdayForDateKey(dateKey);
  if (!weekday || !validTimezone(timezone) || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return [];
  const result: AvailableSlot[] = [];
  for (const window of windows) {
    if (window.day !== weekday) continue;
    const start = parseTime(window.startTime);
    const end = parseTime(window.endTime);
    if (start === null || end === null || end <= start) continue;
    for (let time = Math.ceil(start / HALF_HOUR_MINUTES) * HALF_HOUR_MINUTES; time + durationMinutes <= end; time += HALF_HOUR_MINUTES) {
      const text = timeText(time);
      const startsAt = zonedTimeToIso(dateKey, text, timezone);
      if (startsAt && new Date(startsAt).getTime() > now.getTime()) result.push({ time: text, startsAt });
    }
  }
  return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function datesWithAvailability(
  now: Date,
  timezone: string,
  durationMinutes: number | null,
  windows: readonly WeeklyAvailabilityWindow[],
  daysAhead = 14,
): string[] {
  if (!durationMinutes || !validTimezone(timezone) || !Number.isInteger(daysAhead) || daysAhead <= 0) return [];
  const today = localDateKey(now, timezone);
  if (!today) return [];
  const available: string[] = [];
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const dateKey = addDateKey(today, offset);
    if (dateKey && slotsForDate(dateKey, timezone, durationMinutes, windows, now).length > 0) available.push(dateKey);
  }
  return available;
}

// Server-side guard for a manually submitted start time. It uses the same local-clock
// interpretation as the picker and requires the entire consultation to fit in one window.
export function isWithinAvailability(
  startsAt: Date,
  timezone: string,
  durationMinutes: number | null,
  windows: readonly WeeklyAvailabilityWindow[],
): boolean {
  if (!Number.isFinite(startsAt.getTime()) || !durationMinutes || !validTimezone(timezone)) return false;
  const start = formattedParts(startsAt, timezone);
  const end = formattedParts(new Date(startsAt.getTime() + durationMinutes * 60_000), timezone);
  if (!start || !end || start.second !== 0 || start.minute % 30 !== 0 || dateKeyOf(start) !== dateKeyOf(end)) return false;
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;
  return windows.some((window) => {
    const windowStart = parseTime(window.startTime);
    const windowEnd = parseTime(window.endTime);
    return window.day === start.weekday && windowStart !== null && windowEnd !== null
      && startMinute >= windowStart && endMinute <= windowEnd;
  });
}
