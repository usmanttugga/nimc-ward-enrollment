# Implementation Plan: NIMC Ward Enrollment Portal

## Overview

Incremental build-out of the full-stack portal: database schema → backend API (auth, enrollment, admin, notifications, export) → React frontend (agent UI, admin UI, shared components). Each task wires into the previous, ending with a fully integrated application.

## Tasks

- [x] 1. Project scaffolding and database schema
  - Initialise monorepo with `backend/` (Node.js/Express/TypeScript) and `frontend/` (Vite/React/TypeScript/Tailwind) directories
  - Add Prisma to backend; write `schema.prisma` with all models: State, Lga, Ward, User (Role, UserStatus enums), DailySubmission (SubmissionStatus enum), Notification (NotificationType enum), and `User.revokedAt DateTime?`
  - Run initial migration and generate Prisma client
  - Add seed script for States, LGAs, and Wards reference data
  - _Requirements: 3.1, 3.3, 4.2, 8.1_

- [ ] 2. Authentication API
  - [x] 2.1 Implement `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`
    - Validate email + password with zod; compare bcrypt hash; issue 30-min JWT access token + HTTP-only refresh cookie
    - Write `authenticate` middleware: verify JWT signature, check `exp`, reject tokens where `iat < user.revokedAt`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test for valid credentials produce a session (Property 1)
    - **Property 1: Valid credentials produce a session**
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test for invalid credentials produce no session (Property 2)
    - **Property 2: Invalid credentials produce no session**
    - **Validates: Requirements 1.3**

  - [ ]* 2.4 Write property test for expired/revoked tokens rejected on all protected routes (Property 3)
    - **Property 3: Expired tokens are rejected on all protected routes**
    - **Validates: Requirements 1.4, 1.6**

- [ ] 3. Role-based access control middleware
  - [x] 3.1 Implement `authorize(role)` middleware and apply to all protected routes
    - Agent tokens on admin routes → 403; Admin tokens on agent routes → read-only flag passed to handler
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.2 Write property test for role checks enforced on every protected endpoint (Property 4)
    - **Property 4: Role checks enforced on every protected endpoint**
    - **Validates: Requirements 2.2, 2.4**

  - [ ]* 3.3 Write property test for every user has exactly one valid role (Property 5)
    - **Property 5: Every user has exactly one valid role**
    - **Validates: Requirements 2.1**

- [x] 4. Checkpoint — Ensure auth and RBAC tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Geographic reference data API and agent profile
  - [ ] 5.1 Implement `GET /admin/dashboard/states`, `GET /admin/dashboard/states/:id/lgas`, `GET /admin/dashboard/lgas/:id/wards`
    - Return hierarchical geo data for dropdowns and drill-down table
    - _Requirements: 3.1, 6.2, 6.3, 6.4_

  - [ ] 5.2 Implement agent profile endpoint (included in JWT payload / `GET /auth/me`)
    - Return authenticated agent's wardId, ward name, LGA name, state name
    - _Requirements: 3.2, 4.1_

  - [ ]* 5.3 Write property test for agent accounts always have complete geographic assignment (Property 6)
    - **Property 6: Agent accounts always have a complete geographic assignment**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [ ] 6. Enrollment submission API
  - [ ] 6.1 Implement `POST /enrollment/submissions`
    - Validate with zod: all required fields present, `maleCount + femaleCount === totalEnrollees`; upsert on `(agentId, enrollmentDate)` unique constraint
    - Snapshot `wardId` from agent at submission time
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.2 Write property test for valid enrollment submission is persisted and retrievable (Property 9)
    - **Property 9: Valid enrollment submission is persisted and retrievable**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 6.3 Write property test for invalid enrollment submissions are rejected without persistence (Property 10)
    - **Property 10: Invalid enrollment submissions are rejected without persistence**
    - **Validates: Requirements 4.4, 4.5**

  - [ ] 6.4 Implement `PUT /enrollment/submissions/:id` (same-day edit)
    - Enforce same-day constraint (enrollmentDate must equal today); re-validate totals
    - _Requirements: 4.6, 4.7_

  - [ ]* 6.5 Write property test for same-day submission is editable; edit form shows last-saved values (Property 11)
    - **Property 11: Same-day submission is editable; edit form shows last-saved values**
    - **Validates: Requirements 4.6, 4.7**

  - [ ] 6.6 Implement `GET /enrollment/submissions` (agent history)
    - Return all submissions for authenticated agent, sorted descending by `enrollmentDate`, with required fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.7 Write property test for agent submission history is complete, ordered, and contains required fields (Property 12)
    - **Property 12: Agent submission history is complete, ordered, and contains required fields**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 7. Checkpoint — Ensure enrollment API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Admin dashboard and records API
  - [ ] 8.1 Implement `GET /admin/dashboard/stats`
    - Aggregate today's totalEnrollees, totalSubmissions, activeAgents from DailySubmissions
    - _Requirements: 6.1_

  - [ ]* 8.2 Write property test for dashboard stats correctly aggregate today's data (Property 13)
    - **Property 13: Dashboard stats correctly aggregate today's data**
    - **Validates: Requirements 6.1**

  - [ ]* 8.3 Write property test for drill-down aggregations are consistent with flat totals (Property 14)
    - **Property 14: Drill-down aggregations are consistent with flat totals**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [ ] 8.4 Implement `GET /admin/records` with filter support (State, LGA, Ward, Agent, date range)
    - Build dynamic Prisma `where` clause from query params; include agent name and ward in response
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.5 Write property test for admin records endpoint returns all submissions matching applied filters (Property 15)
    - **Property 15: Admin records endpoint returns all submissions matching applied filters**
    - **Validates: Requirements 7.1, 7.2, 7.4**

  - [ ] 8.6 Implement `PUT /admin/records/:id/flag`
    - Update submission status to `UNDER_REVIEW`, persist `flagReason`, create `SUBMISSION_FLAGGED` notification for agent
    - _Requirements: 7.5, 7.6_

  - [ ]* 8.7 Write property test for flagging a submission updates its status and notifies the agent (Property 16)
    - **Property 16: Flagging a submission updates its status and notifies the agent**
    - **Validates: Requirements 7.5, 7.6, 9.4**

