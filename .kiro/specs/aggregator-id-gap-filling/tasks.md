# Implementation Plan: Aggregator ID Gap-Filling System

## Overview

This implementation plan breaks down the intelligent aggregator ID assignment system into discrete coding tasks. The system will automatically assign the lowest available ID to new aggregators, filling gaps in the sequence before incrementing to higher numbers. The implementation uses TypeScript with Firestore for data persistence, Vitest for testing, and fast-check for property-based testing.

## Tasks

- [x] 1. Set up project structure and testing framework
  - Create `backend/src/services/aggregatorIdService.ts` file
  - Create `backend/src/services/aggregatorIdService.test.ts` file for unit tests
  - Create `backend/src/services/aggregatorIdService.property.test.ts` file for property-based tests
  - Install fast-check dependency: `npm install --save-dev fast-check`
  - Verify Vitest is configured and working
  - _Requirements: 7.3_

- [ ] 2. Implement ID formatting and parsing utilities
  - [x] 2.1 Implement `formatAggregatorId(numericId: number): string` function
    - Convert numeric ID to zero-padded string (001, 042, 256)
    - Handle all ranges: 1-9 (two leading zeros), 10-99 (one leading zero), 100+ (no leading zeros)
    - _Requirements: 2.3, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Write property test for ID formatting correctness
    - **Property 2: ID Formatting Correctness**
    - **Validates: Requirements 2.3, 4.1, 4.2, 4.3, 4.4**
    - Generate random numeric IDs (1-999), verify zero-padding rules
    - Tag: `Feature: aggregator-id-gap-filling, Property 2: ID Formatting Correctness`

  - [x] 2.3 Implement `parseAggregatorId(id: string): number | null` function
    - Parse aggregator ID strings to numeric values
    - Handle both zero-padded ("001") and non-zero-padded ("1") formats
    - Return null for invalid formats
    - _Requirements: 1.2, 6.4_

  - [ ]* 2.4 Write property test for ID parsing correctness
    - **Property 1: ID Parsing Correctness**
    - **Validates: Requirements 1.2, 5.3, 6.4**
    - Generate random numeric IDs with various padding, verify parsing produces correct numeric value
    - Tag: `Feature: aggregator-id-gap-filling, Property 1: ID Parsing Correctness`

  - [ ]* 2.5 Write property test for formatting round-trip
    - **Property 3: Formatting Round-Trip Preserves Value**
    - **Validates: Requirements 1.2, 2.3**
    - Generate random numeric IDs, format then parse, verify result equals original
    - Tag: `Feature: aggregator-id-gap-filling, Property 3: Formatting Round-Trip Preserves Value`

  - [x] 2.6 Implement `isValidAggregatorId(id: string): boolean` validation function
    - Validate ID format matches /^\d{3,}$/ pattern
    - _Requirements: 4.1, 5.3_

  - [ ]* 2.7 Write unit tests for formatting and parsing edge cases
    - Test null/empty string handling
    - Test invalid format strings
    - Test boundary values (1, 10, 100, 999)
    - _Requirements: 1.2, 2.3, 4.1, 4.2, 4.3, 4.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement ID discovery module
  - [x] 4.1 Implement `findAvailableIds(): Promise<IdDiscoveryResult>` function
    - Query Firestore users collection for all users with role='AGGREGATOR'
    - Extract and parse aggregatorId field from each document
    - Filter out null/empty/invalid IDs
    - Calculate gaps in the sequence [1..max]
    - Calculate nextSequential as max + 1
    - Return `{ gaps: number[], nextSequential: number }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.3_

  - [ ]* 4.2 Write property test for gap detection correctness
    - **Property 4: Gap Detection Correctness**
    - **Validates: Requirements 1.3, 1.4, 5.2**
    - Generate random sets of assigned IDs, verify gaps are exactly missing numbers in [1, max]
    - Verify gaps are sorted ascending and non-overlapping
    - Verify nextSequential = max + 1
    - Tag: `Feature: aggregator-id-gap-filling, Property 4: Gap Detection Correctness`

  - [ ]* 4.3 Write unit tests for ID discovery edge cases
    - Test empty collection (no aggregators)
    - Test collection with null/empty aggregatorId fields
    - Test collection with invalid aggregatorId formats
    - Test contiguous sequence with no gaps
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 5. Implement ID selection logic
  - [x] 5.1 Implement `selectNextId(gaps: number[], nextSequential: number): number` function
    - Return lowest gap if gaps exist
    - Return nextSequential if no gaps exist
    - Return 1 if both gaps and nextSequential are empty/invalid
    - _Requirements: 2.1, 2.2, 6.1_

  - [ ]* 5.2 Write property test for ID selection with gaps
    - **Property 5: ID Selection Correctness (Gap Priority)**
    - **Validates: Requirements 2.1**
    - Generate random sets with guaranteed gaps, verify selected ID equals minimum gap
    - Tag: `Feature: aggregator-id-gap-filling, Property 5: ID Selection Correctness (Gap Priority)`

  - [ ]* 5.3 Write property test for ID selection without gaps
    - **Property 6: ID Selection Correctness (Sequential Fallback)**
    - **Validates: Requirements 2.2**
    - Generate random contiguous sequences [1..n], verify selected ID equals n + 1
    - Tag: `Feature: aggregator-id-gap-filling, Property 6: ID Selection Correctness (Sequential Fallback)`

  - [ ]* 5.4 Write property test for minimum available ID
    - **Property 7: ID Selection Always Returns Minimum Available**
    - **Validates: Requirements 2.1, 2.2**
    - Generate random sets (with and without gaps), verify selected ID equals min(gaps ∪ {nextSequential})
    - Tag: `Feature: aggregator-id-gap-filling, Property 7: ID Selection Always Returns Minimum Available`

  - [ ]* 5.5 Write property test for empty system
    - **Property 8: Empty System Assigns First ID**
    - **Validates: Requirements 6.1, 6.2**
    - Test with empty assigned IDs set, verify selected ID is 1
    - Tag: `Feature: aggregator-id-gap-filling, Property 8: Empty System Assigns First ID`

  - [ ]* 5.6 Write unit tests for ID selection edge cases
    - Test empty gaps array with nextSequential
    - Test single gap
    - Test multiple gaps (verify lowest selected)
    - _Requirements: 2.1, 2.2, 6.1_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement ID assignment module with concurrency control
  - [x] 7.1 Implement `assignIdToUser(userId: string, aggregatorId: string, maxRetries: number): Promise<void>` function
    - Read current user document from Firestore
    - Verify aggregatorId field is null/empty (not already assigned)
    - Attempt to write aggregatorId using Firestore update
    - Implement retry logic for concurrency conflicts (up to 3 attempts)
    - Throw descriptive errors for non-retryable failures
    - _Requirements: 2.4, 3.1, 3.2, 5.1, 7.2_

  - [ ]* 7.2 Write unit tests for ID assignment
    - Test successful assignment to user with no existing ID
    - Test skipping user with existing aggregatorId
    - Test retry logic on conflict error
    - Test error handling for Firestore errors
    - Mock Firestore interactions
    - _Requirements: 2.4, 3.2, 5.1, 7.2_

- [ ] 8. Implement main orchestration service
  - [x] 8.1 Implement `assignAggregatorId(userId: string): Promise<string>` function
    - Call findAvailableIds() to get gaps and nextSequential
    - Call selectNextId() to choose lowest available ID
    - Call formatAggregatorId() to format numeric ID
    - Call assignIdToUser() with retry logic
    - Log successful assignment with timestamp, userId, and assigned ID
    - Log failures with error details
    - Return assigned aggregator ID string
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.2, 7.1, 7.3_

  - [ ]* 8.2 Write unit tests for orchestration service
    - Test successful ID assignment flow (end-to-end with mocks)
    - Test retry logic on conflict
    - Test error propagation from sub-modules
    - Test logging output
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Create integration tests with Firestore
  - [ ]* 10.1 Set up Firestore emulator configuration for integration tests
    - Configure test environment to use Firestore emulator
    - Create helper functions for seeding test data
    - Create `backend/src/services/aggregatorIdService.integration.test.ts` file
    - _Requirements: 1.1, 2.4_

  - [ ]* 10.2 Write integration test for Firestore query
    - Seed Firestore with test aggregator users
    - Verify service correctly queries users collection
    - Verify query filters by role='AGGREGATOR'
    - _Requirements: 1.1_

  - [ ]* 10.3 Write integration test for Firestore write
    - Verify service correctly writes aggregatorId to user document
    - Verify write uses correct document ID
    - _Requirements: 2.4_

  - [ ]* 10.4 Write integration test for concurrency safety
    - Simulate 5-10 concurrent registration attempts
    - Verify all assigned IDs are unique
    - Verify no duplicate IDs assigned
    - _Requirements: 3.1, 3.2_

  - [ ]* 10.5 Write integration test for performance
    - Measure ID assignment latency under normal load
    - Verify operation completes within 5 seconds
    - _Requirements: 3.3_

- [ ] 11. Integrate service into backend API
  - [x] 11.1 Create API endpoint for aggregator ID assignment
    - Add POST endpoint `/admin/assign-aggregator-id` to admin routes
    - Accept userId in request body
    - Call assignAggregatorId(userId) service
    - Return assigned ID in response
    - Handle errors and return appropriate HTTP status codes
    - _Requirements: 7.1, 7.2_

  - [x] 11.2 Add authentication and authorization middleware
    - Verify request is authenticated
    - Verify user has ADMIN role
    - _Requirements: 7.2_

  - [ ]* 11.3 Write API endpoint tests
    - Test successful ID assignment via API
    - Test authentication/authorization checks
    - Test error responses
    - _Requirements: 7.1, 7.2_

- [ ] 12. Update frontend to use new ID assignment service
  - [x] 12.1 Update aggregator registration flow in AdminPage
    - Call new `/admin/assign-aggregator-id` endpoint after user creation
    - Display assigned aggregator ID to admin
    - Handle errors gracefully with user-friendly messages
    - _Requirements: 7.1, 7.2_

  - [x] 12.2 Update UI to show assigned aggregator ID
    - Display assigned ID in success message
    - Update aggregator list to show newly assigned ID
    - _Requirements: 7.1_

- [x] 13. Final checkpoint - End-to-end verification
  - Ensure all tests pass (unit, property, integration)
  - Verify API endpoint works correctly
  - Verify frontend integration works correctly
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests verify Firestore interactions and concurrency behavior
- The implementation uses TypeScript with Firestore (not Prisma/PostgreSQL)
- Testing uses Vitest and fast-check
- Checkpoints ensure incremental validation throughout implementation
