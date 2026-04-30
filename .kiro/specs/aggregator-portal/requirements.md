# Requirements Document

## Introduction

This document defines the requirements for the **Aggregator Portal** feature of the NIMC Ward Enrollment Portal. An Aggregator is a new user role that sits between Admins and Agents. Aggregators manage a subset of Agents assigned to them and can view enrollment reports scoped exclusively to those agents. They cannot modify agent data or enrollment records.

The feature introduces:
- A new `AGGREGATOR` role in the Firestore `users` collection
- A dedicated `AggregatorPage.tsx` dashboard
- An agent-linking mechanism (admin-assigned or aggregator-initiated direct link)
- A sequential Aggregator ID format (`2PLUS/AGG/ENR/001`, `002`, …)
- Scoped enrollment report views (only agents under the aggregator)
- Continued use of the single shared `AuthPage.tsx` for login; the Sign Up section now offers two sub-tabs — **Agent Sign Up** (existing flow) and **Aggregator Sign Up** (new self-registration flow)
- Aggregator self-registration: prospective Aggregators can create their own account via the Aggregator Sign Up tab without requiring Admin intervention

---

## Glossary

- **Aggregator**: A user with role `AGGREGATOR` who supervises a set of Agents and views their enrollment data.
- **Agent**: A user with role `AGENT` who submits daily enrollment records.
- **Admin**: A user with role `ADMIN` who has full system access.
- **AggregatorPage**: The dedicated React page rendered for authenticated Aggregator users.
- **AuthPage**: The single shared login/registration page used by all roles.
- **App**: The root React component (`App.tsx`) that routes users to their role-specific page.
- **Firestore**: The Firebase Firestore database used as the backend data store.
- **Users_Collection**: The Firestore `users` collection storing all user profiles.
- **Enrollments_Collection**: The Firestore `enrollments` collection storing daily enrollment submissions.
- **EnrollmentLogs_Collection**: The Firestore `enrollmentLogs` collection storing monthly enrollment totals per agent.
- **Aggregator_ID**: A human-readable sequential identifier assigned to each Aggregator, formatted as `2PLUS/AGG/ENR/NNN` where `NNN` is a zero-padded three-digit sequence number (e.g., `2PLUS/AGG/ENR/001`).
- **Agent_Link**: A relationship stored in Firestore that associates an Agent with an Aggregator via the `aggregatorId` field on the agent's user document.
- **ID_Counter**: A Firestore document (e.g., `counters/aggregatorId`) that tracks the last-issued Aggregator_ID sequence number.
- **Secondary_Firebase_App**: A temporary Firebase app instance initialised at runtime (via `initializeApp`) used to create new Firebase Auth users without signing out the currently authenticated Aggregator or Admin.
- **GeoData**: The hierarchical geographic reference data (State → LGA → Ward) loaded via the existing `loadGeoData()` utility in `geoData.ts`.
- **State_Dropdown**: A select control populated from GeoData that lists all available Nigerian states.
- **LGA_Dropdown**: A select control populated from GeoData that lists the Local Government Areas belonging to the currently selected state. The LGA_Dropdown is disabled until a state is selected.
- **Sign_Up_Sub_Tab**: One of the two sub-tabs displayed within the Sign Up section of AuthPage — either "Agent Sign Up" or "Aggregator Sign Up" — that determines which registration form is shown.
- **Aggregator_Sign_Up_Form**: The registration form displayed on the Aggregator Sign Up sub-tab of AuthPage, used by prospective Aggregators to self-register.

---

## Requirements

### Requirement 1: Aggregator Role and User Profile

**User Story:** As an Admin, I want to create Aggregator accounts with a unique sequential ID, so that Aggregators can be identified and managed distinctly from Agents and Admins.

#### Acceptance Criteria

