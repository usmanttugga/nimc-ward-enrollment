# Implementation Plan: Aggregator Portal

## Overview

Implement the Aggregator role end-to-end across the frontend: utility functions and their property tests, Firestore security rules, routing changes in `App.tsx`, sign-up sub-tabs and geo fields in `AuthPage.tsx`, the new `AggregatorPage.tsx` dashboard, and Admin dashboard extensions. Each task builds on the previous one so that no code is left unintegrated.

## Tasks

- [x] 1. Create `aggregatorUtils.ts` with pure utility functions
  - Create `frontend/src/aggregatorUtils.ts`
  - Implement `formatAggregatorId(sequence: number): string` — returns `2PLUS/AGG/ENR/` + zero-padded three-digit sequence
  - Implement `chunkArray<T>(arr: T[], size: number): T[][]` — splits an array into chunks of at most `size` elements
  - Implement `scopeEnrollmentsByAgentUids<T extends { agentId: string }>(records: T[], linkedUids: string[]): T[]` — filters records to only those whose `agentId` is in `linkedUids`
  - Implement `filterUnlinkedAgents(agents: AgentUser[], searchTerm: string): AgentUser[]` — returns agents with no `aggregatorId` that match the search term (case-insensitive substring on name, email, or deviceId)
  - Implement `validateAgentForm(fields: { name: string; email: string; password: string; deviceId: string; phone: string; stateId: string; lgaId: string }): string | null` — returns an error string if any field is empty/whitespace, otherwise null
  - Export all TypeScript interfaces: `AggregatorUser`, `AgentUser` (extended with optional `aggregatorId`), `AggregatorIdCounter`
  - _Requirements: 1.2, 5.2, 5b.7, 7.1, 7.6, 10.8_

- [x] 2. Install fast-check and write property-based tests for `aggregatorUtils.ts`
  - Install fast-check as a dev dependency: `npm install --save-dev fast-check vitest @vitest/ui`
  - Add `"test": "vitest --run"` script to `frontend/package.json`
  - Create `frontend/src/aggregatorUtils.test.ts`

  - [x] 2.1 Write unit tests for `formatAggregatorId` with specific examples
    - Test: `formatAggregatorId(1)` → `'2PLUS/AGG/ENR/001'`
    - Test: `formatAggregatorId(99)` → `'2PLUS/AGG/ENR/099'`
    - Test: `formatAggregatorId(100)` → `'2PLUS/AGG/ENR/100'`
    - Test: `formatAggregatorId(999)` → `'2PLUS/AGG/ENR/999'`
    - _Requirements: 1.2_

  - [ ]* 2.2 Write property test for `formatAggregatorId` — format correctness
    - **Property 1: Aggregator ID format is always correct**
    - For any positive integer `n`, the result starts with `'2PLUS/AGG/ENR/'` and ends with `n` zero-padded to at least three digits
    - Use `fc.integer({ min: 1, max: 9999 })`
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test for `formatAggregatorId` — uniqueness
    - **Property 2: Aggregator ID sequence numbers are unique**
    - For any two distinct positive integers `a` and `b`, `formatAggregatorId(a) !== formatAggregatorId(b)`
    - Use `fc.tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 9999 })).filter(([a, b]) => a !== b)`
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.4 Write property test for `scopeEnrollmentsByAgentUids` — scoping correctness
    - **Property 3: Enrollment scoping excludes non-linked agents**
    - For any list of enrollment records and any set of linked UIDs, the result contains exactly those records whose `agentId` is in the linked set
    - Use `fc.array(fc.record({ agentId: fc.string(), dailyFigures: fc.integer({ min: 0 }) }))` and `fc.array(fc.string())`
    - **Validates: Requirements 7.1, 7.7**

  - [ ]* 2.5 Write property test for enrollment summary total
    - **Property 4: Enrollment summary total equals sum of daily figures**
    - For any list of enrollment records, `records.reduce((s, r) => s + r.dailyFigures, 0)` equals the sum computed by the UI
    - Use `fc.array(fc.record({ agentId: fc.string(), dailyFigures: fc.integer({ min: 0, max: 10000 }) }))`
    - **Validates: Requirements 7.6**

  - [ ]* 2.6 Write property test for `filterUnlinkedAgents` — search correctness
    - **Property 5: Unlinked agent search returns only unlinked agents matching the term**
    - For any agent list and any non-empty search term, every returned agent has no `aggregatorId` and the term appears (case-insensitive) in name, email, or deviceId
    - Use `fc.array(fc.record({ name: fc.string(), email: fc.string(), deviceId: fc.string(), aggregatorId: fc.option(fc.string()) }))` and `fc.string({ minLength: 1 })`
    - **Validates: Requirements 5.2**

  - [ ]* 2.7 Write property test for `chunkArray` — coverage and no duplication
    - **Property 6: Array chunking covers all elements without duplication**
    - For any array and any positive chunk size, `chunks.flat()` deep-equals the original array, and every chunk except possibly the last has exactly `size` elements
    - Use `fc.array(fc.integer())` and `fc.integer({ min: 1, max: 50 })`
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 2.8 Write property test for `validateAgentForm` — rejects any empty required field
    - **Property 7: Form validation rejects submissions with any empty required field**
    - For any input where at least one of the seven required fields is empty or whitespace-only, `validateAgentForm` returns a non-null error string
    - Use `fc.record(...)` with at least one field set to `fc.constantFrom('', '   ')`
    - **Validates: Requirements 5b.7, 10.8**

