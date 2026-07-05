# Implementation Design - Chat Ẩn Danh

Spec version: `0.1`
Last checked: `2026-06-30`
Audience: AI coding agents, developers, product owner.

Tài liệu này là contract triển khai cho repo `chatandanh`. Nó không thay thế Product Requirements, API/Realtime Spec hoặc Data Model & Privacy. Khi có conflict, dùng thứ tự ưu tiên trong [Docs Index](README.md).

Architecture decision record liên quan: [ADR: MVP Node.js + React Modular Monolith](adr/2026-06-30-mvp-node-react-modular-monolith.md).

## 1. Product Build Goal

Build một web app chat ẩn danh cho người Việt Nam, ưu tiên:

- Vào trải nghiệm chat nhanh bằng guest session.
- Profile tối thiểu bắt buộc trước matching.
- Random 1-1 matching theo giới tính muốn trò chuyện và tránh gặp lại gần đây.
- Text realtime chat bằng Socket.IO.
- Room chat theo chủ đề.
- Report, block, rate limit và moderator dashboard từ MVP.
- Toàn bộ user-facing UI mặc định là tiếng Việt `vi-VN`.
- Không expose định danh thật hoặc identifier nội bộ cho người đối diện.

MVP không làm audio/video call. Quick game và lưu kết nối ẩn danh là Phase 2 trừ khi PO yêu cầu bật sớm bằng feature spec riêng.

## 2. Stack Decisions

| Layer | Chọn | Lý do | Rule cho agent |
|---|---|---|---|
| Runtime | Node.js 24 LTS | LTS ổn định cho production | Pin bằng `.nvmrc`, Dockerfile và `package.json engines` khi scaffold |
| Language | TypeScript | Cùng type system cho web, API, worker, shared contracts | Không viết JavaScript mới trừ config bắt buộc |
| Package manager | pnpm workspaces | Monorepo nhẹ, cache tốt, workspace rõ | Dùng `pnpm` cho scripts và lockfile |
| Frontend | React 19 + Vite | SPA nhanh, phù hợp chat UI realtime | Không dùng Next.js trong MVP nếu không có ADR |
| Routing | React Router | Đủ cho SPA routes | Route chính nằm trong `apps/web/src/app/routes` |
| Server state | TanStack Query | REST cache, mutation, invalidation rõ | Dùng cho REST data, không dùng để giữ socket state ngắn hạn |
| Client state | Zustand | Nhẹ cho socket/session/chat UI state | Store nhỏ theo domain, tránh global store khổng lồ |
| UI | Tailwind CSS + Radix UI/shadcn-style components | Dễ dựng mobile-first, accessible | Component primitive ở `components/ui`, domain component ở feature folder |
| Icons | lucide-react | Icon set nhất quán | Dùng icon cho button công cụ khi có icon phù hợp |
| Backend | NestJS + TypeScript | Module boundary rõ, hợp REST + Socket.IO | Module theo domain, không gom logic vào `AppService` |
| HTTP adapter | NestJS default Express adapter | Ít ma sát với ecosystem và Socket.IO MVP | Chỉ đổi Fastify khi có ADR |
| Realtime | Socket.IO | Rooms, reconnect, fallback, Redis adapter | Validate mọi socket payload như REST body |
| Database | PostgreSQL | Durable relational data, transaction tốt | DB là source of truth cho account/session/message/report |
| ORM | Prisma | Schema-first, migration rõ, type-safe client | Không query SQL raw trừ khi có lý do và test |
| Cache/presence | Redis | Presence, matching queues, rate limits | Redis là cache/queue, không là source of truth privacy |
| Queue/jobs | BullMQ | Background cleanup/moderation jobs trên Redis | Dùng Job Schedulers cho recurring jobs khi triển khai BullMQ mới |
| Auth | JWT access token + refresh token httpOnly cookie | Guest và account đều dùng được | Không lưu token trong localStorage nếu có thể tránh |
| Password hash | Argon2id preferred, bcrypt acceptable | Bảo vệ password registered user | Không bao giờ trả `passwordHash` |
| Validation | Zod shared schemas | Dùng được cả frontend và backend | DTO public phải nằm trong `packages/shared` |
| Tests | Vitest, React Testing Library, Supertest, Playwright | Unit, integration, E2E smoke | Privacy payload tests là bắt buộc cho chat/matching |
| Local infra | Docker Compose | Dev dễ chạy PostgreSQL + Redis | `docker compose up -d` phải đủ dependency local |
| Observability | Pino logs, Sentry optional, OpenTelemetry later | Debug production từng bước | Log structured, không log raw token/password |