1. THE Users_Collection SHALL support `'AGGREGATOR'` as a valid value for the `role` field, in addition to the existing `'AGENT'` and `'ADMIN'` values.
2. WHEN an Aggregator account is created — whether by an Admin or via Aggregator self-registration — THE App SHALL generate an Aggregator_ID in the format `2PLUS/AGG/ENR/NNN` where `NNN` is the next available zero-padded three-digit sequence number.
3. WHEN an Aggregator_ID is generated — whether by an Admin or via Aggregator self-registration — THE App SHALL increment the ID_Counter atomically using a Firestore transaction to prevent duplicate IDs.
4. THE Users_Collection SHALL store the `aggregatorId` field (the formatted `2PLUS/AGG/ENR/NNN` string) on Aggregator user documents.
5. WHEN an Admin creates an Aggregator account, THE App SHALL write the Aggregator user document to the Users_Collection with fields: `name`, `email`, `role: 'AGGREGATOR'`, `aggregatorId`, `phone`, `createdAt`.
6. IF the ID_Counter document does not exist when the first Aggregator is created, THEN THE App SHALL initialise the counter to `1` and assign `2PLUS/AGG/ENR/001` to that Aggregator.

---

### Requirement 2: Aggregator Account Creation by Admin

**User Story:** As an Admin, I want to create Aggregator accounts from the Admin dashboard, so that I can onboard new Aggregators without them self-registering.

#### Acceptance Criteria

1. WHEN an Admin is on the Admin dashboard, THE AdminPage SHALL display an option to create a new Aggregator account alongside the existing option to create Agent and Admin accounts.
2. WHEN an Admin submits the create-Aggregator form with a valid name, email, password, and phone number, THE App SHALL create a Firebase Auth user and a corresponding Firestore document with `role: 'AGGREGATOR'` and a generated Aggregator_ID.
3. IF the email address provided for a new Aggregator is already registered in Firebase Auth, THEN THE AdminPage SHALL display the error message "Email already registered." and SHALL NOT create a duplicate account.
4. WHEN an Aggregator account is successfully created, THE AdminPage SHALL display the new Aggregator's generated Aggregator_ID to the Admin.
5. THE AdminPage SHALL list all Aggregator accounts separately from Agent accounts, showing each Aggregator's name, email, Aggregator_ID, and phone number.
6. WHEN an Admin selects the `AGENT` role in the "Add User" form, THE AdminPage SHALL display a State_Dropdown and a LGA_Dropdown as required fields in addition to name, email, password, Device ID, and phone.
7. WHEN an Admin selects a state in the "Add User" form, THE AdminPage SHALL populate the LGA_Dropdown with the Local Government Areas belonging to that state and SHALL reset any previously selected LGA.
8. WHILE no state is selected in the "Add User" form, THE AdminPage SHALL keep the LGA_Dropdown disabled.
9. WHEN an Admin submits the "Add User" form for an AGENT with a valid state and LGA selection, THE App SHALL write `profileStateId`, `profileStateName`, `profileLgaId`, and `profileLgaName` fields to the new Agent's Firestore user document.

---

### Requirement 3: Routing to AggregatorPage

**User Story:** As an Aggregator, I want to be directed to my own dashboard after logging in, so that I see only the features relevant to my role.

#### Acceptance Criteria

1. WHEN a user with `role: 'AGGREGATOR'` completes authentication via AuthPage, THE App SHALL render `AggregatorPage` instead of `AgentPage` or `AdminPage`.
2. WHEN an Aggregator logs in via the Login tab of AuthPage, THE AuthPage SHALL authenticate the Aggregator using the same login form used by Agents and Admins; the Aggregator Sign Up sub-tab is used only for new account creation, not for login.
3. WHILE a user's role is `'AGGREGATOR'`, THE App SHALL prevent access to `AgentPage` and `AdminPage`.
4. WHEN an Aggregator logs out, THE App SHALL redirect the user to `AuthPage`.

---

### Requirement 4: Agent Linking — Admin Assignment

**User Story:** As an Admin, I want to assign existing Agents to an Aggregator, so that the Aggregator can supervise those agents and view their reports.

#### Acceptance Criteria

