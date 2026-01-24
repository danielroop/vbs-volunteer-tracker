import { describe, it, expect } from 'vitest';
import {
  calculateHours,
  isEarlyArrival,
  isLateStay,
  getTimeEntryFlags,
  formatHours,
  formatTime,
  formatDate,
  getTodayDateString,
} from './hourCalculations';

describe('hourCalculations', () => {
  describe('calculateHours', () => {
    it('should calculate hours correctly for a standard workday', () => {
      const checkIn = new Date('2026-06-15T09:00:00');
      const checkOut = new Date('2026-06-15T15:00:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.minutes).toBe(360); // 6 hours * 60
      expect(result.raw).toBe(6);
      expect(result.rounded).toBe(6);
    });

    it('should round down for 0-14 minutes (6h 13m -> 6.0)', () => {
      const checkIn = new Date('2026-06-15T09:02:00');
      const checkOut = new Date('2026-06-15T15:15:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.minutes).toBe(373); // 6h 13m
      expect(result.rounded).toBe(6.0);
    });

    it('should round to 0.5 for 15-44 minutes (6h 16m -> 6.5)', () => {
      const checkIn = new Date('2026-06-15T09:02:00');
      const checkOut = new Date('2026-06-15T15:18:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.minutes).toBe(376); // 6h 16m
      expect(result.rounded).toBe(6.5);
    });

    it('should round up for 45-59 minutes (6h 47m -> 7.0)', () => {
      const checkIn = new Date('2026-06-15T09:00:00');
      const checkOut = new Date('2026-06-15T15:47:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.minutes).toBe(407); // 6h 47m
      expect(result.rounded).toBe(7.0);
    });

    it('should handle 7h 30m -> 7.5 hours', () => {
      const checkIn = new Date('2026-06-15T08:45:00');
      const checkOut = new Date('2026-06-15T16:15:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.minutes).toBe(450); // 7h 30m
      expect(result.rounded).toBe(7.5);
    });

    it('should handle short durations', () => {
      const checkIn = new Date('2026-06-15T09:00:00');
      const checkOut = new Date('2026-06-15T09:30:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.minutes).toBe(30);
      expect(result.rounded).toBe(0.5);
    });

    it('should handle exact half hour boundaries', () => {
      const checkIn = new Date('2026-06-15T09:00:00');
      const checkOut = new Date('2026-06-15T15:30:00');
      const result = calculateHours(checkIn, checkOut);

      expect(result.rounded).toBe(6.5);
    });
  });

  describe('isEarlyArrival', () => {
    it('should return true for arrival >15 min before typical start', () => {
      const checkIn = new Date('2026-06-15T08:44:00');
      expect(isEarlyArrival(checkIn, '09:00')).toBe(true);
    });

    it('should return false for arrival exactly 15 min before start', () => {
      const checkIn = new Date('2026-06-15T08:45:00');
      expect(isEarlyArrival(checkIn, '09:00')).toBe(false);
    });

    it('should return false for arrival within 15 min of start', () => {
      const checkIn = new Date('2026-06-15T08:50:00');
      expect(isEarlyArrival(checkIn, '09:00')).toBe(false);
    });

    it('should return false for arrival at or after typical start', () => {
      const checkIn = new Date('2026-06-15T09:05:00');
      expect(isEarlyArrival(checkIn, '09:00')).toBe(false);
    });

    it('should handle different typical start times', () => {
      const checkIn = new Date('2026-06-15T07:40:00');
      expect(isEarlyArrival(checkIn, '08:00')).toBe(true);
    });
  });

  describe('isLateStay', () => {
    it('should return true for departure clearly after typical end + 15 min', () => {
      // 15:30 is 30 minutes after 15:00, clearly > 15 min
      const checkOut = new Date('2026-06-15T15:30:00');
      expect(isLateStay(checkOut, '15:00')).toBe(true);
    });

    it('should return true for departure 1 hour after end', () => {
      const checkOut = new Date('2026-06-15T16:00:00');
      expect(isLateStay(checkOut, '15:00')).toBe(true);
    });

    it('should return false for departure within 15 min of end', () => {
      const checkOut = new Date('2026-06-15T15:10:00');
      expect(isLateStay(checkOut, '15:00')).toBe(false);
    });

    it('should return false for departure at or before typical end', () => {
      const checkOut = new Date('2026-06-15T14:55:00');
      expect(isLateStay(checkOut, '15:00')).toBe(false);
    });
  });

  describe('getTimeEntryFlags', () => {
    it('should return early_arrival flag for early check-in', () => {
      const checkIn = new Date('2026-06-15T08:30:00');
      const checkOut = new Date('2026-06-15T15:00:00');
      const flags = getTimeEntryFlags(checkIn, checkOut, '09:00', '15:00');

      expect(flags).toContain('early_arrival');
      expect(flags).not.toContain('late_stay');
    });

    it('should return late_stay flag for late check-out', () => {
      const checkIn = new Date('2026-06-15T09:00:00');
      // 15:30 is clearly > 15 min after 15:00 typical end
      const checkOut = new Date('2026-06-15T15:30:00');
      const flags = getTimeEntryFlags(checkIn, checkOut, '09:00', '15:00');

      expect(flags).not.toContain('early_arrival');
      expect(flags).toContain('late_stay');
    });

    it('should return both flags for early arrival and late stay', () => {
      const checkIn = new Date('2026-06-15T08:30:00');
      // 15:30 is clearly > 15 min after 15:00 typical end
      const checkOut = new Date('2026-06-15T15:30:00');
      const flags = getTimeEntryFlags(checkIn, checkOut, '09:00', '15:00');

      expect(flags).toContain('early_arrival');
      expect(flags).toContain('late_stay');
    });

    it('should return empty array for normal hours', () => {
      const checkIn = new Date('2026-06-15T09:00:00');
      const checkOut = new Date('2026-06-15T15:00:00');
      const flags = getTimeEntryFlags(checkIn, checkOut, '09:00', '15:00');

      expect(flags).toHaveLength(0);
    });

    it('should handle null checkOutTime', () => {
      const checkIn = new Date('2026-06-15T08:30:00');
      const flags = getTimeEntryFlags(checkIn, null, '09:00', '15:00');

      expect(flags).toContain('early_arrival');
      expect(flags).not.toContain('late_stay');
    });
  });

  describe('formatHours', () => {
    it('should format hours with decimal', () => {
      expect(formatHours(6.5)).toBe('6.5 hours');
    });

    it('should use singular "hour" for 1 hour', () => {
      expect(formatHours(1)).toBe('1.0 hour');
    });

    it('should handle whole numbers', () => {
      expect(formatHours(7)).toBe('7.0 hours');
    });

    it('should return "--" for null', () => {
      expect(formatHours(null)).toBe('--');
    });

    it('should return "--" for undefined', () => {
      expect(formatHours(undefined)).toBe('--');
    });

    it('should handle zero hours', () => {
      expect(formatHours(0)).toBe('0.0 hours');
    });
  });

  describe('formatTime', () => {
    it('should format time in 12-hour format', () => {
      const time = new Date('2026-06-15T14:30:00');
      expect(formatTime(time)).toBe('2:30 PM');
    });

    it('should format morning time', () => {
      const time = new Date('2026-06-15T09:05:00');
      expect(formatTime(time)).toBe('9:05 AM');
    });

    it('should return "--" for null', () => {
      expect(formatTime(null)).toBe('--');
    });

    it('should return "--" for undefined', () => {
      expect(formatTime(undefined)).toBe('--');
    });
  });

  describe('formatDate', () => {
    it('should format date object', () => {
      // Use explicit time to avoid timezone issues
      const date = new Date('2026-06-15T12:00:00');
      expect(formatDate(date)).toBe('Monday, June 15, 2026');
    });

    it('should format date string with time', () => {
      // Use explicit time to avoid timezone issues
      expect(formatDate('2026-06-15T12:00:00')).toBe('Monday, June 15, 2026');
    });

    it('should return formatted date string pattern', () => {
      // Test the format pattern rather than exact date
      const result = formatDate(new Date());
      expect(result).toMatch(/^\w+, \w+ \d{1,2}, \d{4}$/);
    });
  });

  describe('getTodayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getTodayDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