- [x] 3. Checkpoint — run tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update Firestore security rules
  - Modify `frontend/firestore.rules` to add the `isAggregator()` helper function
  - Add aggregator read rule on `/users/{userId}`: allow read when caller is aggregator and `resource.data.aggregatorId == request.auth.uid`
  - Add aggregator link rule on `/users/{userId}`: allow update when caller is aggregator, target is AGENT, `aggregatorId` is currently absent/null, written value equals caller UID, and only `aggregatorId` is changed
  - Add aggregator create rule on `/users/{userId}`: allow create when caller is aggregator, new doc has `role == 'AGENT'` and `aggregatorId == request.auth.uid`
  - Update `/enrollmentLogs/{docId}` read rule to also allow aggregators whose linked agent matches
  - Add `/counters/{docId}` rule: allow read/write for any authenticated user
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 12.2_

- [x] 5. Update `App.tsx` for AGGREGATOR routing
  - Import `AggregatorPage` (file will be created in task 6; add the import now and TypeScript will resolve it once the file exists)
  - Extend the `role` state type from `'AGENT' | 'ADMIN' | null` to `'AGENT' | 'ADMIN' | 'AGGREGATOR' | null`
  - Add routing branch: `if (role === 'AGGREGATOR') return <AggregatorPage user={user} />;` before the default `AgentPage` fallback
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Update `AuthPage.tsx` — Sign Up sub-tabs and geo fields
  - Add `signUpSubTab: 'agent' | 'aggregator'` state (default `'agent'`)
  - Load GeoData once on mount via `useEffect` and store in `geoData` state
  - When outer tab is `'register'`, render a second row of sub-tabs: "Agent Sign Up" / "Aggregator Sign Up"
  - Agent Sign Up sub-tab: add State_Dropdown and LGA_Dropdown after the Phone field; write `profileStateId`, `profileStateName`, `profileLgaId`, `profileLgaName` to Firestore on submit; validate state and LGA are selected before submit
  - Aggregator Sign Up sub-tab: render a new form with fields: Full Name, Email, Password, Confirm Password, Phone, State_Dropdown, LGA_Dropdown (no Device ID field)
  - On Aggregator Sign Up submit: validate all fields non-empty, passwords match, state and LGA selected; call `createUserWithEmailAndPassword`; run `generateAggregatorId` transaction; write Firestore doc with `role: 'AGGREGATOR'`, `aggregatorId`, `profileStateId`, `profileStateName`, `profileLgaId`, `profileLgaName`, `phone`, `createdAt`
  - Handle errors: `auth/email-already-in-use` → "Email already registered.", passwords mismatch → "Passwords do not match.", empty state/LGA → "State and LGA are required."
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13_

