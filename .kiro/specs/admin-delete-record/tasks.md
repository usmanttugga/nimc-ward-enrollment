# Implementation Plan: Admin Delete Enrollment Record

## Overview

All changes are frontend-only, confined to `frontend/src/pages/AdminPage.tsx` and `frontend/firestore.rules`. The pattern mirrors the existing agent-deletion flow already in the component.

## Tasks

- [x] 1. Update Firestore security rules to allow admin deletion of enrollments
  - Add `allow delete: if isAdmin();` to the `enrollments` match block in `frontend/firestore.rules`
  - _Requirements: 4.1, 4.2_

  - [ ]* 1.1 Write property test for Firestore delete rule (Property 7)
    - **Property 7: Firestore delete is restricted to ADMIN role**
    - Use Firebase Rules Unit Testing; generate arbitrary `role` strings; assert delete allowed iff `role === "ADMIN"`
    - Install `@firebase/rules-unit-testing` if not present
    - **Validates: Requirements 4.1, 4.2**

- [x] 2. Add `deletingId` state and `handleDeleteEnrollment` handler to `AdminPage`
  - Add `const [deletingId, setDeletingId] = useState<string | null>(null);` alongside existing state declarations
  - Implement `handleDeleteEnrollment(record: Enrollment)`:
    - Show `window.confirm` with agent name and date
    - On cancel: return immediately
    - On confirm: set `deletingId`, call `deleteDoc(doc(db, 'enrollments', record.id))`, on success filter record out of `enrollments` state, on failure show error alert; clear `deletingId` in `finally`
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.4, 4.3, 5.1, 5.2, 5.3_

  - [ ]* 2.1 Write property test for confirmation dialog content (Property 2)
    - **Property 2: Confirmation dialog identifies the record**
    - Generate arbitrary `Enrollment` objects; mock `window.confirm` to capture the message; assert it contains `agentName` and `date`
    - **Validates: Requirements 2.1**

  - [ ]* 2.2 Write property test for cancel leaves list unchanged (Property 3)
    - **Property 3: Cancel leaves the list unchanged**
    - Generate arbitrary enrollment lists; mock `window.confirm` → `false`; assert `enrollments` state is identical before and after
    - **Validates: Requirements 2.2**

  - [ ]* 2.3 Write property test for deleteDoc called with correct ID (Property 4)
    - **Property 4: Confirmed deletion calls deleteDoc with the correct ID**
    - Generate arbitrary `Enrollment`; mock `window.confirm` → `true` and `deleteDoc` → resolves; assert `deleteDoc` called exactly once with path ending in `record.id`
    - **Validates: Requirements 3.1**

- [x] 3. Add "Actions" column and Delete button to the enrollment table
  - Add an "Actions" `<th>` header to the enrollment table header row
  - In each `<tr>` of `filtered.map(...)`, add a `<td>` containing a Delete button:
    - `onClick={() => handleDeleteEnrollment(r)}`
    - `disabled={deletingId === r.id}`
    - Red styling consistent with the existing agent Delete button (`text-red-500`, `border-red-200`, `bg-red-50`)
    - When `deletingId === r.id`: show an inline spinner SVG and hide the label
    - When idle: show the text "Delete"
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2_

  - [ ]* 3.1 Write property test for every non-empty row has a Delete button (Property 1)
    - **Property 1: Every non-empty enrollment row has a Delete button**
    - Generate arbitrary arrays of `Enrollment` objects (length ≥ 1); render the component; assert every row contains exactly one Delete button
    - **Validates: Requirements 1.1**

  - [ ]* 3.2 Write property test for Delete button disabled during deletion (Property 8)
    - **Property 8: Delete button is disabled while deletion is in progress**
    - Generate arbitrary `Enrollment`; mock `deleteDoc` with a never-resolving promise; assert the button is `disabled` and a spinner is present
    - **Validates: Requirements 5.1, 5.2**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Handle success and failure UI feedback
  - Verify that on successful deletion the row disappears and the record count / total enrollees summary updates automatically (derived from `filtered` which reacts to `enrollments` state — no extra code needed beyond the state update in step 2)
  - Add an inline `deleteError` state (`useState<string>('')`) and render an error banner above the table when set, clearing it on the next delete attempt
  - _Requirements: 3.2, 3.3, 3.4, 4.3_

  - [ ]* 5.1 Write property test for successful deletion removes record and updates counts (Property 5)
    - **Property 5: Successful deletion removes the record from local state**
    - Generate arbitrary enrollment list and pick a random record; mock `deleteDoc` → resolves; assert record absent from rendered list and count/total reflect removal
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 5.2 Write property test for failed deletion retains record and shows error (Property 6)
    - **Property 6: Failed deletion retains the record and shows an error**
    - Generate arbitrary `Enrollment`; mock `deleteDoc` → rejects; assert record still in list and error message is visible
    - **Validates: Requirements 3.4, 4.3, 5.3**

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests require `fast-check` and `@testing-library/react`; install with `npm install -D fast-check @testing-library/react @testing-library/jest-dom vitest jsdom` if not already present
- The `deleteDoc` import is already present in `AdminPage.tsx` — no new imports needed for the core implementation
- Each task references specific requirements for traceability
