# Phase 1 – PWA Architecture & Model Discovery

## Executive Summary

- The FastAPI backend exposes a broad set of domain routers with JWT-based authentication and a detailed RBAC matrix (`utils/rbac.py`). Branch isolation is enforced through shared utilities, but permission checks are inconsistently applied (some endpoints rely on raw role strings instead of the `Permission` enum), and the frontend calls `/auth/*` and `/rbac/*` endpoints that are not currently implemented server-side.
- Core MongoDB collections already exist for students, parents, teachers, classes, attendance, exams/grades, payments, notifications, and timetables. Relationships depend heavily on string identifiers (`student_id`, `teacher_id`, `class_id`) and `branch_id`. Phase 2 mobile flows will need to respect these identifiers, branch filters, and helper services (e.g., automatic parent creation and WebSocket broadcasts).
- The React/Vite frontend wraps the app with TanStack Query and multiple context providers (auth, permissions, branch selection, notifications, WebSocket). A monolithic API client (`src/lib/api.ts`) manages token refresh and hundreds of endpoints, but it targets `/auth/*` and `/rbac/*` routes that do not exist yet, stores tokens in `localStorage`, and assumes desktop-oriented components that will need responsive tuning for a PWA.
- Configuration spans both stacks: backend relies on `MONGODB_URI`, `JWT_SECRET_KEY`, email/SMS/push provider keys, and websocket hosting; the frontend expects `VITE_API_BASE_URL` and `VITE_WS_URL`. Mobile builds must ensure these values are injected consistently across environments.
- Key Phase 2 goals include aligning API contracts (OTP login, `/auth/me`, `/rbac` data, assignment endpoints), normalizing RBAC enforcement, exposing lighter mobile-friendly aggregates, addressing token storage security for mobile, and planning offline/data-sync behaviour.

## Backend API & RBAC Landscape

### Authentication and RBAC
- `backend/app/utils/auth.py` handles password hashing (`bcrypt` with 12 rounds) and JWT creation (`HS256`, default 24 h expiry). `JWT_SECRET_KEY` should be supplied via environment; otherwise a random key is generated per boot.
- The `users` router (`/users`) provides signup, password login, change-password, role management, and `get_current_user`. Login returns `{access_token, token_type, user}`. Rate limiting is enforced by `utils/rate_limit`.
- RBAC is defined in `utils/rbac.py`:
  - Roles: `super_admin`, `hq_admin`, `branch_admin`, `hq_registrar`, `registrar`, legacy `admin`, `teacher`, `student`, `parent` (with alias handling for `superadmin`).
  - Permissions (80+ enum values) cover CRUD scopes across students, classes, attendance, payments, grades, communication, inventory, reports, etc.
  - Helper decorators `require_permission`, `require_role`, `require_min_role_level`, and `require_same_branch_or_hq` exist, alongside `ResourcePermissionChecker` for field-level filtering and self-access controls.
- Observations:
  - Several routers (e.g., `teachers.py`, `classes.py`) still gate actions with hard-coded role strings instead of `Permission` checks, creating inconsistent enforcement.
  - The frontend relies on `/auth/me`, `/auth/refresh`, and `/rbac/me/permissions` endpoints. Only `/users/me` and `/permissions/me` currently exist, so either new endpoints must be added or the client must be updated.

### Branch-aware Isolation
- `utils/branch_context.py` centralizes branch isolation, offering `BranchContext.add_branch_filter`, `ensure_branch_compatibility`, and `BranchFilter` dependencies. HQ roles bypass restrictions, while branch roles are forced to operate within their `branch_id`.
- Many routers have dedicated `*_branch_aware.py` variants that automatically apply branch filters and cross-branch validation.
- Middleware helpers (`BranchIsolationMiddleware`) and validation utilities (`validate_branch_id`, `validate_teacher_id`, etc.) prevent cross-branch data leaks.