Version policy:

- Dùng LTS/stable branch cho runtime và framework chính.
- Pin major versions trong `package.json`; update major cần ADR nếu ảnh hưởng architecture/build/runtime.
- Không dùng Node.js Current cho production mặc định.
- Không thêm framework lớn mới nếu stack hiện tại giải quyết được bài toán.

Reference chính thức đã kiểm tra ngày `2026-06-30`:

- Node.js Releases: https://nodejs.org/en/about/previous-releases
- React Versions: https://react.dev/versions
- Vite Guide: https://vite.dev/guide/
- NestJS WebSockets Gateways: https://docs.nestjs.com/websockets/gateways
- Prisma PostgreSQL Quickstart: https://www.prisma.io/docs/prisma-orm/quickstart/postgresql
- Socket.IO Redis Adapter: https://socket.io/docs/v4/redis-adapter/
- BullMQ Docs: https://docs.bullmq.io/
- TanStack Query React Docs: https://tanstack.com/query/latest/docs/framework/react/overview

## 3. Target Monorepo Shape

```text
chatandanh/
  apps/
    web/
      src/
        app/
          providers/
          routes/
          router.tsx
        components/
          ui/
          layout/
        features/
          auth/
          profile/
          lobby/
          matching/
          chat/
          rooms/
          engagement/
          safety/
          admin/
        lib/
          api/
          socket/
          i18n/
          config/
        test/
      public/
      index.html
      package.json
      vite.config.ts
    api/
      src/
        main.ts
        app.module.ts
        common/
          config/
          guards/
          pipes/
          filters/
          rate-limit/
          logging/
        infra/
          prisma/
          redis/
          queue/
        modules/
          auth/
          sessions/
          profiles/
          matching/
          chat/
          engagement/
          rooms/
          reports/
          admin/
        realtime/
          chat.gateway.ts
          socket-auth.guard.ts
      test/
      package.json
    worker/
      src/
        main.ts
        jobs/
          sessions-expire.job.ts
          messages-retention.job.ts
          match-history-retention.job.ts
          reports-retention.job.ts
          moderation-auto-flag.job.ts
        queues/
      package.json
  packages/
    shared/
      src/
        auth/
        profile/
        matching/
        chat/
        realtime/
        engagement/
        safety/
        admin/
        errors/
        index.ts
      package.json
  prisma/
    schema.prisma
    seed.ts
    migrations/
  docs/
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
```

Rules:

- `packages/shared` chứa public DTO, event payload type, enum và Zod schema dùng chung.
- `packages/shared` không chứa Prisma model, password hash, token internals, IP/device hash hoặc admin-only investigation fields.
- `apps/api` là source of truth cho business rule và authorization.
- `apps/web` không tự quyết định sender, matching candidate, moderation status hoặc profile trust.
- `apps/worker` chỉ xử lý job async, không expose HTTP/socket endpoint.

## 4. Backend Module Ownership

| Module | Owns | Must not own |
|---|---|---|
| `AuthModule` | email/password, Google OAuth/OIDC, refresh token, account auth | Matching queue, message send |
| `SessionsModule` | guest session, session expiry, session status, safety hash creation | Public chat participant mapping |
| `ProfilesModule` | profile validation, `profileComplete`, gender preferences | Matching candidate selection |
| `MatchingModule` | queue, compatibility, avoid recent matches, block exclusion, conversation creation | Message persistence |
| `ChatModule` | conversations, members, messages, typing, end chat | Account auth registration |
| `EngagementModule` | topic suggestion milestone in MVP, later quick game/save prompts | Call implementation |
| `RoomsModule` | room/topic CRUD for admin, room join/leave | Direct matching |
| `ReportsModule` | block, report submit, report snapshot policy | Moderator action authorization |
| `AdminModule` | reports dashboard, metrics, moderation actions, room config | Public user chat APIs |