- [x] 7. Create `AggregatorPage.tsx` — scaffold and My Agents tab
  - Create `frontend/src/pages/AggregatorPage.tsx` with `Props { user: User }`
  - Define tab type: `'agents' | 'addAgent' | 'reports' | 'enrollmentLog' | 'profile'`
  - Render header (same style as AgentPage) with Logout button and a prominent badge showing the aggregator's `aggregatorId` (fetched from Firestore on mount)
  - Render tab navigation bar
  - Implement My Agents tab: on mount and on tab select, query `users` where `aggregatorId == user.uid` and `role == 'AGENT'`; display table with Name, Email, Device ID, Phone; show "No agents linked yet." when empty; no edit/delete controls
  - Load GeoData once on mount for use by Add Agent tab forms
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 8. Implement Add Agent tab — Create New sub-tab
  - Add `addAgentSubTab: 'create' | 'link'` state to `AggregatorPage`
  - Render sub-tab row within the Add Agent tab
  - Create New form: Name, Email, Password, Device ID, Phone, State_Dropdown, LGA_Dropdown (all required)
  - On submit: call `validateAgentForm` from `aggregatorUtils.ts`; if invalid, show error and stop
  - Create secondary Firebase App instance; call `createUserWithEmailAndPassword`; write Firestore doc with `role: 'AGENT'`, `aggregatorId: user.uid`, geo fields, `createdAt`; sign out secondary app
  - On success: append new agent to local `myAgents` state; switch to My Agents tab
  - On `auth/email-already-in-use`: display "Email already registered."
  - On Firestore write failure after Auth success: display "Account partially created. Contact support." — do not update local state
  - _Requirements: 5b.1, 5b.2, 5b.3, 5b.4, 5b.5, 5b.6, 5b.7, 5b.8, 5b.9, 12.4_

- [x] 9. Implement Add Agent tab — Link Existing sub-tab
  - Add search input (name, email, or Device ID) to the Link Existing sub-tab
  - On search submit: fetch all AGENT users from Firestore; filter client-side via `filterUnlinkedAgents` from `aggregatorUtils.ts`; display results table with Name, Email, Device ID and a "Link" button per row
  - On "Link" confirm: run a Firestore transaction that re-reads the agent doc, verifies `aggregatorId` is still unset, then writes `aggregatorId: user.uid`
  - On success: append agent to local `myAgents` state; clear search results
  - On race condition (agent already linked): display "This agent is already linked to another aggregator." — do not update local state
  - On other Firestore failure: display descriptive error — do not update local state
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 12.1, 12.2, 12.3_

- [x] 10. Implement Enrollment Reports tab
  - On tab select: if `myAgents` is empty, show empty state message without querying Firestore
  - Otherwise: extract agent UIDs from `myAgents`; call `chunkArray(uids, 30)` from `aggregatorUtils.ts`; run parallel `getDocs` queries on `enrollments` with `agentId in batch`; merge results
  - Apply `scopeEnrollmentsByAgentUids` as a final client-side guard
  - Render filter controls: date-from, date-to, agent name search (client-side)
  - Render summary total: sum of `dailyFigures` across filtered records
  - Render table: Date, Agent Name, State, LGA, Ward, Device ID, Daily Figures, Issues/Complaints
  - No edit/delete controls
  - _Requirements: 7.1, 7.3, 7.5, 7.6, 7.7, 7.9, 7.10_

- [x] 11. Implement Enrollment Log tab
  - On tab select: if `myAgents` is empty, show empty state message
  - Otherwise: batch-query `enrollmentLogs` using the same `chunkArray` pattern as task 10
  - Apply `scopeEnrollmentsByAgentUids` as a final client-side guard
  - Use `formatMonthName` and `sortEnrollmentLogs` from `enrollmentLogUtils.ts`
  - Render table: Agent Name, Month, Year, Total Enrollment
  - No edit/delete controls
  - _Requirements: 7.2, 7.4, 7.8, 7.9_

