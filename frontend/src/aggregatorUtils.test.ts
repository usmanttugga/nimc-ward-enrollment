/**
 * Tests for aggregatorUtils.ts
 *
 * Includes unit tests (task 2.1) and property-based tests (tasks 2.2–2.8)
 * using fast-check.
 *
 * Run with: npm test (from the frontend/ directory)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  formatAggregatorId,
  chunkArray,
  scopeEnrollmentsByAgentUids,
  filterUnlinkedAgents,
  validateAgentForm,
  computeEnrollmentTotal,
  computeLgaReset,
} from './aggregatorUtils';
import type { AgentUser } from './aggregatorUtils';

// ---------------------------------------------------------------------------
// Task 2.1 — Unit tests for formatAggregatorId
// ---------------------------------------------------------------------------

describe('formatAggregatorId — unit tests', () => {
  it('formats sequence 1 as 2PLUS/AGG/ENR/001', () => {
    expect(formatAggregatorId(1)).toBe('2PLUS/AGG/ENR/001');
  });

  it('formats sequence 99 as 2PLUS/AGG/ENR/099', () => {
    expect(formatAggregatorId(99)).toBe('2PLUS/AGG/ENR/099');
  });

  it('formats sequence 100 as 2PLUS/AGG/ENR/100', () => {
    expect(formatAggregatorId(100)).toBe('2PLUS/AGG/ENR/100');
  });

  it('formats sequence 999 as 2PLUS/AGG/ENR/999', () => {
    expect(formatAggregatorId(999)).toBe('2PLUS/AGG/ENR/999');
  });
});

// ---------------------------------------------------------------------------
// Task 2.2 — Property 1: Aggregator ID format is always correct
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------

describe('Property 1: Aggregator ID format is always correct', () => {
  it('starts with 2PLUS/AGG/ENR/ and suffix is n zero-padded to at least 3 digits', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), (n) => {
        const id = formatAggregatorId(n);
        const prefix = '2PLUS/AGG/ENR/';
        expect(id.startsWith(prefix)).toBe(true);
        const suffix = id.slice(prefix.length);
        // Suffix must be at least 3 characters (zero-padded)
        expect(suffix.length).toBeGreaterThanOrEqual(3);
        // Suffix must represent the number n
        expect(parseInt(suffix, 10)).toBe(n);
        // Suffix must consist only of digits
        expect(/^\d+$/.test(suffix)).toBe(true);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.3 — Property 2: Aggregator ID sequence numbers are unique
// Validates: Requirements 1.2, 1.3
// ---------------------------------------------------------------------------

describe('Property 2: Aggregator ID sequence numbers are unique', () => {
  it('distinct inputs produce distinct IDs', () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 9999 }))
          .filter(([a, b]) => a !== b),
        ([a, b]) => {
          expect(formatAggregatorId(a)).not.toBe(formatAggregatorId(b));
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.4 — Property 3: Enrollment scoping excludes non-linked agents
// Validates: Requirements 7.1, 7.7
// ---------------------------------------------------------------------------

describe('Property 3: Enrollment scoping excludes non-linked agents', () => {
  it('returns exactly the records whose agentId is in linkedUids', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ agentId: fc.string(), dailyFigures: fc.integer({ min: 0 }) })),
        fc.array(fc.string()),
        (records, linkedUids) => {
          const result = scopeEnrollmentsByAgentUids(records, linkedUids);
          const uidSet = new Set(linkedUids);

          // Every returned record's agentId must be in linkedUids
          for (const r of result) {
            expect(uidSet.has(r.agentId)).toBe(true);
          }

          // Every record whose agentId is in linkedUids must appear in the result
          for (const r of records) {
            if (uidSet.has(r.agentId)) {
              // The record itself should be in the result (check by reference)
              expect(result).toContain(r);
            }
          }

          // Result length equals the number of records with agentId in linkedUids
          const expectedCount = records.filter((r) => uidSet.has(r.agentId)).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.5 — Property 4: Enrollment summary total equals sum of daily figures
// Validates: Requirements 7.6
// ---------------------------------------------------------------------------

describe('Property 4: Enrollment summary total equals sum of daily figures', () => {
  it('computeEnrollmentTotal equals records.reduce sum', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ agentId: fc.string(), dailyFigures: fc.integer({ min: 0, max: 10000 }) }),
        ),
        (records) => {
          const expected = records.reduce((s, r) => s + r.dailyFigures, 0);
          expect(computeEnrollmentTotal(records)).toBe(expected);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.6 — Property 5: Unlinked agent search returns only unlinked agents matching the term
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------

describe('Property 5: Unlinked agent search returns only unlinked agents matching the term', () => {
  it('every returned agent has no aggregatorId and the term appears in name/email/deviceId', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            name: fc.string(),
            email: fc.string(),
            deviceId: fc.string(),
            role: fc.constant('AGENT' as const),
            phone: fc.string(),
            profileStateId: fc.string(),
            profileStateName: fc.string(),
            profileLgaId: fc.string(),
            profileLgaName: fc.string(),
            createdAt: fc.string(),
            aggregatorId: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          }),
        ),
        // Use a non-whitespace-only search term so the match check is meaningful.
        // filterUnlinkedAgents treats whitespace-only terms as empty (returns all unlinked),
        // which is correct behaviour but would make the match assertion vacuously fail.
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (agents, term) => {
          const result = filterUnlinkedAgents(agents as AgentUser[], term);
          const lower = term.toLowerCase();

          for (const agent of result) {
            // Must be unlinked
            expect(agent.aggregatorId == null || agent.aggregatorId === '').toBe(true);
            // Term must appear in name, email, or deviceId (case-insensitive)
            const matchesName = agent.name.toLowerCase().includes(lower);
            const matchesEmail = agent.email.toLowerCase().includes(lower);
            const matchesDeviceId = (agent.deviceId ?? '').toLowerCase().includes(lower);
            expect(matchesName || matchesEmail || matchesDeviceId).toBe(true);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.7 — Property 6: Array chunking covers all elements without duplication
// Validates: Requirements 7.1, 7.2
// ---------------------------------------------------------------------------

describe('Property 6: Array chunking covers all elements without duplication', () => {
  it('chunks.flat() equals original array and all chunks except last have exactly size elements', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        fc.integer({ min: 1, max: 50 }),
        (arr, size) => {
          const chunks = chunkArray(arr, size);

          // Flattened chunks must equal the original array
          expect(chunks.flat()).toEqual(arr);

          // Every chunk except possibly the last must have exactly `size` elements
          for (let i = 0; i < chunks.length - 1; i++) {
            expect(chunks[i].length).toBe(size);
          }

          // Last chunk (if it exists) must have between 1 and size elements
          if (chunks.length > 0) {
            expect(chunks[chunks.length - 1].length).toBeGreaterThanOrEqual(1);
            expect(chunks[chunks.length - 1].length).toBeLessThanOrEqual(size);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.8 — Property 7: Form validation rejects submissions with any empty required field
// Validates: Requirements 5b.7, 10.8
// ---------------------------------------------------------------------------

describe('Property 7: Form validation rejects submissions with any empty required field', () => {
  it('returns a non-null error string when at least one required field is empty or whitespace', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1 }),
          email: fc.string({ minLength: 1 }),
          password: fc.string({ minLength: 1 }),
          deviceId: fc.string({ minLength: 1 }),
          phone: fc.string({ minLength: 1 }),
          stateId: fc.string({ minLength: 1 }),
          lgaId: fc.string({ minLength: 1 }),
        }),
        fc.constantFrom(
          'name',
          'email',
          'password',
          'deviceId',
          'phone',
          'stateId',
          'lgaId',
        ) as fc.Arbitrary<
          'name' | 'email' | 'password' | 'deviceId' | 'phone' | 'stateId' | 'lgaId'
        >,
        fc.constantFrom('', '   '),
        (validBase, fieldToBlank, blankValue) => {
          const input = { ...validBase, [fieldToBlank]: blankValue };
          const result = validateAgentForm(input);
          expect(result).not.toBeNull();
          expect(typeof result).toBe('string');
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 17 — Property 8: LGA dropdown resets when state changes
// Validates: Requirements 2.7, 5b.8, 10.2, 11.7
// ---------------------------------------------------------------------------

describe('Property 8: LGA dropdown resets when state changes', () => {
  it('returns LGAs of the new state and clears the selected LGA ID', () => {
    // Generate synthetic geo data: array of states each with an array of LGAs
    const stateArb = fc.record({
      id: fc.string({ minLength: 1 }),
      name: fc.string({ minLength: 1 }),
      lgas: fc.array(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
        }),
        { minLength: 0, maxLength: 10 },
      ),
    });

    fc.assert(
      fc.property(
        fc.array(stateArb, { minLength: 0, maxLength: 10 }),
        fc.string(), // newStateId — may or may not match a state
        fc.string(), // prevLgaId — the previously selected LGA (should be cleared)
        (geoData, newStateId, _prevLgaId) => {
          const result = computeLgaReset(geoData, newStateId);

          // lgaId must always be cleared (empty string)
          expect(result.lgaId).toBe('');

          // lgas must equal exactly the LGAs of the matching state, or [] if not found
          const matchingState = geoData.find(s => s.id === newStateId);
          if (matchingState) {
            expect(result.lgas).toEqual(matchingState.lgas);
          } else {
            expect(result.lgas).toEqual([]);
          }
        },
      ),
    );
  });
});
