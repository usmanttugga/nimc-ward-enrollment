/**
 * Property-Based Tests for Aggregator ID Service
 * 
 * Tests universal properties that should hold across all valid inputs
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseAggregatorId,
  formatAggregatorId,
  selectNextId,
  type IdDiscoveryResult
} from './aggregatorIdService';

describe('aggregatorIdService - Property-Based Tests', () => {
  describe('Property 1: ID Parsing Correctness', () => {
    it('should parse any valid numeric ID string correctly', () => {
      // **Validates: Requirements 1.2, 5.3, 6.4**
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999 }),
          (numericId) => {
            // Test with zero-padded format
            const paddedId = numericId.toString().padStart(3, '0');
            expect(parseAggregatorId(paddedId)).toBe(numericId);

            // Test with non-zero-padded format
            const unpaddedId = numericId.toString();
            expect(parseAggregatorId(unpaddedId)).toBe(numericId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: ID Formatting Correctness', () => {
    it('should format any numeric ID with correct zero-padding', () => {
      // **Validates: Requirements 2.3, 4.1, 4.2, 4.3, 4.4**
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999 }),
          (numericId) => {
            const formatted = formatAggregatorId(numericId);
            
            // Verify format rules based on ID range
            if (numericId < 10) {
              // Two leading zeros for single-digit
              expect(formatted).toMatch(/^00\d$/);
              expect(formatted).toBe(numericId.toString().padStart(3, '0'));
            } else if (numericId < 100) {
              // One leading zero for two-digit
              expect(formatted).toMatch(/^0\d{2}$/);
              expect(formatted).toBe(numericId.toString().padStart(3, '0'));
            } else {
              // No leading zeros for three-digit
              expect(formatted).toMatch(/^\d{3}$/);
              expect(formatted).toBe(numericId.toString());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Formatting Round-Trip Preserves Value', () => {
    it('should preserve numeric value through format-parse round-trip', () => {
      // **Validates: Requirements 1.2, 2.3**
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999 }),
          (numericId) => {
            const formatted = formatAggregatorId(numericId);
            const parsed = parseAggregatorId(formatted);
            expect(parsed).toBe(numericId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Gap Detection Correctness', () => {
    it('should identify all gaps correctly for any set of assigned IDs', () => {
      // **Validates: Requirements 1.3, 1.4, 5.2**
      // TODO: Implement after findAvailableIds is implemented
      // This test requires mocking Firestore or testing the gap detection logic separately
    });
  });

  describe('Property 5: ID Selection Correctness (Gap Priority)', () => {
    it('should always select the lowest gap when gaps exist', () => {
      // **Validates: Requirements 2.1**
      fc.assert(
        fc.property(
          // Generate a non-empty array of gaps (sorted, unique positive integers)
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 })
            .map(arr => [...new Set(arr)].sort((a, b) => a - b))
            .chain(gaps => {
              // Generate nextSequential that is greater than all gaps (valid scenario)
              // In real system: gaps are in [1, max], nextSequential = max + 1
              const maxGap = Math.max(...gaps);
              return fc.record({
                gaps: fc.constant(gaps),
                nextSequential: fc.integer({ min: maxGap + 1, max: maxGap + 100 })
              });
            }),
          ({ gaps, nextSequential }) => {
            const selectedId = selectNextId(gaps, nextSequential);
            // Should always return the lowest gap (first element)
            expect(selectedId).toBe(gaps[0]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: ID Selection Correctness (Sequential Fallback)', () => {
    it('should select next sequential ID when no gaps exist', () => {
      // **Validates: Requirements 2.2**
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }),
          (nextSequential) => {
            const selectedId = selectNextId([], nextSequential);
            expect(selectedId).toBe(nextSequential);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: ID Selection Always Returns Minimum Available', () => {
    it('should always return the minimum available ID', () => {
      // **Validates: Requirements 2.1, 2.2**
      fc.assert(
        fc.property(
          // Generate gaps array (can be empty)
          fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 20 })
            .map(arr => [...new Set(arr)].sort((a, b) => a - b))
            .chain(gaps => {
              if (gaps.length === 0) {
                // No gaps: nextSequential can be any positive number
                return fc.record({
                  gaps: fc.constant(gaps),
                  nextSequential: fc.integer({ min: 1, max: 200 })
                });
              } else {
                // Gaps exist: nextSequential must be > max gap (valid scenario)
                const maxGap = Math.max(...gaps);
                return fc.record({
                  gaps: fc.constant(gaps),
                  nextSequential: fc.integer({ min: maxGap + 1, max: maxGap + 100 })
                });
              }
            }),
          ({ gaps, nextSequential }) => {
            const selectedId = selectNextId(gaps, nextSequential);
            
            // Calculate expected minimum
            const allAvailable = gaps.length > 0 ? [...gaps, nextSequential] : [nextSequential];
            const expectedMin = Math.min(...allAvailable);
            
            expect(selectedId).toBe(expectedMin);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Empty System Assigns First ID', () => {
    it('should assign ID 1 for empty system', () => {
      // **Validates: Requirements 6.1, 6.2**
      const selectedId = selectNextId([], 1);
      expect(selectedId).toBe(1);
    });
  });
});
