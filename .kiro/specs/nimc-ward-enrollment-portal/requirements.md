# Requirements Document

## Introduction

The NIMC Ward Enrollment Portal is a web-based SaaS application that enables NIMC (National Identity Management Commission) agents to collect and submit daily enrollment data at the ward level. Admins can monitor, manage, and oversee all enrollment submissions across wards, agents, and local government areas. The portal supports two primary roles: Agent and Admin.

## Glossary

- **Agent**: A field officer authorized by NIMC to collect and submit enrollment data at the ward level.
- **Admin**: A NIMC staff member with elevated privileges to view, manage, and oversee all enrollment data and agents.
- **Enrollment Record**: A single individual's enrollment data collected by an agent during a session.
- **Daily Submission**: The batch of enrollment records submitted by an agent for a given calendar day.
- **Ward**: The lowest administrative unit at which enrollment data is collected.
- **LGA**: Local Government Area — the administrative unit above a ward.
- **State**: The administrative unit above an LGA.
- **Portal**: The NIMC Ward Enrollment SaaS web application.
- **Dashboard**: The role-specific landing page shown after login.
- **Session**: An authenticated user's active interaction period with the Portal.

---

## Requirements

### Requirement 1: User Authentication

**User Story:** As an Agent or Admin, I want to securely log in to the Portal, so that only authorized users can access enrollment data.

#### Acceptance Criteria

1. THE Portal SHALL provide a login page accessible at the root URL requiring an email address and password.
2. WHEN an Agent or Admin submits valid credentials, THE Portal SHALL create an authenticated Session and redirect the user to their role-specific Dashboard.
3. WHEN an Agent or Admin submits invalid credentials, THE Portal SHALL display an error message and SHALL NOT create a Session.
4. WHEN a Session is inactive for 30 consecutive minutes, THE Portal SHALL invalidate the Session and redirect the user to the login page.
5. THE Portal SHALL enforce HTTPS for all authentication requests.
6. IF an Agent or Admin attempts to access a protected page without an active Session, THEN THE Portal SHALL redirect the user to the login page.

---

### Requirement 2: Role-Based Access Control

**User Story:** As a system administrator, I want role-based access control enforced, so that Agents and Admins can only access features appropriate to their role.

#### Acceptance Criteria

1. THE Portal SHALL assign each user account exactly one role: Agent or Admin.
2. WHEN an authenticated Agent attempts to access an Admin-only page, THE Portal SHALL return a 403 Forbidden response and display an access-denied message.
3. WHEN an authenticated Admin attempts to access the Agent enrollment submission page, THE Portal SHALL display a read-only view of that page.
4. THE Portal SHALL enforce role checks on every protected API endpoint.

---

### Requirement 3: Agent Profile and Ward Assignment

**User Story:** As an Agent, I want my profile to be linked to a specific ward, so that my enrollment submissions are correctly attributed to the right administrative location.

#### Acceptance Criteria

1. THE Portal SHALL associate each Agent account with exactly one Ward, one LGA, and one State at the time of account creation.
2. WHEN an Agent views their profile page, THE Portal SHALL display the Agent's assigned Ward, LGA, and State.
3. WHEN an Admin creates an Agent account, THE Portal SHALL require selection of a State, LGA, and Ward before the account is saved.
4. IF an Admin attempts to save an Agent account without a Ward assignment, THEN THE Portal SHALL display a validation error and SHALL NOT save the account.

---

### Requirement 4: Daily Enrollment Data Submission (Agent)

**User Story:** As an Agent, I want to submit daily enrollment data for my ward, so that NIMC can track enrollment progress at the ward level.

#### Acceptance Criteria

1. WHEN an authenticated Agent accesses the enrollment submission page, THE Portal SHALL display a form pre-populated with the Agent's assigned Ward, LGA, State, and the current calendar date.
2. THE Enrollment_Form SHALL collect the following fields per submission: enrollment date, total enrollees count, male count, female count, and optional remarks.
3. WHEN an Agent submits the Enrollment_Form with all required fields valid, THE Portal SHALL save the Daily Submission and display a success confirmation.
4. IF an Agent submits the Enrollment_Form with missing required fields, THEN THE Portal SHALL highlight the missing fields and display a descriptive validation error without saving the record.
5. IF the sum of male count and female count does not equal the total enrollees count, THEN THE Portal SHALL display a validation error and SHALL NOT save the Daily Submission.
6. WHEN an Agent has already submitted a Daily Submission for the current date, THE Portal SHALL display the existing submission and allow the Agent to edit it until 11:59 PM of that calendar day.
7. WHILE an Agent is editing an existing Daily Submission, THE Portal SHALL display the last-saved values in the form fields.

---

### Requirement 5: Agent Submission History

**User Story:** As an Agent, I want to view my past enrollment submissions, so that I can track my own activity and verify submitted data.

