// Aggregator Portal utility functions — pure, side-effect-free, and testable.
// No Firebase imports; all functions operate on plain data.

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Firestore document shape for a user with role AGGREGATOR. */
export interface AggregatorUser {
  id: string;             // Firebase UID
  name: string;
  email: string;
  role: 'AGGREGATOR';
  aggregatorId: string;   // Formatted ID, e.g. "2PLUS/AGG/ENR/001"
  phone: string;
  profileStateId: string;
  profileStateName: string;
  profileLgaId: string;
  profileLgaName: string;
  createdAt: string;      // ISO 8601
}

/** Firestore document shape for a user with role AGENT. */
export interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: 'AGENT';
  deviceId: string;
  phone: string;
  profileStateId: string;
  profileStateName: string;
  profileLgaId: string;
  profileLgaName: string;
  createdAt: string;      // ISO 8601
  /** Firebase UID of the supervising aggregator, or absent/null if unlinked. */
  aggregatorId?: string | null;
}

/** Shape of the `counters/aggregatorId` Firestore document. */
export interface AggregatorIdCounter {
  lastSequence: number; // Last issued sequence number; starts at 0
}

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

/**
 * Format a sequential integer into the canonical Aggregator ID string.
 *
 * @param sequence - A positive integer sequence number.
 * @returns A string of the form `2PLUS/AGG/ENR/NNN` where NNN is the
 *   sequence number zero-padded to at least three digits.
 *
 * @example
 * formatAggregatorId(1)   // "2PLUS/AGG/ENR/001"
 * formatAggregatorId(99)  // "2PLUS/AGG/ENR/099"
 * formatAggregatorId(100) // "2PLUS/AGG/ENR/100"
 */
export function formatAggregatorId(sequence: number): string {
  return `2PLUS/AGG/ENR/${String(sequence).padStart(3, '0')}`;
}

/**
 * Split an array into consecutive chunks of at most `size` elements.
 * The last chunk may be smaller than `size` if the array length is not
 * evenly divisible.
 *
 * @param arr  - The source array to split.
 * @param size - Maximum number of elements per chunk (must be > 0).
 * @returns An array of sub-arrays (chunks).
 *
 * @example
 * chunkArray([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 * chunkArray([1, 2, 3], 10)       // [[1, 2, 3]]
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Filter enrollment records to only those whose `agentId` is present in
 * the provided set of linked agent UIDs.
 *
 * Uses a `Set` for O(1) membership lookup so the overall operation is O(n)
 * in the number of records.
 *
 * @param records    - Enrollment records, each carrying an `agentId` field.
 * @param linkedUids - Array of agent UIDs that belong to the aggregator.
 * @returns A new array containing only the records whose `agentId` is in
 *   `linkedUids`.
 */
export function scopeEnrollmentsByAgentUids<T extends { agentId: string }>(
  records: T[],
  linkedUids: string[],
): T[] {
  const uidSet = new Set(linkedUids);
  return records.filter(r => uidSet.has(r.agentId));
}

/**
 * Return the subset of agents that are not yet linked to any aggregator and
 * whose name, email, or Device ID contains `searchTerm` as a
 * case-insensitive substring.
 *
 * An agent is considered unlinked when its `aggregatorId` field is absent,
 * `null`, or an empty string.
 *
 * If `searchTerm` is empty or contains only whitespace, all unlinked agents
 * are returned without further filtering.
 *
 * @param agents     - Full list of agent user documents.
 * @param searchTerm - Free-text search string entered by the user.
 * @returns Filtered array of unlinked agents matching the search term.
 */
export function filterUnlinkedAgents(
  agents: AgentUser[],
  searchTerm: string,
): AgentUser[] {
  const unlinked = agents.filter(a => !a.aggregatorId);
  if (!searchTerm.trim()) return unlinked;
  const lower = searchTerm.toLowerCase();
  return unlinked.filter(
    a =>
      a.name.toLowerCase().includes(lower) ||
      a.email.toLowerCase().includes(lower) ||
      (a.deviceId ?? '').toLowerCase().includes(lower),
  );
}

/**
 * Validate the agent creation form fields.
 *
 * Each field is checked in order; the first empty or whitespace-only value
 * causes an immediate return with a descriptive error message. Returns
 * `null` when all fields are non-empty.
 *
 * @param fields - Object containing all required form field values.
 * @returns An error string describing the first invalid field, or `null`
 *   if all fields are valid.
 */
export function validateAgentForm(fields: {
  name: string;
  email: string;
  password: string;
  deviceId: string;
  phone: string;
  stateId: string;
  lgaId: string;
}): string | null {
  if (!fields.name.trim())     return 'Name is required.';
  if (!fields.email.trim())    return 'Email is required.';
  if (!fields.password.trim()) return 'Password is required.';
  if (!fields.deviceId.trim()) return 'Device ID is required.';
  if (!fields.phone.trim())    return 'Phone is required.';
  if (!fields.stateId.trim())  return 'State is required.';
  if (!fields.lgaId.trim())    return 'LGA is required.';
  return null;
}

/**
 * Compute the total enrollment figure across a list of enrollment records.
 *
 * @param records - Array of objects each containing a `dailyFigures` number.
 * @returns The arithmetic sum of all `dailyFigures` values. Returns `0` for
 *   an empty array.
 */
export function computeEnrollmentTotal(
  records: { dailyFigures: number }[],
): number {
  return records.reduce((sum, r) => sum + r.dailyFigures, 0);
}

/**
 * Compute the new LGA list and reset the selected LGA ID when the state changes.
 * Returns the LGAs belonging to the new state and clears the previously selected LGA.
 *
 * @param geoData - Full list of states with their LGAs.
 * @param newStateId - The ID of the newly selected state.
 * @returns An object with the new LGA list and a cleared lgaId.
 */
export function computeLgaReset(
  geoData: { id: string; name: string; lgas: { id: string; name: string }[] }[],
  newStateId: string,
): { lgas: { id: string; name: string }[]; lgaId: string } {
  const state = geoData.find(s => s.id === newStateId);
  return {
    lgas: state?.lgas ?? [],
    lgaId: '',
  };
}