- [x] 12. Implement My Profile tab
  - Fetch aggregator's Firestore document on mount (reuse data already loaded in task 7)
  - Display read-only fields: Name, Email, Aggregator ID (styled as a badge)
  - Display editable Phone field
  - Save button calls `updateDoc` with the new phone value
  - On success: update local phone state
  - On failure: display "Failed to update profile: [error message]." — do not update local state
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 13. Checkpoint — verify AggregatorPage integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Extend `AdminPage.tsx` — role dropdown and State/LGA fields for AGENT creation
  - Change `newRole` state type from `'AGENT' | 'ADMIN'` to `'AGENT' | 'ADMIN' | 'AGGREGATOR'`
  - Add `AGGREGATOR` option to the role `<select>` in the Add User form
  - When `newRole === 'AGENT'`: show State_Dropdown and LGA_Dropdown as required fields; load GeoData once on mount; write `profileStateId`, `profileStateName`, `profileLgaId`, `profileLgaName` to the new agent's Firestore document
  - When `newRole === 'AGGREGATOR'`: hide Device ID field; on submit run `generateAggregatorId` transaction; write Firestore doc with `role: 'AGGREGATOR'` and generated `aggregatorId`; show success message including the generated ID
  - Handle LGA reset when state changes (same pattern as AuthPage)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9, 1.2, 1.3, 1.4, 1.5_

- [x] 15. Extend `AdminPage.tsx` — Aggregators tab
  - Add `'aggregators'` to the admin tab type union
  - Add "Aggregators" tab button to the tab navigation bar
  - On tab select: query `users` where `role == 'AGGREGATOR'`; store in `aggregators` state
  - Render table: Name, Email, Aggregator ID, Phone
  - No edit controls in this initial implementation
  - _Requirements: 2.5_

- [x] 16. Extend `AdminPage.tsx` — Assign Aggregator control on agent records
  - Fetch all aggregators once when the Agents tab loads (store in `allAggregators` state)
  - Add an "Assign Aggregator" dropdown to each agent row in the Agents tab, populated from `allAggregators`
  - When an aggregator is selected and confirmed: write the aggregator's Firebase UID to the agent's `aggregatorId` field via `updateDoc`
  - If the agent already has an `aggregatorId`, show a confirmation prompt before overwriting (this is an admin override — no exclusive-ownership restriction applies)
  - On success: update the agent in local `agents` state
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.5_

- [x] 17. Write property test for LGA reset on state change
  - Add test to `aggregatorUtils.test.ts` (or a new `stateLogic.test.ts`)
  - **Property 8: LGA dropdown resets when state changes**
  - For any state selection change, the resulting LGA list equals exactly the LGAs of the new state, and the previously selected LGA ID is cleared (empty string)
  - Model the state-change handler as a pure function that takes `(geoData, newStateId, prevLgaId)` and returns `{ lgas, lgaId }`; test with `fc.array(...)` of synthetic state/LGA data
  - **Validates: Requirements 2.7, 5b.8, 10.2, 11.7**

- [x] 18. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Property tests use **fast-check** (`fc`) and should be run with `npm test` (vitest --run) from the `frontend/` directory
- The secondary Firebase App pattern (`initializeApp(config, 'secondary-' + Date.now())`) is already used in `AdminPage.tsx` — follow the same pattern in `AggregatorPage.tsx`
- `generateAggregatorId` (Firestore transaction on `counters/aggregatorId`) is needed in both `AuthPage.tsx` (self-registration) and `AdminPage.tsx` (admin creation) — extract it into `aggregatorUtils.ts` or a shared helper to avoid duplication
- Property 9 (agent exclusive ownership under concurrent writes) is enforced by the Firestore security rule in task 4 and the transaction in task 9; it is not directly testable as a fast-check property without a Firestore emulator, so it is covered by the rule implementation and the transaction logic rather than a PBT sub-task