Cross-module rules:

- `MatchingModule` may call `ProfilesModule`, `ReportsModule` block query and `ChatModule` conversation factory through services.
- `ChatModule` derives `senderMemberId` from authenticated socket/session, never from client payload.
- `ReportsModule` resolves `targetParticipantId` to internal session server-side.
- `AdminModule` can use internal DTOs, but public endpoints must stay on public DTOs.

## 5. Frontend Feature Ownership

| Feature folder | Owns |
|---|---|
| `lobby` | First screen, CTA, online count |
| `auth` | Auth panel/dialog, email login/register, Google when configured, refresh/logout UI |
| `profile` | Required profile setup and edit |
| `matching` | Start/cancel matching, desired-gender selector, waiting state, timeout copy |
| `chat` | Chat shell, message list, composer, typing, end/next |
| `rooms` | Room list and room chat |
| `engagement` | Topic suggestion tray in MVP, Phase 2 prompts behind flags |
| `safety` | Report dialog, block confirm, block list |
| `admin` | Moderator dashboard, reports, moderation actions |

State rules:

- TanStack Query owns REST server data: profile, rooms, reports, admin metrics.
- Zustand owns ephemeral client state: active socket, typing map, optimistic messages, current matching timer.
- Socket event handlers update feature stores and invalidate queries when durable data changes.
- UI copy lives in Vietnamese constants or i18n files under `lib/i18n`; no hardcoded English user-facing text in primary flows.

## 6. Shared Contract Design

Recommended shared package layout:

```text
packages/shared/src/
  errors/error-codes.ts
  auth/auth.dto.ts
  auth/auth.schema.ts
  profile/profile.dto.ts
  profile/profile.schema.ts
  matching/matching.dto.ts
  matching/matching.schema.ts
  chat/chat.dto.ts
  chat/chat.schema.ts
  realtime/events.ts
  realtime/payloads.ts
  safety/safety.dto.ts
  safety/safety.schema.ts
  admin/admin.dto.ts
  index.ts
```

Naming rules:

- Request DTO: `CreateAnonymousSessionRequest`, `StartMatchingRequest`.
- Response DTO: `CreateAnonymousSessionResponse`, `PublicConversationResponse`.
- Socket payload: `MessageSendPayload`, `MessageNewPayload`, `MatchingPairedPayload`.
- Public participant type: `PublicParticipant`.
- Internal entity names like `Account`, `AnonymousSession` stay out of shared public contracts unless the response is self-context or admin-only.

Validation rules:

- Zod schemas should validate strings with trim/min/max and enum values.
- Backend should reuse schemas through a validation pipe or explicit parse.
- Frontend should reuse schemas for form validation where practical.
- Socket payloads must be validated before any DB or Redis write.

## 7. MVP Implementation Sequence

### Phase 0 - Foundation

Acceptance:

- `pnpm install` works.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` scripts exist even if early packages have minimal tests.
- Docker Compose starts PostgreSQL and Redis.
- `.env.example` documents all required local variables.

Build:

1. Root workspace: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`.
2. `apps/web` Vite React TypeScript scaffold.
3. `apps/api` NestJS TypeScript scaffold.
4. `apps/worker` BullMQ scaffold.
5. `packages/shared` TypeScript package.
6. Prisma schema draft from [Data Model & Privacy](data-model-and-privacy.md).

### Phase 1 - Session, Auth, Profile

Acceptance:

- Guest can create anonymous session.
- Registered user can register/login/logout.
- Google OAuth route is wired or stubbed behind env config.
- Profile setup validates `displayName`, `age`, `location`, `gender`, `desiredGenders`.
- Matching start returns `PROFILE_REQUIRED` when profile is incomplete.

