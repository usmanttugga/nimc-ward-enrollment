// Personalization Record utility functions — pure, side-effect-free, and testable.

export interface PersonalizationRecord {
  id: string;
  agentId: string;
  agentName: string;
  personalizationDate: string; // YYYY-MM-DD
  count: number;               // 0–9999 (agent) / 0–999999 (admin edit)
  submittedAt: string;         // ISO 8601
}

export interface BuildPersonalizationDocumentInput {
  agentId: string;
  agentName: string;
  personalizationDate: string;
  count: number;
}

export interface PersonalizationDocument {
  agentId: string;
  agentName: string;
  personalizationDate: string;
  count: number;
  submittedAt: string;
}

export interface PersonalizationPatch {
  personalizationDate: string;
  count: number;
}

/**
 * Build the complete Firestore document payload for a new personalization record.
 * Sets submittedAt to the current ISO timestamp.
 */
export function buildPersonalizationDocument(
  input: BuildPersonalizationDocumentInput,
): PersonalizationDocument {
  return {
    agentId: input.agentId,
    agentName: input.agentName,
    personalizationDate: input.personalizationDate,
    count: input.count,
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Build the patch object for updating an existing personalization record.
 * Only includes the two mutable fields — never overwrites agentId, agentName,
 * or submittedAt.
 */
export function buildPersonalizationPatch(updates: {
  personalizationDate: string;
  count: number;
}): PersonalizationPatch {
  return {
    personalizationDate: updates.personalizationDate,
    count: updates.count,
  };
}

/**
 * Validate that a string represents a real YYYY-MM-DD calendar date.
 *
 * Returns:
 *  - `false` for any string that does not match the pattern YYYY-MM-DD
 *  - `false` for strings that match the pattern but are invalid calendar dates
 *    (e.g. "2024-02-30", "2023-13-01")
 *  - `true` only when the string matches the pattern AND represents a valid date
 */
export function validatePersonalizationDate(date: string): boolean {
  // Regex check: must be exactly YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // Construct a Date and verify the parsed components match the input.
  // Using month - 1 because Date months are 0-indexed.
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Validate that a count is an integer in [0, maxCount].
 * Defaults to maxCount = 9999 (agent limit) when not provided.
 * Returns false for non-integers, NaN, negative values, or values above maxCount.
 */
export function validatePersonalizationCount(count: number, maxCount = 9999): boolean {
  return Number.isInteger(count) && count >= 0 && count <= maxCount;
}

/**
 * Sort personalization records by personalizationDate descending.
 * Returns a new array — does not mutate the input.
 */
export function sortPersonalizationRecords<T extends { personalizationDate: string }>(
  records: T[],
): T[] {
  return [...records].sort((a, b) =>
    b.personalizationDate.localeCompare(a.personalizationDate),
  );
}

/**
 * Compute the arithmetic sum of all count fields in the records array.
 * Returns 0 for an empty array.
 */
export function computeGrandTotal(records: Array<{ count: number }>): number {
  return records.reduce((sum, r) => sum + r.count, 0);
}

/**
 * Check whether a candidate date string already exists in a set of existing dates.
 * Returns true iff candidate is present in existingDates (used for duplicate-date detection).
 */
export function isDateAlreadyPresent(existingDates: string[], candidate: string): boolean {
  return existingDates.includes(candidate);
}

export interface AgentPersonalizationSummary {
  agentId: string;
  agentName: string;
  totalCount: number;
  recordCount: number;
  earliestDate: string;
  latestDate: string;
  dateRange: string;
}

/**
 * Group personalization records by agentId and calculate each agent's total count.
 * Returns an array of AgentPersonalizationSummary sorted descending by totalCount.
 */
export function computeAgentPersonalizationSummaries(
  records: Array<{ agentId: string; agentName: string; count: number; personalizationDate: string }>
): AgentPersonalizationSummary[] {
  const summaryMap: Record<string, AgentPersonalizationSummary> = {};

  for (const r of records) {
    if (!summaryMap[r.agentId]) {
      summaryMap[r.agentId] = {
        agentId: r.agentId,
        agentName: r.agentName,
        totalCount: 0,
        recordCount: 0,
        earliestDate: r.personalizationDate,
        latestDate: r.personalizationDate,
        dateRange: `${r.personalizationDate} to ${r.personalizationDate}`,
      };
    }
    summaryMap[r.agentId].totalCount += r.count;
    summaryMap[r.agentId].recordCount += 1;
    if (r.personalizationDate < summaryMap[r.agentId].earliestDate) {
      summaryMap[r.agentId].earliestDate = r.personalizationDate;
    }
    if (r.personalizationDate > summaryMap[r.agentId].latestDate) {
      summaryMap[r.agentId].latestDate = r.personalizationDate;
    }
    summaryMap[r.agentId].dateRange = `${summaryMap[r.agentId].earliestDate} to ${summaryMap[r.agentId].latestDate}`;
  }

  return Object.values(summaryMap).sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * Calculate a lookup map of agentId -> total count.
 */
export function computeTotalsByAgentId(
  records: Array<{ agentId: string; count: number }>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of records) {
    totals[r.agentId] = (totals[r.agentId] || 0) + r.count;
  }
  return totals;
}

