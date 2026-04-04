# Requirements Document

## Introduction

This feature adds the ability for admins to delete individual enrollment records from the record list in the Admin page. The ward enrollment portal currently allows admins to view, filter, and export enrollment records submitted by agents. Admins need a way to remove erroneous or duplicate records directly from the UI. The app uses Firebase Firestore as its primary data store for enrollments, accessed directly from the React/TypeScript frontend.

## Glossary

- **Admin**: An authenticated user with the `ADMIN` role who has access to the Admin page.
- **Enrollment_Record**: A single enrollment submission stored in the Firestore `enrollments` collection, identified by a unique document ID.
- **Record_List**: The table of enrollment records displayed on the "Enrollment Records" tab of the Admin page.
- **Delete_Button**: A UI control rendered per row in the Record_List that initiates the deletion flow.
- **Confirmation_Dialog**: A browser-native or inline prompt shown to the admin before a deletion is committed.
- **Firestore**: The Firebase Firestore database used as the primary data store for enrollment records.

## Requirements

### Requirement 1: Delete Button Visibility

**User Story:** As an admin, I want a delete button on each enrollment record row, so that I can identify and act on individual records I wish to remove.

#### Acceptance Criteria

1. THE Record_List SHALL render a Delete_Button in each row of the enrollment table.
2. WHEN the Record_List is empty, THE Record_List SHALL NOT render any Delete_Button.
3. THE Delete_Button SHALL be visually distinct from other row actions (e.g., styled in red) to indicate a destructive action.

---

### Requirement 2: Deletion Confirmation

**User Story:** As an admin, I want to confirm before a record is deleted, so that I do not accidentally remove valid data.

#### Acceptance Criteria

1. WHEN an admin clicks the Delete_Button for an Enrollment_Record, THE Admin_Page SHALL display a Confirmation_Dialog identifying the record by agent name and date.
2. WHEN the admin cancels the Confirmation_Dialog, THE Admin_Page SHALL leave the Enrollment_Record unchanged in the Record_List and in Firestore.
3. WHEN the admin confirms the Confirmation_Dialog, THE Admin_Page SHALL proceed with deleting the Enrollment_Record.

---

### Requirement 3: Record Deletion

**User Story:** As an admin, I want confirmed deletions to permanently remove the record, so that the data store stays accurate.

#### Acceptance Criteria

1. WHEN an admin confirms deletion of an Enrollment_Record, THE Admin_Page SHALL delete the corresponding document from the Firestore `enrollments` collection using the record's document ID.
2. WHEN the Firestore deletion succeeds, THE Record_List SHALL remove the deleted Enrollment_Record from the displayed list without requiring a full page reload.
3. WHEN the Firestore deletion succeeds, THE Record_List SHALL update the record count and total enrollees summary to reflect the removal.
4. IF the Firestore deletion fails, THEN THE Admin_Page SHALL display an error message describing the failure and SHALL retain the Enrollment_Record in the Record_List.

---

### Requirement 4: Access Control

**User Story:** As a system owner, I want only admins to be able to delete records, so that agents cannot tamper with enrollment data.

#### Acceptance Criteria

1. THE Firestore security rules SHALL permit deletion of documents in the `enrollments` collection only to authenticated users whose Firestore user document has `role` equal to `"ADMIN"`.
2. IF a non-admin user attempts to delete an Enrollment_Record, THEN Firestore SHALL reject the operation with a permission-denied error.
3. WHEN a permission-denied error is returned by Firestore, THE Admin_Page SHALL display an error message informing the admin that the operation was not permitted.

---

### Requirement 5: UI State During Deletion

**User Story:** As an admin, I want clear feedback while a deletion is in progress, so that I know the system is working and avoid double-clicking.

#### Acceptance Criteria

1. WHEN a Firestore deletion is in progress for an Enrollment_Record, THE Delete_Button for that record SHALL be disabled and SHALL display a loading indicator.
2. WHEN a Firestore deletion is in progress, THE Admin_Page SHALL prevent initiating a second deletion on the same record.
3. WHEN the Firestore deletion completes (success or failure), THE Delete_Button SHALL return to its default enabled state if the record is still present.