### Phase 2 - Matching And Direct Chat

Acceptance:

- Two browser contexts can match.
- Matching respects gender preferences and block list.
- Matching avoids recent matches when fresh compatible candidates exist.
- Users can send/receive text realtime.
- Empty and over-2,000-character messages are rejected.
- "Kết thúc" and "Đổi người" work.

### Phase 3 - Rooms, Safety, Admin

Acceptance:

- Seed topics/rooms exist in Vietnamese.
- User can join/leave room and send room text messages.
- User can report/block inside direct chat and room chat.
- Moderator/admin can view reports and create moderation actions.
- Audit log is written for moderation actions.

### Phase 4 - Engagement MVP

Acceptance:

- Topic suggestion appears after 3 minutes or 10 messages.
- Prompt is dismissible and does not cover composer.
- Payload copy is Vietnamese.
- Prompt is disabled for conversations with serious report/flag.

### Phase 5 - Hardening

Acceptance:

- Playwright smoke test covers guest -> profile -> match -> message -> report/block.
- Integration tests cover matching compatibility and recent-match avoidance.
- Privacy tests assert public payloads do not contain forbidden fields.
- README has exact local run commands.

## 8. Feature Flags

Default flags for MVP:

```text
FEATURE_TOPIC_SUGGESTION=true
FEATURE_QUICK_GAME=false
FEATURE_SAVE_CONNECTION=false
FEATURE_AUDIO_CALL=false
FEATURE_VIDEO_CALL=false
```

Rules:

- A disabled feature can have types and placeholder UI only if it does not appear to users.
- Enabling quick game or saved connections requires a feature spec if scope goes beyond existing docs.
- Enabling audio/video call requires feature spec and ADR.

## 9. Environment Variables

Minimum `.env.example`:

```text
NODE_ENV=development
PORT=3000
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://chatandanh:chatandanh@localhost:5432/chatandanh
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=dev-change-me
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=dev-change-me
REFRESH_TOKEN_EXPIRES_DAYS=30
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
SAFETY_HASH_SECRET=dev-change-me
GUEST_SESSION_TTL_HOURS=24
MESSAGE_RETENTION_DAYS=30
REPORT_RETENTION_DAYS=180
MATCH_HISTORY_COOLDOWN_DAYS=7
REMATCH_FALLBACK_SECONDS=45
MIN_FRESH_MATCH_POOL=2
MATCH_HISTORY_RETENTION_DAYS=30
FEATURE_TOPIC_SUGGESTION=true
FEATURE_QUICK_GAME=false
FEATURE_SAVE_CONNECTION=false
FEATURE_AUDIO_CALL=false
FEATURE_VIDEO_CALL=false
```

Secret rules:

- Do not commit real secrets.
- Do not log JWT, refresh token, OAuth credential, password, IP or device raw values.
- Rotate production secrets through deployment platform, not source files.

## 10. Privacy And Payload Guardrails

Public chat payload may include:

- `participantId` as `conversation_members.id`.
- `alias`, `avatarKey`, `mode`, `age`, `location`, `gender`, `online`.
- `conversationId`, `messageId`, `clientMessageId`, `createdAt`, message `body`.

Public chat payload must not include:

- `accountId`, `sessionId`, `email`, `googleSub`, `authProvider`.
- `ip`, `ipHash`, `deviceHash`, `userAgentHash`.
- `passwordHash`, `refreshTokenHash`.
- `desiredGenders` of the other participant.
- Internal moderation score or safety hash.

Self-context APIs may return `sessionId` or account summary only to the authenticated owner. Admin APIs may use internal IDs only behind role guards and audit logs.

Agent checklist before adding or changing payloads:

1. Is this field needed by the UI?
2. Could this field reveal real identity or internal safety data?
3. Is it sent to self only, public participant, or admin?
4. Does the shared DTO make the exposure obvious?
5. Is there a test asserting forbidden fields are absent?

## 11. Matching Design

