// Enrollment Log utility functions — pure, side-effect-free, and testable.

export interface EnrollmentLog {
  id: string;
  agentId: string;
  agentName: string;
  month: number;       // 1–12
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
  month: number;
  year: number;
  totalEnrollment: number;
  adminUid: string;
}

export interface EnrollmentLogDocument {
  agentId: string;
  agentName: string;
  month: number;
  year: number;
  totalEnrollment: number;
  createdAt: string;
  createdBy: string;
}

export interface EnrollmentLogPatch {
  month: number;
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
    month: input.month,
    year: input.year,
    totalEnrollment: input.totalEnrollment,
    createdAt: new Date().toISOString(),
    createdBy: input.adminUid,
  };
}

/**
 * Build the patch object for updating an existing enrollment log entry.
 * Only includes the three mutable fields — never overwrites agentId, agentName,
 * createdAt, or createdBy.
 */
export function buildEnrollmentLogPatch(updates: {
  month: number;
  year: number;
  totalEnrollment: number;
}): EnrollmentLogPatch {
  return {
    month: updates.month,
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
 * Sort enrollment log entries by year descending, then month descending.
 * Returns a new array — does not mutate the input.
 */
export function sortEnrollmentLogs<T extends { year: number; month: number }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });
}
