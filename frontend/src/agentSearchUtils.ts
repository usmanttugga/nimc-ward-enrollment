// Agent search utility functions — pure, side-effect-free, and testable.
//
// Used by the Admin portal so every tab can search agents the same way:
// by name, email, Device ID, DROID No. (and phone, where available).

export interface AgentSearchable {
  name?: string | null;
  email?: string | null;
  deviceId?: string | null;
  deviceDroidNumber?: string | null;
  phone?: string | null;
}

/** Trim + lowercase a raw search input. Never returns null/undefined. */
export function normalizeQuery(query: string | null | undefined): string {
  return (query ?? '').trim().toLowerCase();
}

/**
 * Case-insensitive substring match of `query` against any of `values`.
 * An empty/whitespace-only query matches everything.
 * Null/undefined values are treated as empty strings (never throw).
 */
export function matchesQuery(
  query: string | null | undefined,
  ...values: Array<string | null | undefined>
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  return values.some(v => (v ?? '').toLowerCase().includes(q));
}

/**
 * The searchable identity fields of an agent, in display order:
 * name, email, Device ID, DROID No., phone.
 */
export function agentSearchFields(agent: AgentSearchable): Array<string | null | undefined> {
  return [agent.name, agent.email, agent.deviceId, agent.deviceDroidNumber, agent.phone];
}

/**
 * Filter agents by name, email, Device ID, DROID No. or phone
 * (case-insensitive substring match). Returns all agents for an empty query.
 */
export function filterAgentsByQuery<T extends AgentSearchable>(
  agents: T[],
  query: string | null | undefined,
): T[] {
  const q = normalizeQuery(query);
  if (!q) return agents;
  return agents.filter(a => agentSearchFields(a).some(v => (v ?? '').toLowerCase().includes(q)));
}

/**
 * Match a record that only carries an agent reference (agentId / agentName /
 * agentEmail) against a query, using the loaded agents list for the fields the
 * record does not store (email, Device ID, DROID No., phone).
 *
 * Returns true when the query matches either the record's own fields or the
 * resolved agent's identity fields. Empty query always matches.
 */
export function matchesRecordWithAgents(
  query: string | null | undefined,
  record: { agentName?: string | null; agentEmail?: string | null; agentId?: string | null },
  agentsById: Map<string, AgentSearchable>,
  agentsByEmail?: Map<string, AgentSearchable>,
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;

  const agent =
    (record.agentId ? agentsById.get(record.agentId) : undefined) ??
    (record.agentEmail ? agentsByEmail?.get(record.agentEmail.toLowerCase()) : undefined);

  return matchesQuery(
    q,
    record.agentName,
    record.agentEmail,
    agent?.name,
    agent?.email,
    agent?.deviceId,
    agent?.deviceDroidNumber,
    agent?.phone,
  );
}