#### Acceptance Criteria

1. THE Portal SHALL provide an Agent submission history page listing all Daily Submissions made by the authenticated Agent.
2. WHEN an Agent views the submission history page, THE Portal SHALL display each record with enrollment date, total enrollees, male count, female count, and submission timestamp.
3. THE Portal SHALL display submission history records in reverse chronological order by enrollment date.
4. WHEN an Agent selects a past Daily Submission, THE Portal SHALL display the full details of that submission.

---

### Requirement 6: Admin Dashboard and Overview

**User Story:** As an Admin, I want a dashboard showing enrollment statistics, so that I can monitor progress across all wards, LGAs, and states.

#### Acceptance Criteria

1. WHEN an authenticated Admin accesses the Dashboard, THE Portal SHALL display aggregate enrollment statistics including total enrollees, total submissions, and active agents for the current day.
2. THE Dashboard SHALL display a summary table of Daily Submissions grouped by State, with columns for State name, total enrollees, and submission count.
3. WHEN an Admin selects a State from the summary table, THE Portal SHALL display a drill-down view showing LGA-level statistics for that State.
4. WHEN an Admin selects an LGA from the drill-down view, THE Portal SHALL display ward-level statistics for that LGA.
5. THE Portal SHALL refresh Dashboard statistics without requiring a full page reload when the Admin clicks a refresh button.

---

### Requirement 7: Admin Enrollment Data Management

**User Story:** As an Admin, I want to view and manage all enrollment submissions, so that I can ensure data quality and resolve discrepancies.

#### Acceptance Criteria

1. THE Portal SHALL provide an Admin enrollment records page listing all Daily Submissions across all agents, wards, LGAs, and states.
2. WHEN an Admin views the enrollment records page, THE Portal SHALL support filtering by State, LGA, Ward, Agent, and date range.
3. WHEN an Admin applies a filter, THE Portal SHALL update the records list within 2 seconds.
4. WHEN an Admin selects a Daily Submission, THE Portal SHALL display the full submission details including the submitting Agent's name and ward assignment.
5. THE Portal SHALL allow an Admin to flag a Daily Submission as "Under Review" with a mandatory reason field.
6. WHEN an Admin flags a Daily Submission as "Under Review", THE Portal SHALL notify the submitting Agent via an in-portal notification.
7. THE Portal SHALL allow an Admin to export the filtered enrollment records list as a CSV file.

---

### Requirement 8: Agent Account Management (Admin)

**User Story:** As an Admin, I want to create and manage Agent accounts, so that I can control who has access to submit enrollment data.

#### Acceptance Criteria

1. THE Portal SHALL provide an Admin agent management page listing all Agent accounts with their name, email, assigned ward, and account status.
2. WHEN an Admin creates a new Agent account, THE Portal SHALL send a password-setup email to the Agent's registered email address.
3. WHEN an Admin deactivates an Agent account, THE Portal SHALL immediately invalidate any active Sessions for that Agent and prevent future logins.
4. IF an Admin attempts to create an Agent account with an email address already registered in the Portal, THEN THE Portal SHALL display a duplicate email error and SHALL NOT create the account.
5. THE Portal SHALL allow an Admin to reassign an Agent to a different Ward, LGA, and State.
6. WHEN an Admin reassigns an Agent's ward, THE Portal SHALL preserve all historical Daily Submissions under the Agent's previous ward assignment.

---

### Requirement 9: In-Portal Notifications

**User Story:** As an Agent or Admin, I want to receive in-portal notifications for relevant events, so that I stay informed without leaving the Portal.

#### Acceptance Criteria

1. THE Portal SHALL display a notification indicator in the navigation bar showing the count of unread notifications for the authenticated user.
2. WHEN a user opens the notification panel, THE Portal SHALL display all notifications in reverse chronological order with a read/unread status.
3. WHEN a user marks a notification as read, THE Portal SHALL update the unread count immediately.
4. THE Portal SHALL deliver in-portal notifications to Agents when their Daily Submission is flagged as "Under Review".
5. THE Portal SHALL deliver in-portal notifications to Admins when a new Agent account is created.

---

### Requirement 10: Data Export and Reporting

**User Story:** As an Admin, I want to export enrollment data, so that I can generate reports for NIMC management.

#### Acceptance Criteria

1. THE Portal SHALL allow an Admin to export enrollment records as a CSV file containing enrollment date, agent name, ward, LGA, state, total enrollees, male count, female count, and submission status.
2. WHEN an Admin requests a CSV export, THE Portal SHALL generate and download the file within 10 seconds for result sets up to 10,000 records.
3. THE Portal SHALL allow an Admin to select a date range before initiating an export, defaulting to the current calendar month.
4. IF an export is requested for a date range with no records, THEN THE Portal SHALL display an informational message and SHALL NOT generate an empty file.
