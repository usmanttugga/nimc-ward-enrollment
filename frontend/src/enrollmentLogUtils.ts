// Enrollment Log utility functions — pure, side-effect-free, and testable.

export interface EnrollmentLog {
  id: string;
  agentId: string;
  agentName: string;
  startMonth: number;  // 1–12 (first month of the enrollment period)
  endMonth: number;    // 1–12, >= startMonth (last month of the enrollment period)
  year: number;
  totalEnrollment: number;
  createdAt: string;   // ISO 8601
  createdBy: string;   // Admin UID
}

export interface AgentForFilter {
  id: string;
  name: string;
  deviceId?: string;
}

export interface BuildLogDocumentInput {
  agentId: string;
  agentName: string;
  startMonth: number;
  endMonth: number;
  year: number;
  totalEnrollment: number;
  adminUid: string;
}

export interface EnrollmentLogDocument {
  agentId: string;
  agentName: string;
  startMonth: number;
  endMonth: number;
  year: number;
  totalEnrollment: number;
  createdAt: string;
  createdBy: string;
}

export interface EnrollmentLogPatch {
  startMonth: number;
  endMonth: number;
  year: number;
  totalEnrollment: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Filter agents by Device ID (case-insensitive substring match).
 * Returns all agents when searchTerm is empty.
 */
export function filterAgentsByDeviceId<T extends AgentForFilter>(
  agents: T[],
  searchTerm: string,
): T[] {
  if (!searchTerm) return agents;
  const lower = searchTerm.toLowerCase();
  return agents.filter(a => (a.deviceId ?? '').toLowerCase().includes(lower));
}

/**
 * Build the complete Firestore document payload for a new enrollment log entry.
 * Sets createdAt to the current ISO timestamp.
 */
export function buildEnrollmentLogDocument(
  input: BuildLogDocumentInput,
): EnrollmentLogDocument {
  return {
    agentId: input.agentId,
    agentName: input.agentName,
    startMonth: input.startMonth,
    endMonth: input.endMonth,
    year: input.year,
    totalEnrollment: input.totalEnrollment,
    createdAt: new Date().toISOString(),
    createdBy: input.adminUid,
  };
}

/**
 * Build the patch object for updating an existing enrollment log entry.
 * Only includes the four mutable fields — never overwrites agentId, agentName,
 * createdAt, or createdBy.
 */
export function buildEnrollmentLogPatch(updates: {
  startMonth: number;
  endMonth: number;
  year: number;
  totalEnrollment: number;
}): EnrollmentLogPatch {
  return {
    startMonth: updates.startMonth,
    endMonth: updates.endMonth,
    year: updates.year,
    totalEnrollment: updates.totalEnrollment,
  };
}

/**
 * Return the full English month name for a month integer (1–12).
 */
export function formatMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

/**
 * Format a month range as a human-readable string.
 *
 * Returns:
 *  - `""` for any invalid input: months outside 1–12, endMonth < startMonth,
 *    or year not a positive integer (0, negative, NaN, floats, etc.)
 *  - `"MonthName Year"` when startMonth === endMonth
 *  - `"StartName – EndName Year"` (en-dash U+2013) when startMonth < endMonth
 */
export function formatMonthRange(startMonth: number, endMonth: number, year: number): string {
  // Validate year: must be a positive integer
  if (!Number.isInteger(year) || year <= 0) return '';

  // Validate months: must be integers in 1–12
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) return '';
  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) return '';

  // endMonth must be >= startMonth
  if (endMonth < startMonth) return '';

  const startName = MONTH_NAMES[startMonth - 1];
  const endName = MONTH_NAMES[endMonth - 1];

  if (startMonth === endMonth) {
    return `${startName} ${year}`;
  }

  return `${startName} \u2013 ${endName} ${year}`;
}

/**
 * Sort enrollment log entries by year descending, then startMonth descending.
 * Returns a new array — does not mutate the input.
 */
export function sortEnrollmentLogs<T extends { year: number; startMonth: number }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.startMonth - a.startMonth;
  });
}