### Endpoint Survey
| Domain | Router(s) / Prefix | Key Capabilities | Access Notes & PWA Considerations |
| --- | --- | --- | --- |
| Authentication & Users | `/users`, `/permissions` | Email/password login, JWT issuance, signup (admin-only), change password, user CRUD, permission introspection | Management routes enforce `CREATE/READ/UPDATE/DELETE_USER` + `MANAGE_ROLES`. Login is rate-limited. Frontend OTP flow expects `/auth/login-with-otp`, `/auth/send-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/refresh` — these endpoints are currently missing. |
| Branch Management | `/branches`, `/branches_dynamic` | List/manage branches, branch cache utilities | Super Admin/HQ roles manage branches; branch users restricted to assigned branch. Mobile client must surface selected `branch_id` with every request. |
| Students & Parents | `/students`, `/students_branch_aware`, `/parents` | Student CRUD, search, stats, duplicate detection, parent auto-provisioning, parent ↔ student linking | Create requires `Permission.CREATE_STUDENT`; listing is branch-filtered. Update/delete paths lack explicit permission checks. Parent creation reuses student permissions and auto-creates parent accounts via `ParentService`. |
| Teachers | `/teachers`, `/teachers_enhanced`, `/teachers_branch_aware` | Teacher CRUD, class roster synchronization, enhanced teacher data, analytics | Creation currently checks hard-coded roles (`admin`/`superadmin`) instead of `Permission.CREATE_TEACHER`. Branch isolation enforced manually; ensure PWA propagates branch context. |
| Classes & Enrollment | `/classes`, `/grade-levels`, `/grade-transitions`, `/student-enrollments` | Create/update classes, assign subject teachers, manage grade levels/transitions, enrollments | Class creation limited to admin-class roles with branch validation. Extensive cross-collection validation. Mobile workflows will need grade-level IDs and to honor teacher and subject references. |
| Attendance | `/attendance`, `/attendance_branch_aware` | Individual/bulk attendance, summaries, pattern analytics, alerts | Uses `Permission.CREATE/READ/UPDATE_ATTENDANCE` plus branch filters. Endpoints accept `attendance_date`, `class_id`, `subject_id`; notifications optional. |
| Grades & Exams | `/exams`, `/exam-results`, `/grade-transitions` | Exam scheduling, grading, report cards, analytics, transcript generation | Requires grade permissions (`CREATE_GRADE` etc.). `exam_type` supports quizzes, assignments, projects—useful for a PWA assignments module. Heavy payloads; consider lighter mobile serializers. |
| Payments & Fees | `/payments`, `/payment_reports`, `/payment_receipts`, `/payment_bulk_import`, `/fee-categories`, `/registration-payments` | Payment CRUD, receipts, reports, fee templates, bulk import | Protected by financial permissions (`CREATE/READ_PAYMENT`, `VIEW_FINANCIAL_REPORTS`), branch-scoped. Decimal fields serialized as strings. Bulk endpoints may need mobile-safe pagination. |
| Messaging & Notifications | `/communication`, `/notifications`, `/notifications_branch_aware`, `/permissions` | Announcements, messages, notification templates, recipient tracking, delivery via email/SMS/push | Channels controlled via notification services (email, SMS, push). Permissions include `SEND_MESSAGES`, `CREATE_ANNOUNCEMENTS`, `MANAGE_NOTIFICATIONS`. WebSocket + Firebase hooks rely on device registrations. |
| Timetable & Calendar | `/timetable`, `/academic-calendar`, `/enhanced_calendar` | Weekly timetables, time slots, substitution management, academic events | Branch-specific schedules with conflict detection. PWA needs compact endpoints for daily timetable and event feeds. |