1. WHEN an Admin views an Agent's record in the Admin dashboard, THE AdminPage SHALL display a control to assign that Agent to an Aggregator.
2. WHEN an Admin assigns an Agent to an Aggregator, THE App SHALL write the Aggregator's Firebase UID to the `aggregatorId` field on the Agent's Firestore user document.
3. WHEN an Admin assigns an Agent who is already linked to a different Aggregator, THE AdminPage SHALL display a confirmation prompt before overwriting the existing link.
4. WHEN an Admin removes an Agent's Aggregator assignment, THE App SHALL clear the `aggregatorId` field on the Agent's Firestore user document.
5. THE Users_Collection SHALL store the `aggregatorId` field (Firebase UID of the Aggregator) on Agent user documents to represent the Agent_Link.

---

### Requirement 5: Agent Linking — Aggregator-Initiated Link to Existing Agent

**User Story:** As an Aggregator, I want to search for agents who have already self-registered and link them to my account directly, so that existing agents can be brought under my supervision without requiring admin approval.

#### Acceptance Criteria

1. WHEN an Aggregator is on the AggregatorPage, THE AggregatorPage SHALL provide a search interface that accepts name, email, or Device ID as search terms and queries the Users_Collection for matching Agents who already have accounts.
2. WHEN an Aggregator submits a search with a non-empty term, THE AggregatorPage SHALL display matching Agents who have `role: 'AGENT'` and are not already linked to any Aggregator (i.e., their `aggregatorId` field is absent or null).
3. WHEN an Aggregator selects an unlinked Agent from search results and confirms the link, THE App SHALL immediately write the Aggregator's Firebase UID to the `aggregatorId` field on the Agent's Firestore user document.
4. WHEN the Agent_Link is successfully established, THE AggregatorPage SHALL display the newly linked Agent in the "My Agents" list without requiring a page reload.
5. IF the Firestore write fails when establishing the Agent_Link, THEN THE AggregatorPage SHALL display a descriptive error message and SHALL NOT update the local agent list.
6. IF an Aggregator attempts to link an Agent whose `aggregatorId` field has been set by another Aggregator between the time the search results were displayed and the time the link write is attempted (race condition), THEN THE App SHALL detect the conflict, display the error message "This agent is already linked to another aggregator.", and SHALL NOT overwrite the existing link.

---

### Requirement 5b: Agent Creation — Aggregator Creates New Agent Account

**User Story:** As an Aggregator, I want to create a new Agent account directly from my dashboard, so that I can onboard agents who have not yet self-registered and have them appear under my supervision immediately.

#### Acceptance Criteria

1. WHEN an Aggregator is on the AggregatorPage, THE AggregatorPage SHALL provide a "Create New Agent" form that accepts the agent's full name, email address, password, Device ID, phone number, state, and Local Government Area.
2. WHEN an Aggregator submits the Create New Agent form with valid inputs, THE App SHALL create a Firebase Auth user for the new Agent using a secondary Firebase Auth instance (to avoid signing out the Aggregator).
3. WHEN the Firebase Auth user is successfully created, THE App SHALL write a Firestore document to the Users_Collection with fields: `name`, `email`, `role: 'AGENT'`, `deviceId`, `phone`, `profileStateId`, `profileStateName`, `profileLgaId`, `profileLgaName`, `createdAt`, and `aggregatorId` set to the Aggregator's Firebase UID.
4. WHEN the new Agent document is written to the Users_Collection, THE AggregatorPage SHALL immediately display the new Agent in the "My Agents" list without requiring a page reload.
5. IF the email address provided for the new Agent is already registered in Firebase Auth, THEN THE AggregatorPage SHALL display the error message "Email already registered." and SHALL NOT create a duplicate account.
6. IF the Firebase Auth creation succeeds but the Firestore document write fails, THEN THE AggregatorPage SHALL display a descriptive error message indicating the account was partially created and SHALL NOT add the agent to the local "My Agents" list.
7. THE AggregatorPage SHALL validate that all seven fields (name, email, password, Device ID, phone, state, LGA) are non-empty before submitting the Create New Agent form.
8. WHEN an Aggregator selects a state in the Create New Agent form, THE AggregatorPage SHALL populate the LGA_Dropdown with the Local Government Areas belonging to that state and SHALL reset any previously selected LGA.
9. WHILE no state is selected in the Create New Agent form, THE AggregatorPage SHALL keep the LGA_Dropdown disabled.

