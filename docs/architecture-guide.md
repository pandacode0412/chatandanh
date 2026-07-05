# Architecture Guide

For stack/version policy, implementation sequence and detailed target repo tree, read [Implementation Design](implementation-design.md).

## 1. Architecture Style

Use a modular monolith for MVP.

Do not split into microservices yet. The app should be easy to run locally and easy for AI agents to reason about.

```text
chatandanh/
  apps/
    web/       # React + Vite
    api/       # NestJS REST + Socket.IO
    worker/    # BullMQ background jobs
  packages/
    shared/    # Shared DTOs, event types, constants, validation schemas
  prisma/
    schema.prisma
    migrations/
  docs/
```

## 2. Backend Modules

| Module | Responsibility |
|---|---|
| `AuthModule` | Email/password login, Google OAuth/OIDC, refresh tokens |
| `SessionsModule` | Anonymous sessions, guest lifecycle, session status |
| `ProfilesModule` | Required chat profile and preferences |
| `MatchingModule` | Queue, gender preference, avoid recent matches, block exclusion |
| `ChatModule` | Conversations, messages, Socket.IO gateway, typing, end chat |
| `EngagementModule` | Long-chat milestones and MVP topic suggestions; Phase 2 quick games |
| `ConnectionsModule` | Phase 2 anonymous saved connections and connection invites |
| `RoomsModule` | Public rooms and topics |
| `ReportsModule` | Report/block user actions |
| `AdminModule` | Moderator/admin dashboard APIs |

## 3. Frontend Areas

| Area | Responsibility |
|---|---|
| Lobby | First screen, Vietnamese CTA, online count |
| Auth | Email login/register, Google when configured, continue as guest |
| Profile Setup | Required display name, age, location, gender, desired genders |
| Matching | Queue status, cancel, desired-gender selector |
| Direct Chat | Message list, composer, typing, end, next, report, block |
| Engagement | MVP topic suggestions; Phase 2 quick game and save connection prompts |
| Rooms | Room list and room chat |
| Connections | Phase 2 anonymous saved connections |
| Safety | Block list, report history, privacy controls |
| Admin | Reports, moderation actions, metrics, room config |

## 4. Shared Package

`packages/shared` should contain types and validation that must match across frontend and backend:

```text
packages/shared/src/
  auth/
  profile/
  matching/
  chat/
  realtime/
  engagement/
  safety/
  admin/
  errors/
```

Rules:

- API DTOs and Socket.IO payload types belong here.
- Validation schemas should be shared when practical.
- Do not put database-only models here.
- Do not expose sensitive internal fields in public DTOs.
- Prefer Zod schemas for DTO validation so frontend forms and backend controllers can share rules.
- Public DTO names should make exposure clear, for example `PublicParticipant`, `PublicMessage`, `StartMatchingRequest`.
- Admin/internal DTOs must not be exported through public chat contracts.

## 5. Data Flow

```text
React Web
  -> REST API for auth/profile/rooms/reports/admin
  -> Socket.IO for matching/chat/typing/presence/engagement
NestJS API
  -> PostgreSQL via Prisma for durable state
  -> Redis for presence, queues, rate limit and Socket.IO adapter
  -> BullMQ worker for cleanup, moderation and scheduled jobs
```

## 6. Boundary Rules

- Client never decides its own sender id; backend derives it from auth/session.
- Client never submits trusted moderation status.
- Client may request matching preferences, but backend reads trusted profile from database.
- Socket events are untrusted input and must be validated.
- Privacy-sensitive identifiers never leave server-side internal APIs.
- Admin/moderator APIs must not reuse public participant DTOs when extra internal context is required.
- Self-context APIs may return the authenticated user's own `sessionId` or account summary, but public participant payloads must never include another user's `sessionId`, `accountId`, email, auth provider or safety hash.
- Redis is allowed for presence, queue and rate-limit state; PostgreSQL remains the durable source of truth for sessions, conversations, messages, reports and match history.

## 7. Feature Flags

Use feature flags for features that are not part of first MVP:

```text
FEATURE_TOPIC_SUGGESTION=true
FEATURE_QUICK_GAME=false
FEATURE_SAVE_CONNECTION=false
FEATURE_AUDIO_CALL=false
FEATURE_VIDEO_CALL=false
```

Audio/video call must remain disabled until its own feature spec and ADR exist.

Quick game and saved anonymous connections are Phase 2 by default. They may have shared contracts or placeholder module boundaries, but user-visible UI must stay hidden unless the feature flag and feature spec are approved.

## 8. Implementation Ownership Rules

Backend service ownership:

- `AuthModule` owns account auth, Google OAuth/OIDC, password hash and refresh tokens.
- `SessionsModule` owns guest lifecycle, session status and safety hash creation.
- `ProfilesModule` owns required profile validation and `profileComplete`.
- `MatchingModule` owns queue selection, gender compatibility, block exclusion and recent-match avoidance.
- `ChatModule` owns conversation membership, messages, typing and conversation end.
- `ReportsModule` owns report/block submission and target participant resolution.
- `AdminModule` owns moderator/admin APIs and audit logs.

Frontend ownership:

- `features/chat` owns message list, composer, typing, end chat and next partner UI.
- `features/matching` owns queue state, cancel and timeout UI.
- `features/safety` owns report/block dialogs and safety center.
- `features/admin` owns moderator/admin surfaces.
- Shared UI primitives belong in `components/ui`; domain-specific components stay in their feature folder.

## 9. Test Requirements By Risk

| Area | Minimum tests |
|---|---|
| Profile validation | Unit tests for required fields and Vietnamese location constraints |
| Matching | Unit/integration tests for gender preference, block exclusion and recent-match avoidance |
| Realtime chat | Integration tests for socket auth, membership check, send message, typing and end chat |
| Privacy payloads | Explicit assertions that public DTOs/events exclude forbidden fields |
| Report/block | Integration tests for report snapshot policy and block preventing future matches |
| MVP smoke | Playwright two-browser guest flow: profile, match, send message, report/block or next |

If a change touches auth, matching, moderation, realtime events or privacy-sensitive payloads, tests are required in the same change unless the agent documents why they cannot run.