## Core Data Model Mapping
| Collection / Model | Key Identifiers & Relationships | Mobile-Relevant Fields | Notes & Considerations |
| --- | --- | --- | --- |
| `students` (`Student`) | `_id`, `student_id` (human-readable), `class_id`, `parent_guardian_id`, `branch_id` | Demographics, contacts, `grade_level`, `status`, document URLs, timestamps | Dates stored as `datetime`; class info populated via helper; ensure PWA sends/receives ISO timestamps and respects branch scope. |
| `parents` (`Parent`) | `_id`, `student_ids[]`, `user_id`, `branch_id` | Father/mother/guardian contacts, emergency info | Parent creation links students and can auto-create a user; PWA must handle linking/unlinking students. |
| `teachers` (`Teacher`) | `_id`, `teacher_id`, `subjects[]`, `classes[]`, `branch_id` | Personal info, specialization, joining date, status, photo | Salary and sensitive fields included; mobile views may need filtered projections. |
| `classes` (`SchoolClass`) | `_id`, `grade_level_id`, `teacher_id`, `subject_teachers[]`, `branch_id` | Capacity, enrollment, academic year, recent students | `subject_teachers` pairs subject/teacher IDs; counts recomputed from `students` collection. |
| `attendance` (`Attendance`, `AttendanceSummary`) | `student_id`, `class_id`, `subject_id`, `branch_id`, `attendance_date` | Status enums (present/absent/late, etc.), check-in/out times, notification flags | Bulk operations expect `AttendanceBulkCreate`. Summaries track streaks & alerts; useful for mobile dashboards. |
| `exams`, `exam_results`, `report_cards` | `exam_id`, `student_id`, `class_id`, `teacher_id`, `branch_id` | Marks, percentages, grade letters, status, feedback, scheduling metadata | `exam_type` includes `assignment`, so assignments are modeled through exams. Result analytics feed notifications. |
| `payments` (`Payment`, `PaymentDetail`) | `_id`, `student_id`, `branch_id`, `fee_template_id`, `receipt_number` | Amounts (`Decimal`), method, discounts, status, payer info, timestamps | Numbers serialized as strings; mobile UI will need to format currency and handle partial/late statuses. |
| `fee_categories`, `bulk_fee_generations` | `branch_id`, `grade_level_tiers`, `frequency` | Fee tiers, due periods, late fee options | Backend helper maps between front-end terms (monthly/quarterly) and stored values. |
| `notifications` (`Notification`, `NotificationRecipient`, `NotificationTemplate`) | `notification_code`, `sender_id`, `recipient_type`, `target_users`, `branch_id` | Channels, priority, schedule, delivery stats | Supports multi-channel delivery, expiry, and analytics. PWA should subscribe via WebSocket for real-time updates. |
| `communication` (`Message`, `Announcement`, `ParentStudentLink`) | `message_id`, `recipient_type`, `branch_id` | Announcements, homework/assignment notices, acknowledgement tracking | Useful for parent/student portals; ensures `can_view_*` flags per parent-student link. |
| `timetable` (`WeeklyTimetable`, `TimetableEntry`, `TimeSlot`) | `branch_id`, `class_id`, `teacher_id`, `time_slot_id` | Day-of-week schedule, substitutions, room assignments, status | Provides conflict metadata and templates; PWA can fetch relevant entries per class/teacher/day. |

## Frontend (React/Vite) Architecture Audit

### Structure & Shared State
- `src/App.tsx` wraps the application with a global `QueryClientProvider` (TanStack Query) and layered contexts: `AuthProvider`, `WebSocketProvider`, `RoleAccessProvider`, `ErrorProvider`, `BranchProvider`, `SidebarProvider`, `NotificationProvider`.
- Contexts in `src/contexts/` handle:
  - Authentication (`AuthContext`): token persistence via `TokenStorage`, session timers, `/auth/me` fetch (currently pointing to missing endpoint).
  - Branch selection (`BranchContext`): stores selected branch in `localStorage`, fetches branches via `apiClient.getBranches()`, enforces super-admin "all" behaviour, and clears caches on switch.
  - Role & permission caching (`RoleAccessContext`): uses user payload permissions when available, otherwise falls back to `apiClient.getUserPermissions()` (`/rbac/me/permissions`, not yet present).
  - Notifications (`NotificationContext`) and WebSocket connectivity (`WebSocketContext`): manage subscription lifecycle, deduplicate connections, surface toasts via `sonner`.
  - Error handling (`ErrorContext`) and layout state (`SidebarContext`).

### API Layer & Data Fetching
- `src/lib/api.ts` (3k+ lines) provides a central `ApiClient` with retry logic, token refresh, and typed wrappers for most backend collections. It assumes REST endpoints exist under their logical prefixes, including `/auth/*`, `/rbac/*`, `/rbac/audit`, etc.
- Helper utilities (`TokenStorage`, `utils/jwt`) parse token expiry and determine refresh timing. Tokens and refresh tokens are kept in `localStorage`, which may be insufficient for secure mobile deployments.
- Components and hooks (`useQuery`, `useInfiniteQuery`, `useLiveData`) integrate with this client to populate dashboards, tables, and analytics widgets.

### RBAC, Navigation & Responsiveness
- `RoleBasedRoute` and `PermissionGuard` wrap routes/components, checking permissions using the context-provided helper functions (with automatic `.manage` fallbacks).
- `src/types/permissions.ts` defines 100+ string-based permissions (e.g., `student.read`) that are transformed to match backend enums. Any change in backend naming needs corresponding updates here.
- `hooks/useIsMobile` exists but the majority of components remain desktop-first; further responsive adjustments will be required for a polished PWA experience.

### Real-time & Notification Flow
- `hooks/useWebSocket.tsx` and `contexts/WebSocketContext.tsx` maintain a single application-wide WebSocket connection (default `ws://localhost:8000/ws` or `VITE_WS_URL`), authenticate using the JWT, manage exponential backoff, and resubscribe after reconnect.
- `NotificationContext` listens for `notification`, `system_alert`, and `data_batch` messages, updates in-memory state, and surfaces toasts. The backend WebSocket manager integrates with the data sync system and RBAC to broadcast updates.