---

### Requirement 6: Aggregator Dashboard — My Agents

**User Story:** As an Aggregator, I want to see a list of all agents linked to me — whether I created them directly or linked them after they self-registered — so that I know which agents I am supervising.

#### Acceptance Criteria

1. WHEN an Aggregator views the "My Agents" section of AggregatorPage, THE AggregatorPage SHALL query the Users_Collection for all documents where `aggregatorId` equals the Aggregator's Firebase UID and `role` equals `'AGENT'`.
2. THE AggregatorPage SHALL display each linked Agent's name, email, Device ID, and phone number regardless of whether the Agent was created by the Aggregator or linked after self-registration.
3. WHEN an Agent is created by the Aggregator via the Create New Agent form and the Firestore document is written with `aggregatorId` set, THE AggregatorPage SHALL include that Agent in the "My Agents" list even if the Agent has never logged in.
4. THE AggregatorPage SHALL NOT display edit, delete, or any mutation controls for Agent records.
5. WHEN no agents are linked to the Aggregator, THE AggregatorPage SHALL display a message indicating that no agents are currently assigned.
6. THE AggregatorPage SHALL display the Aggregator's own Aggregator_ID prominently on the dashboard.

---

### Requirement 7: Aggregator Dashboard — Enrollment Reports

**User Story:** As an Aggregator, I want to view enrollment submissions and monthly enrollment logs strictly for agents under me, so that I can monitor their performance without seeing data belonging to other aggregators' agents.

#### Acceptance Criteria

1. WHEN an Aggregator views the "Enrollment Reports" section of AggregatorPage, THE AggregatorPage SHALL query the Enrollments_Collection only for records where `agentId` is in the set of Agent UIDs whose Firestore user document has `aggregatorId` equal to the Aggregator's Firebase UID.
2. WHEN an Aggregator views the "Enrollment Log" section of AggregatorPage, THE AggregatorPage SHALL query the EnrollmentLogs_Collection only for records where `agentId` is in the set of Agent UIDs whose Firestore user document has `aggregatorId` equal to the Aggregator's Firebase UID.
3. THE AggregatorPage SHALL display enrollment records with the fields: date, agent name, state, LGA, ward, Device ID, daily figures, and issues/complaints.
4. THE AggregatorPage SHALL display enrollment log entries with the fields: agent name, month, year, and total enrollment.
5. THE AggregatorPage SHALL provide date-range and agent-name filter controls for the enrollment reports view.
6. THE AggregatorPage SHALL display a summary total of daily enrollment figures across all filtered records.
7. THE AggregatorPage SHALL NOT display enrollment records from the Enrollments_Collection for any Agent whose `aggregatorId` does not equal the Aggregator's Firebase UID.
8. THE AggregatorPage SHALL NOT display enrollment log entries from the EnrollmentLogs_Collection for any Agent whose `aggregatorId` does not equal the Aggregator's Firebase UID.
9. THE AggregatorPage SHALL NOT provide controls to edit or delete enrollment records or enrollment log entries.
10. WHEN an Aggregator has no linked agents, THE AggregatorPage SHALL display an empty state message in the reports section rather than querying Firestore with an empty agent set.

---

### Requirement 8: Firestore Security Rules

**User Story:** As a system operator, I want Firestore security rules to enforce role-based data access, so that Aggregators cannot read or write data outside their permitted scope.

#### Acceptance Criteria