Algorithm source of truth is [API & Realtime Spec](api-and-realtime-spec.md), but implementation should keep these service boundaries:

```text
MatchingController
  -> MatchingService.start()
  -> ProfileReader.getTrustedProfile()
  -> MatchingQueueRepository.addOrFindCandidate()
  -> BlockPolicy.excludeBlockedPairs()
  -> MatchHistoryPolicy.splitFreshAndRepeat()
  -> ConversationFactory.createDirectConversation()
  -> MatchHistoryRepository.upsertPair()
  -> RealtimePublisher.emitPaired()
```

Implementation rules:

- Matching request may include preferences, but trusted gender/location data comes from server-side profile.
- Candidate queue can live in Redis, but final pair creation must be transactionally persisted in PostgreSQL.
- `match_history` uses HMAC identity keys and sorted pair keys.
- Block exclusion always wins over fallback.
- When fresh compatible candidates exist, do not select a repeat candidate inside cooldown.

## 12. Realtime Design

Socket namespaces:

- MVP can use the default namespace with authenticated rooms.
- Use room names like `conversation:{conversationId}`, `room:{roomId}`, `session:{sessionId}` internally.
- Never expose internal room names to the other participant.

Gateway rules:

- Validate token during handshake.
- Reject expired, banned or muted sessions where appropriate.
- Validate every incoming event payload.
- Check conversation membership before join/send/typing/end.
- Derive sender from token and conversation membership.
- Emit public participant DTO only.
- Use Redis adapter when API runs more than one instance.

Delivery rules:

- Message delivery is at-least-once.
- Client sends `clientMessageId`.
- Server stores unique `(senderMemberId, clientMessageId)`.
- Client de-duplicates by `clientMessageId` and `id`.

## 13. Testing Strategy

Required test layers:

| Layer | Tool | Required coverage |
|---|---|---|
| Shared schemas | Vitest | Profile validation, message validation, error codes |
| API unit | Vitest | Matching policies, block policy, safety hash, retention date helpers |
| API integration | Vitest + Supertest | Auth/session/profile/matching/report endpoints |
| Realtime integration | Vitest or dedicated test runner | Socket auth, message send, typing, conversation end |
| Web unit | Vitest + React Testing Library | Profile form, composer validation, report dialog |
| E2E smoke | Playwright | Two contexts guest -> profile -> match -> message -> next/report/block |
| Privacy regression | Vitest snapshot or explicit assertions | Public DTOs/events exclude forbidden fields |

Minimum privacy test:

```text
For every public chat response/event:
  assert payload does not contain accountId
  assert payload does not contain sessionId
  assert payload does not contain email
  assert payload does not contain googleSub
  assert payload does not contain ipHash/deviceHash
  assert payload does not contain passwordHash/refreshTokenHash
```

## 14. Local Developer Commands

Target commands after scaffold:

```text
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
docker compose up -d
docker compose down
```

README must document which ports are used:

```text
Web: http://localhost:5173
API: http://localhost:3000
PostgreSQL: localhost:5432
Redis: localhost:6379
```

## 15. Agent Working Rules

Before coding:

1. Read [Docs Index](README.md), [AI Build Brief](ai-build-brief.md), this file, Product Requirements, API & Realtime Spec, Data Model & Privacy and Architecture Guide.
2. Identify requirement IDs affected by the change.
3. Check whether REST/socket contract changes are needed.
4. Check whether data/privacy rules change.
5. If architecture/auth/privacy/matching/realtime changes, create or update ADR.
6. If user-facing feature scope changes, create or update feature spec.

While coding:

- Keep changes scoped to the module that owns the behavior.
- Prefer shared DTO/schema over duplicated ad hoc types.
- Add Vietnamese copy for user-facing states.
- Add tests proportional to privacy/safety risk.
- Do not implement audio/video call in MVP.

Before finishing:

- Run format/lint/typecheck/tests that are available.
- Confirm public payloads do not expose forbidden fields.
- Update docs if behavior changed.
- Summarize changed files, tests run and remaining risks.