### Observed Gaps for PWA Readiness
- The API client issues calls to `/auth/login-with-otp`, `/auth/send-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/refresh`, `/rbac/me/permissions`, and `/rbac/audit*`, but these routes are not present in `main.py`. Aligning backend routes with client expectations (or vice versa) is critical before Phase 2.
- Several backend routers bypass the permission decorators and inspect raw role strings. Standardizing on `has_permission`/`require_permission` will reduce drift between front-end permission names and backend enforcement.
- Token storage relies on browser `localStorage`, which may not satisfy security requirements for native-wrapped PWAs. Evaluate secure storage alternatives or HTTP-only cookie flows.
- `src/lib/api.ts` is very large; consider generating typed clients or segmenting by domain for maintainability and to ease mobile-specific optimizations (e.g., reduced payloads, offline caching).

## Environment, Configuration & Integration Dependencies

### Backend
| Environment Variable | Purpose / Notes |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (defaults to `mongodb://localhost:27017`). |
| `JWT_SECRET_KEY` | JWT signing secret; fallback is randomly generated with a warning. |
| `USE_MOCK_DB` | When `true`, loads `db_mock.py` for in-memory development. |
| `ENVIRONMENT` | Controls exposure of `/docs` and `/redoc`. |
| `ALLOWED_HOSTS` | Comma-separated host list for `TrustedHostMiddleware`. |
| `SESSION_SECRET_KEY` | Secret for `SessionMiddleware`; random fallback used if missing. |
| `CORS_ORIGINS` | Allowed origins for the CORS middleware. |
| `DATABASE_URL` | Mongo URL for audit logging (defaults to `mongodb://localhost:27017/school_db`). |
| `FIREBASE_CREDENTIALS_PATH`, `FIREBASE_PROJECT_ID` | Configure push notifications (`utils/push_service.py`). |
| `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`, `SENDGRID_API_KEY` | Email delivery configuration (`utils/email_service.py`). |
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | SMS delivery backends (`utils/sms_service.py`). |

Additional integrations (e.g., Firebase Admin SDK, Twilio, AWS SNS) require corresponding credentials and are optional depending on notification channels in use.

### Frontend
| Environment Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base REST endpoint used by the API client and Auth/OTP flows. |
| `VITE_WS_URL` | WebSocket endpoint used by `WebSocketContext`; defaults to `ws://localhost:8000/ws`. |

Ensure these values are provided at build-time for mobile deployments (e.g., via `.env.production` or CI pipeline injection).

## Findings, Gaps & Phase 2 Considerations

- **Align API contracts:** Either implement the `/auth/*` and `/rbac/*` endpoints expected by the frontend (OTP login, current-user, refresh, audit feeds) or refactor the client to use existing `/users`, `/permissions`, and websocket channels.
- **Normalize RBAC enforcement:** Replace raw role checks in routers with `has_permission`/`require_permission` and ensure branch-aware routes cover create/update/delete paths. Update `ROLE_PERMISSIONS` if new mobile roles are introduced.
- **Expose mobile-friendly data slices:** Consider lightweight endpoints for dashboards (student summary, attendance streaks, upcoming assignments/exams, outstanding payments) to avoid transferring full documents to the PWA.
- **Define Assignment APIs:** Assignments are currently implicit through exams (`exam_type="assignment"`) and communication messages. Decide whether to expose a dedicated `/assignments` surface or document the existing pattern for mobile clients.
- **Secure token handling:** Evaluate moving away from plain `localStorage` toward HTTP-only cookies or secure storage abstractions for hybrid mobile environments.
- **Branch context UX:** Mobile flows must capture the active `branch_id`. Provide a minimal branch metadata endpoint that PWA can cache and surface for switching (respecting super-admin "/all" behaviour).
- **Offline & sync strategy:** The backend already emits WebSocket `data_batch` events; Phase 2 planning should clarify offline caching needs and whether TanStack Query caches should be persisted for PWA use.
- **Integration readiness:** Document Firebase/Twilio/AWS credential requirements for mobile push/SMS/email and confirm they align with deployment environments.
- **Codebase maintainability:** Consider segmenting the API client, generating OpenAPI-based types, and adding automated tests for endpoint permission coverage to ensure backend/frontend parity during PWA development.