1. THE Firestore_Rules SHALL permit an authenticated Aggregator to read Agent user documents only where the Agent's `aggregatorId` field equals the Aggregator's own Firebase UID.
2. THE Firestore_Rules SHALL permit an authenticated Aggregator to read enrollment records from the Enrollments_Collection only where the record's `agentId` belongs to an Agent whose `aggregatorId` equals the Aggregator's Firebase UID.
3. THE Firestore_Rules SHALL permit an authenticated Aggregator to read enrollment log entries from the EnrollmentLogs_Collection only where the entry's `agentId` belongs to an Agent whose `aggregatorId` equals the Aggregator's Firebase UID.
4. THE Firestore_Rules SHALL permit an authenticated Aggregator to write the `aggregatorId` field on an Agent's user document only where the Agent's `aggregatorId` field is currently unset (null or absent) and the value being written equals the Aggregator's own Firebase UID.
5. THE Firestore_Rules SHALL permit an Admin (acting via a secondary Firebase Auth instance on behalf of an Aggregator) to create a new Agent user document in the Users_Collection with `role: 'AGENT'` and `aggregatorId` set to the Aggregator's Firebase UID.
6. THE Firestore_Rules SHALL deny write access to any other fields on Agent user documents by Aggregators.
7. THE Firestore_Rules SHALL deny write access to enrollment records and enrollment log entries by Aggregators.

---

### Requirement 9: Aggregator Profile

**User Story:** As an Aggregator, I want to view my own profile information including my Aggregator ID, so that I can confirm my account details.

#### Acceptance Criteria

1. WHEN an Aggregator views the "My Profile" section of AggregatorPage, THE AggregatorPage SHALL display the Aggregator's name, email, phone number, and Aggregator_ID.
2. THE AggregatorPage SHALL display the Aggregator_ID as a read-only field that cannot be edited by the Aggregator.
3. WHEN an Aggregator updates their phone number and saves, THE App SHALL write the updated `phone` value to the Aggregator's Firestore user document.
4. IF the phone number update fails due to a Firestore write error, THEN THE AggregatorPage SHALL display a descriptive error message and SHALL NOT update the local state.

---

### Requirement 10: State and LGA Collection on All Agent Registration Forms

**User Story:** As a system operator, I want every agent registration path to capture the agent's State and Local Government Area, so that geographic data is consistently stored on all agent profiles regardless of how the account was created.

#### Acceptance Criteria

1. THE AuthPage SHALL include a State_Dropdown and a LGA_Dropdown as required fields in the self-registration (Sign Up) form, in addition to the existing name, Device ID, phone, email, and password fields.
2. WHEN a registering agent selects a state on the AuthPage Sign Up form, THE AuthPage SHALL populate the LGA_Dropdown with the Local Government Areas belonging to that state and SHALL reset any previously selected LGA.
3. WHILE no state is selected on the AuthPage Sign Up form, THE AuthPage SHALL keep the LGA_Dropdown disabled.
4. WHEN a new Agent self-registers via the AuthPage Sign Up form, THE App SHALL write `profileStateId`, `profileStateName`, `profileLgaId`, and `profileLgaName` fields to the new Agent's Firestore user document alongside the existing `name`, `email`, `role`, `deviceId`, `phone`, and `createdAt` fields.
5. THE AdminPage "Add User" form SHALL include a State_Dropdown and a LGA_Dropdown as required fields when the selected role is `AGENT` (as specified in Requirement 2, criteria 6–9).
6. THE AggregatorPage "Create New Agent" form SHALL include a State_Dropdown and a LGA_Dropdown as required fields (as specified in Requirement 5b, criteria 1 and 7–9).
7. THE App SHALL load GeoData using the existing `loadGeoData()` utility from `geoData.ts` to populate State_Dropdown and LGA_Dropdown controls on all agent registration forms.
8. WHEN any agent registration form is submitted, THE App SHALL reject the submission and display a validation error if the state or LGA field is empty.


---

### Requirement 11: Aggregator Self-Registration

**User Story:** As a prospective Aggregator, I want to create my own account via a dedicated sign-up tab on the login page, so that I can register without requiring an Admin to create my account manually.

#### Acceptance Criteria