- [ ] 9. CSV export API
  - [ ] 9.1 Implement `GET /admin/export/csv` with streaming response
    - Apply same filter logic as `/admin/records`; stream via `csv-stringify`; reject with 404 if zero records
    - Required columns: enrollmentDate, agentName, ward, LGA, state, totalEnrollees, maleCount, femaleCount, submissionStatus
    - _Requirements: 7.7, 10.1, 10.2, 10.3, 10.4_

  - [ ]* 9.2 Write property test for CSV export contains exactly the filtered records with all required columns (Property 17)
    - **Property 17: CSV export contains exactly the filtered records with all required columns**
    - **Validates: Requirements 7.7, 10.1, 10.3**

  - [ ]* 9.3 Write property test for empty export is rejected with an informational message (Property 18)
    - **Property 18: Empty export is rejected with an informational message**
    - **Validates: Requirements 10.4**

- [ ] 10. Agent account management API
  - [ ] 10.1 Implement `GET /admin/agents` and `POST /admin/agents`
    - List all agents with name, email, ward, status; create agent with ward validation; send password-setup email via emailService; create `AGENT_CREATED` notifications for all admins
    - _Requirements: 8.1, 8.2, 8.4, 9.5_

  - [ ]* 10.2 Write property test for agent creation without ward assignment is rejected (Property 7)
    - **Property 7: Agent creation without ward assignment is rejected**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 10.3 Write property test for agent creation triggers a password-setup email (Property 20)
    - **Property 20: Agent creation triggers a password-setup email**
    - **Validates: Requirements 8.2**

  - [ ]* 10.4 Write property test for duplicate email is rejected on agent creation (Property 22)
    - **Property 22: Duplicate email is rejected on agent creation**
    - **Validates: Requirements 8.4**

  - [ ]* 10.5 Write property test for admin notification on agent creation (Property 26)
    - **Property 26: Admin notification on agent creation**
    - **Validates: Requirements 9.5**

  - [ ] 10.6 Implement `PUT /admin/agents/:id` (update, deactivate, reassign)
    - On deactivation: set `status = INACTIVE`, write `revokedAt = now()`
    - On ward reassignment: update `agent.wardId` only; do not touch existing DailySubmission records
    - _Requirements: 8.3, 8.5, 8.6_

  - [ ]* 10.7 Write property test for deactivated agent tokens are rejected (Property 21)
    - **Property 21: Deactivated agent tokens are rejected**
    - **Validates: Requirements 8.3**

  - [ ]* 10.8 Write property test for ward reassignment preserves historical submissions (Property 23)
    - **Property 23: Ward reassignment preserves historical submissions**
    - **Validates: Requirements 8.5, 8.6**

  - [ ] 10.9 Implement `GET /admin/agents` list completeness
    - Ensure response includes all required fields per Property 19
    - _Requirements: 8.1_

  - [ ]* 10.10 Write property test for agent list is complete and contains required fields (Property 19)
    - **Property 19: Agent list is complete and contains required fields**
    - **Validates: Requirements 8.1**

