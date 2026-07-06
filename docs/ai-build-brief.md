# AI Build Brief - Chat Ẩn Danh

File này là brief ngắn để đưa cho AI coding agent khi bắt đầu code. AI phải đọc thêm các docs liên quan trước khi tạo code:

- `docs/README.md`
- `docs/anonymous-chat-business-tech.md`
- `docs/implementation-design.md`
- `docs/product-requirements.md`
- `docs/business-flows.md`
- `docs/api-and-realtime-spec.md`
- `docs/data-model-and-privacy.md`
- `docs/architecture-guide.md`
- `docs/roadmap-and-extension-guide.md`

## 1. Objective

Build a modern anonymous chat web app named "Chat Ẩn Danh" using React, Node.js, TypeScript, NestJS, Socket.IO, PostgreSQL, Prisma, Redis and BullMQ.

The app serves Vietnamese users first. All user-facing UI must default to Vietnamese (`vi-VN`). The app must let users chat anonymously without mandatory registration, while still offering easy register/login by email/password or Google account for users who want saved settings. Before matching, every user must complete a quick profile: display name, age, city/province, gender and desired partner genders. Users must not see each other's real identity, email/Gmail, exact address or device data. The platform must include report, block, rate limit and moderation from MVP. Topic suggestion is the MVP engagement feature; quick game and saved anonymous connections are Phase 2 unless explicitly enabled by a feature spec.

## 2. Required Stack

```text
Frontend: React 19, Vite, TypeScript, Tailwind CSS, Radix UI/shadcn-style components, React Router, TanStack Query, Zustand, socket.io-client
Backend: Node.js 24 LTS, NestJS, TypeScript, Socket.IO, Prisma
Database: PostgreSQL
Cache/Queue: Redis, BullMQ
Auth: JWT access token, refresh token in httpOnly cookie, Google OAuth/OIDC
Validation: Zod shared schemas
Tests: Vitest, React Testing Library, Supertest, Playwright
Deploy local: Docker Compose
```

## 3. Monorepo Structure

```text
chatandanh/
  apps/
    web/
    api/
    worker/
  packages/
    shared/
  prisma/
    schema.prisma
    migrations/
  docs/
  docker-compose.yml
  README.md
```

## 4. MVP Build Order

1. Scaffold monorepo and shared TypeScript config.
2. Create Prisma schema from `docs/data-model-and-privacy.md`.
3. Create Docker Compose with PostgreSQL and Redis.
4. Build NestJS API modules:
   - `AuthModule`
   - `SessionsModule`
   - `ProfilesModule`
   - `MatchingModule`
   - `ChatModule`
   - `EngagementModule`
   - `ConnectionsModule` only when Phase 2 saved connections is requested; otherwise keep contracts/flags ready but do not ship UI
   - `RoomsModule`
   - `ReportsModule`
   - `AdminModule`
5. Build Socket.IO Gateway:
   - auth handshake
   - join conversation
   - send message
   - typing indicator
   - conversation end
   - matching paired event
6. Build React app:
   - lobby
   - auth dialog
   - profile setup screen
   - matching screen
   - 1-1 chat
   - long-chat topic suggestion prompt
   - rooms
   - safety/report/block dialogs
   - admin report dashboard
7. Add rate limits and validation.
8. Add smoke tests for guest chat on two browser contexts.

## 5. Product Rules AI Must Preserve

- Default mode is anonymous guest.
- Default locale is `vi-VN`; visible UI copy must be Vietnamese.
- Registration/login must be optional, but profile completion is required before matching.
- Support easy login/register with Google account. Never ask for or store Gmail password.
- Required profile fields: `displayName`, `age`, `location`, `gender`, `desiredGenders`.
- `location` must be city/province/region only, never exact address.
- Gender values for MVP: `male`, `female`, `other`.
- Never expose `accountId`, `sessionId`, `email`, `ipHash`, `deviceHash`, `passwordHash` or `refreshTokenHash` to another user.
- Never expose Google account id, Google email/Gmail or auth provider to another chat participant.
- Derive sender identity from auth token, never from client payload.
- Do not allow empty messages or messages longer than 2,000 characters.
- Support "End chat" and "Next partner".
- Random matching must avoid users already met during the configured cooldown when fresh compatible candidates exist.
- Store match history server-side and never trust client-provided "already met" lists.
- Long conversations should unlock Vietnamese topic suggestions in MVP.
- Quick two-person game and anonymous save connection are Phase 2 unless the task explicitly asks for them with a feature spec.
- Audio/video call is phase later, not first MVP. It must require mutual consent, preview, clear privacy warning and visible report/block/end controls.
- Blocked users must not be matched again.
- Report and block must be available inside every active chat.
- Admin/moderator actions must be audit logged.
- First MVP supports text chat plus direct-chat image messages. Audio/video call belongs to a later phase and must not be implemented in the first phase unless explicitly requested for that phase.

## 6. First Coding Prompt

Use this prompt when starting implementation:

```text
You are building the Chat Ẩn Danh MVP in this repo.

Read all docs in docs/ first. Implement the monorepo structure from docs/ai-build-brief.md using React 19 + Vite + TypeScript for the web app, NestJS + Socket.IO for the API, Prisma + PostgreSQL for persistence, Redis + BullMQ for matching/presence/jobs, and shared TypeScript types in packages/shared.

Start with the foundation:
1. package manager workspace setup
2. apps/web scaffold
3. apps/api scaffold
4. apps/worker scaffold
5. packages/shared scaffold
6. prisma/schema.prisma based on docs/data-model-and-privacy.md
7. docker-compose.yml for postgres and redis
8. README local run commands

Keep the MVP focused on Vietnamese UI, anonymous guest session, optional auth with email/password and Google, required quick profile, gender-preference random 1-1 matching, text chat realtime, long-chat topic suggestion, rooms, report/block and minimal admin reports.
```

## 7. Acceptance For First Implementation Phase

- `pnpm install` or chosen package manager install works.
- `docker compose up -d` starts PostgreSQL and Redis.
- Prisma schema validates.
- API boots locally.
- Web boots locally.
- Shared package exports basic DTO/event types.
- Profile setup works and matching refuses incomplete profiles with `PROFILE_REQUIRED`.
- Main user flows display Vietnamese copy.
- Long-chat topic suggestion milestone appears after configured message/time threshold.
- Quick game, saved connections and calls remain disabled by default unless their phase is explicitly requested.
- README contains exact local commands.