1. WHEN the AuthPage is in Sign Up mode, THE AuthPage SHALL display two Sign_Up_Sub_Tabs: "Agent Sign Up" and "Aggregator Sign Up", allowing the user to choose which registration flow to complete.
2. WHEN the "Agent Sign Up" sub-tab is selected, THE AuthPage SHALL display the existing Agent registration form unchanged (name, email, password, confirm password, Device ID, phone, state, LGA).
3. WHEN the "Aggregator Sign Up" sub-tab is selected, THE AuthPage SHALL display the Aggregator_Sign_Up_Form with the following required fields: full name, email address, password, confirm password, phone number, State_Dropdown, and LGA_Dropdown.
4. THE Aggregator_Sign_Up_Form SHALL NOT include a Device ID field.
5. WHEN a prospective Aggregator submits the Aggregator_Sign_Up_Form with valid inputs, THE App SHALL create a Firebase Auth user for the new Aggregator.
6. WHEN the Firebase Auth user is successfully created during Aggregator self-registration, THE App SHALL write a Firestore document to the Users_Collection with fields: `name`, `email`, `role: 'AGGREGATOR'`, `aggregatorId` (generated via the same atomic ID_Counter transaction as admin-created Aggregators), `phone`, `profileStateId`, `profileStateName`, `profileLgaId`, `profileLgaName`, and `createdAt`.
7. WHEN an Aggregator self-registers and selects a state on the Aggregator_Sign_Up_Form, THE AuthPage SHALL populate the LGA_Dropdown with the Local Government Areas belonging to that state and SHALL reset any previously selected LGA.
8. WHILE no state is selected on the Aggregator_Sign_Up_Form, THE AuthPage SHALL keep the LGA_Dropdown disabled.
9. WHEN Aggregator self-registration completes successfully, THE App SHALL authenticate the new Aggregator and route them to AggregatorPage without requiring a separate login step.
10. IF the email address provided on the Aggregator_Sign_Up_Form is already registered in Firebase Auth, THEN THE AuthPage SHALL display the error message "Email already registered." and SHALL NOT create a duplicate account.
11. IF the password and confirm password fields on the Aggregator_Sign_Up_Form do not match, THEN THE AuthPage SHALL display the error message "Passwords do not match." and SHALL NOT submit the form.
12. WHEN the Aggregator_Sign_Up_Form is submitted with an empty state or LGA field, THE AuthPage SHALL reject the submission and display a validation error indicating that state and LGA are required.
13. THE App SHALL load GeoData using the existing `loadGeoData()` utility from `geoData.ts` to populate the State_Dropdown and LGA_Dropdown on the Aggregator_Sign_Up_Form.

---

### Requirement 12: Agent Exclusive Ownership

**User Story:** As a system operator, I want each Agent to be linked to at most one Aggregator at any time, so that supervision responsibilities are unambiguous and two Aggregators cannot simultaneously claim the same Agent.

#### Acceptance Criteria

1. THE Users_Collection SHALL ensure that an Agent document's `aggregatorId` field holds at most one Aggregator's Firebase UID at any given time.
2. THE Firestore_Rules SHALL permit an Aggregator to write the `aggregatorId` field on an Agent document only when that field is currently absent or null, enforcing exclusive ownership at the database level.
3. WHEN an Aggregator attempts to link an Agent who is already linked to another Aggregator — whether detected client-side from stale search results or server-side via Firestore rule rejection — THE App SHALL display the error message "This agent is already linked to another aggregator." and SHALL NOT proceed with the write.
4. WHEN an Aggregator creates a new Agent via the Create New Agent form and the Firestore document is written with `aggregatorId` set to the Aggregator's Firebase UID, THE App SHALL consider that Agent exclusively owned by that Aggregator from the moment of creation.
5. WHEN an Admin assigns an Agent from one Aggregator to another via the Admin dashboard (Requirement 4), THE App SHALL treat this as an intentional administrative override and SHALL permit the reassignment after the confirmation prompt, regardless of the exclusive ownership constraint that applies to Aggregator-initiated writes.