- [ ] 11. Checkpoint — Ensure admin and agent management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Notifications API and SSE stream
  - [ ] 12.1 Implement `GET /notifications` and `PUT /notifications/:id/read`
    - Return all notifications for authenticated user sorted descending by `createdAt`; mark as read and return updated unread count
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 12.2 Write property test for unread notification count is accurate (Property 24)
    - **Property 24: Unread notification count is accurate**
    - **Validates: Requirements 9.1, 9.3**

  - [ ]* 12.3 Write property test for notifications are returned in reverse chronological order (Property 25)
    - **Property 25: Notifications are returned in reverse chronological order**
    - **Validates: Requirements 9.2**

  - [ ] 12.4 Implement `GET /notifications/stream` SSE endpoint
    - Open SSE connection per authenticated user; push new notification events when created; close on client disconnect
    - _Requirements: 9.1, 9.4, 9.5_

- [ ] 13. Frontend — shared infrastructure
  - [ ] 13.1 Configure Vite + React + TypeScript + Tailwind; set up React Query client and axios instance with JWT interceptor (auto-attach access token, handle 401 → refresh → retry)
    - _Requirements: 1.4, 1.6_

  - [ ] 13.2 Implement `useAuth` hook: login, logout, token storage, session expiry redirect
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [ ] 13.3 Implement `LoginPage` with email/password form and error display
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 13.4 Implement protected route wrapper with role-based redirect
    - _Requirements: 1.6, 2.2, 2.3_

- [ ] 14. Frontend — Agent UI
  - [ ] 14.1 Implement `EnrollmentForm` component
    - Pre-populate ward/LGA/state/date from agent profile; controlled inputs with client-side validation (required fields, male+female=total); submit via React Query mutation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 14.2 Implement agent `DashboardPage` — show today's submission or empty form; show existing submission with edit option after first submit
    - _Requirements: 4.6, 4.7_

  - [ ] 14.3 Implement `SubmissionHistoryPage` — list all past submissions in reverse chronological order; click to view full detail
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 14.4 Implement `ProfilePage` — display agent name, email, ward, LGA, state
    - _Requirements: 3.2_

- [ ] 15. Frontend — Admin UI
  - [ ] 15.1 Implement admin `DashboardPage` — stats cards (totalEnrollees, totalSubmissions, activeAgents) + refresh button + `DrillDownTable` (State → LGA → Ward)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 15.2 Implement `EnrollmentRecordsPage` — `FilterBar` (State/LGA/Ward/Agent/date range) + records table + flag modal with mandatory reason field + `ExportButton`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_

  - [ ] 15.3 Implement `AgentManagementPage` — agent list table + create agent form (State/LGA/Ward cascade dropdowns) + deactivate/reassign actions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 15.4 Implement `NotificationsPage` — full notification list with read/unread status
    - _Requirements: 9.2_

- [ ] 16. Frontend — Notification bell and SSE integration
  - [ ] 16.1 Implement `NotificationBell` component with unread count badge
    - _Requirements: 9.1_

  - [ ] 16.2 Implement `useNotifications` hook — open SSE connection to `/notifications/stream`; update React Query cache on new event; expose unread count
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

  - [ ] 16.3 Wire `NotificationBell` and `useNotifications` into the shared navigation bar for both Agent and Admin layouts
    - _Requirements: 9.1, 9.3_

- [ ] 17. Frontend — CSV export wiring
  - [ ] 17.1 Implement `ExportButton` component — trigger `GET /admin/export/csv` with current filter params; handle streaming download via `<a>` blob URL; display informational message on 404 (no records)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with `numRuns: 100` and the tag format: `// Feature: nimc-ward-enrollment-portal, Property {N}: {property_text}`
- Unit tests and property tests run under Vitest; API tests use `supertest` against a test database
- Email service is mocked with `vi.mock` in all tests
- SSE notifications are verified via DB assertions rather than live stream testing
