import { describe, it, expect } from 'vitest';
import {
  formatMonthRange,
  buildEnrollmentLogDocument,
  buildEnrollmentLogPatch,
  sortEnrollmentLogs,
} from './enrollmentLogUtils';

// ─── formatMonthRange ────────────────────────────────────────────────────────

describe('formatMonthRange', () => {
  it('returns "January 2026" when startMonth === endMonth === 1', () => {
    expect(formatMonthRange(1, 1, 2026)).toBe('January 2026');
  });

  it('returns "January \u2013 March 2026" for a multi-month range', () => {
    expect(formatMonthRange(1, 3, 2026)).toBe('January \u2013 March 2026');
  });

  it('returns "December 2025" when startMonth === endMonth === 12', () => {
    expect(formatMonthRange(12, 12, 2025)).toBe('December 2025');
  });

  it('returns "June \u2013 November 2024" for a mid-year range', () => {
    expect(formatMonthRange(6, 11, 2024)).toBe('June \u2013 November 2024');
  });

  it('returns "" when startMonth is 0 (out of range)', () => {
    expect(formatMonthRange(0, 1, 2026)).toBe('');
  });

  it('returns "" when endMonth is 13 (out of range)', () => {
    expect(formatMonthRange(1, 13, 2026)).toBe('');
  });

  it('returns "" when endMonth < startMonth', () => {
    expect(formatMonthRange(3, 1, 2026)).toBe('');
  });

  it('returns "" when year is 0 (invalid)', () => {
    expect(formatMonthRange(1, 1, 0)).toBe('');
  });
});

// ─── buildEnrollmentLogDocument ─────────────────────────────────────────────

describe('buildEnrollmentLogDocument', () => {
  it('returns a document with all required fields and no "month" field', () => {
    const input = {
      agentId: 'agent-001',
      agentName: 'Test Agent',
      startMonth: 2,
      endMonth: 5,
      year: 2025,
      totalEnrollment: 42,
      adminUid: 'admin-uid-999',
    };

    const result = buildEnrollmentLogDocument(input);

    // Required fields present with correct values
    expect(result.startMonth).toBe(2);
    expect(result.endMonth).toBe(5);
    expect(result.year).toBe(2025);
    expect(result.totalEnrollment).toBe(42);
    expect(result.agentId).toBe('agent-001');
    expect(result.agentName).toBe('Test Agent');
    expect(result.createdBy).toBe('admin-uid-999');

    // createdAt must be a valid ISO date string
    expect(isNaN(new Date(result.createdAt).getTime())).toBe(false);

    // Legacy "month" field must NOT be present
    expect('month' in result).toBe(false);
  });
});

// ─── buildEnrollmentLogPatch ─────────────────────────────────────────────────

describe('buildEnrollmentLogPatch', () => {
  it('returns exactly { startMonth, endMonth, year, totalEnrollment } — no extra keys', () => {
    const result = buildEnrollmentLogPatch({
      startMonth: 3,
      endMonth: 7,
      year: 2024,
      totalEnrollment: 100,
    });

    expect(Object.keys(result).sort()).toEqual(
      ['endMonth', 'startMonth', 'totalEnrollment', 'year'],
    );

    expect(result.startMonth).toBe(3);
    expect(result.endMonth).toBe(7);
    expect(result.year).toBe(2024);
    expect(result.totalEnrollment).toBe(100);
  });
});

// ─── sortEnrollmentLogs ──────────────────────────────────────────────────────

describe('sortEnrollmentLogs', () => {
  it('does not mutate the input array', () => {
    const input = [
      { id: '1', agentId: 'a', agentName: 'A', startMonth: 1, endMonth: 1, year: 2024, totalEnrollment: 10, createdAt: '', createdBy: '' },
      { id: '2', agentId: 'b', agentName: 'B', startMonth: 6, endMonth: 6, year: 2025, totalEnrollment: 20, createdAt: '', createdBy: '' },
    ];
    const originalRef = input;
    const originalSnapshot = [...input];

    sortEnrollmentLogs(input);

    // Same reference (input not reassigned)
    expect(input).toBe(originalRef);
    // Same contents in same order (not mutated)
    expect(input).toEqual(originalSnapshot);
  });

  it('sorts by year descending, then startMonth descending', () => {
    const entries = [
      { id: '1', agentId: 'a', agentName: 'A', startMonth: 3, endMonth: 3, year: 2023, totalEnrollment: 0, createdAt: '', createdBy: '' },
      { id: '2', agentId: 'b', agentName: 'B', startMonth: 1, endMonth: 1, year: 2025, totalEnrollment: 0, createdAt: '', createdBy: '' },
      { id: '3', agentId: 'c', agentName: 'C', startMonth: 8, endMonth: 8, year: 2025, totalEnrollment: 0, createdAt: '', createdBy: '' },
      { id: '4', agentId: 'd', agentName: 'D', startMonth: 5, endMonth: 5, year: 2024, totalEnrollment: 0, createdAt: '', createdBy: '' },
      { id: '5', agentId: 'e', agentName: 'E', startMonth: 2, endMonth: 2, year: 2025, totalEnrollment: 0, createdAt: '', createdBy: '' },
    ];

    const sorted = sortEnrollmentLogs(entries);

    // Expected order: 2025/8, 2025/2, 2025/1, 2024/5, 2023/3
    expect(sorted.map(e => `${e.year}/${e.startMonth}`)).toEqual([
      '2025/8',
      '2025/2',
      '2025/1',
      '2024/5',
      '2023/3',
    ]);
  });
});
