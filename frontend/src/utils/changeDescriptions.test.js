import { describe, it, expect, vi } from 'vitest';
import { buildEditChangeDescription, buildForceCheckoutDescription, buildBulkForceCheckoutDescription } from './changeDescriptions';

// Mock hourCalculations
vi.mock('./hourCalculations', () => ({
  formatTime: (date) => {
    if (!date) return '--';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}));

describe('buildEditChangeDescription', () => {
  describe('smart delta logic', () => {
    it('should return empty string when no fields changed', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T08:00',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T12:00',
        reason: 'test reason'
      });

      expect(result).toBe('');
    });

    it('should include only check-in when only check-in changed', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T07:30',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T12:00',
        reason: 'arrived earlier'
      });

      expect(result).toContain('Changed Check-In');
      expect(result).not.toContain('Changed Check-Out');
      expect(result).toContain('. Reason: arrived earlier');
    });

    it('should include only check-out when only check-out changed', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T08:00',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T13:00',
        reason: 'stayed later'
      });

      expect(result).not.toContain('Changed Check-In');
      expect(result).toContain('Changed Check-Out');
      expect(result).toContain('. Reason: stayed later');
    });

    it('should include both when both changed', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T07:30',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T13:00',
        reason: 'schedule adjustment'
      });

      expect(result).toContain('Changed Check-In');
      expect(result).toContain('Changed Check-Out');
      expect(result).toContain(' and ');
      expect(result).toContain('. Reason: schedule adjustment');
    });
  });

  describe('reason formatting', () => {
    it('should use ". Reason:" instead of "for"', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T07:30',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T12:00',
        reason: 'test reason'
      });

      expect(result).toContain('. Reason: test reason');
      expect(result).not.toContain('for "');
    });

    it('should not include quotes around the reason', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T07:30',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T12:00',
        reason: 'test'
      });

      expect(result).not.toContain('"test"');
      expect(result).toContain('Reason: test');
    });

    it('should handle empty reason', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T07:30',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '2026-01-31T12:00',
        reason: ''
      });

      expect(result).not.toContain('Reason');
      expect(result).toContain('Changed Check-In');
    });
  });

  describe('handling none values', () => {
    it('should show "none" for missing original check-out', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T08:00',
        originalCheckOutTime: '',
        newCheckOutTime: '2026-01-31T12:00',
        reason: 'added checkout'
      });

      expect(result).toContain('from none to');
    });

    it('should show "none" for cleared check-out', () => {
      const result = buildEditChangeDescription({
        originalCheckInTime: '2026-01-31T08:00',
        newCheckInTime: '2026-01-31T08:00',
        originalCheckOutTime: '2026-01-31T12:00',
        newCheckOutTime: '',
        reason: 'cleared checkout'
      });

      expect(result).toContain('to none');
    });
  });
});

describe('buildForceCheckoutDescription', () => {
  it('should use new format with "Checked in:" and ". Reason:"', () => {
    const result = buildForceCheckoutDescription({
      checkOutTimeStr: '6:12 PM',
      checkInTimeStr: '12:09 PM',
      reason: 'test'
    });

    expect(result).toBe('Forced Check-Out at 6:12 PM (Checked in: 12:09 PM). Reason: test');
  });

  it('should not use "for" connector or quotes', () => {
    const result = buildForceCheckoutDescription({
      checkOutTimeStr: '6:12 PM',
      checkInTimeStr: '12:09 PM',
      reason: 'test'
    });

    expect(result).not.toContain('for "');
    expect(result).not.toContain('checked in at');
  });
});

describe('buildBulkForceCheckoutDescription', () => {
  it('should use new format with "Checked in:" and ". Reason:"', () => {
    const result = buildBulkForceCheckoutDescription({
      checkOutTimeStr: '3:00 PM',
      checkInTimeStr: '9:00 AM',
      reason: 'End of day'
    });

    expect(result).toBe('Bulk Forced Check-Out at 3:00 PM (Checked in: 9:00 AM). Reason: End of day');
  });

  it('should not use "for" connector or quotes', () => {
    const result = buildBulkForceCheckoutDescription({
      checkOutTimeStr: '3:00 PM',
      checkInTimeStr: '9:00 AM',
      reason: 'End of day'
    });

    expect(result).not.toContain('for "');
    expect(result).not.toContain('checked in at');
  });
});
