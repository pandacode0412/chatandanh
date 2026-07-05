# ADR: MVP Node.js + React Modular Monolith

## Status

Accepted

## Context

Chat Ẩn Danh cần MVP web chat realtime cho người Việt Nam, cho phép guest anonymous, optional account, required profile, random 1-1 matching, rooms, report/block/rate limit và moderator dashboard. Repo đang theo docs-first development và cần một stack rõ ràng để AI coding agents scaffold code nhất quán.

Product owner muốn dùng Node.js và React.js. Các phần còn lại cần được chọn để cân bằng tốc độ MVP, privacy/safety, khả năng scale realtime và độ dễ hiểu cho AI agents.

## Decision

Build MVP as a pnpm monorepo modular monolith:

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, Radix UI/shadcn-style components, React Router, TanStack Query, Zustand, socket.io-client.
- Backend: Node.js 24 LTS, NestJS, TypeScript, Socket.IO.
- Persistence: PostgreSQL, Prisma.
- Cache/queue: Redis, BullMQ.
- Auth: JWT access token, refresh token in httpOnly cookie, Google OAuth/OIDC.
- Shared contracts: `packages/shared` with public DTOs, Socket.IO payload types and Zod validation schemas.
- Local development: Docker Compose for PostgreSQL and Redis.
- MVP is text chat only with topic suggestion engagement. Quick game, saved connections and audio/video call stay disabled by default until their phase is explicitly requested.

Detailed implementation rules live in [Implementation Design](../implementation-design.md).

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| React + Vite SPA | Fast scaffold, simple deploy, good fit for chat UI | SEO/SSR is not a focus for MVP |
| Next.js full-stack | SSR and routing included, can grow into app platform | Adds server/runtime decisions not needed for MVP chat app |
| NestJS modular monolith | Clear module boundaries, REST + Socket.IO support, easy for agents to reason about | More structure than a tiny Express app |
| Express-only API | Very simple, minimal abstraction | Easier to blur module boundaries and validation ownership |
| Microservices | Can scale teams/services independently later | Too much operational complexity for MVP |
| MongoDB | Flexible documents | Matching/history/report queries benefit from relational constraints and transactions |
| Raw WebSocket | Lower-level control | Socket.IO rooms/reconnect/Redis adapter reduce MVP risk |

## Consequences

Positive:

- One repo and one backend app are easier to run, test and inspect.
- Shared TypeScript/Zod contracts reduce API/realtime drift.
- PostgreSQL transaction boundaries help matching, reports and moderation audit.
- Redis and Socket.IO adapter leave a clear path for horizontal API scaling.

Negative:

- Modular monolith can still become tangled if module ownership is ignored.
- SPA does not solve SEO/marketing pages by default.
- Socket.IO protocol must be versioned carefully as clients evolve.

## Privacy/Safety Impact

- Public DTOs must exclude `accountId`, `sessionId`, email, Google id, IP/device hash, password hash and refresh token hash.
- Backend derives sender identity and target session from authenticated context, never from client payload.
- Admin/internal DTOs must be separated from public chat DTOs.
- Report/block/rate limit are MVP requirements, not optional hardening.

## Rollback Plan

If the stack proves unsuitable before production, create a superseding ADR. Possible rollback paths:

- Swap React/Vite for Next.js if SSR or app routing becomes a real requirement.
- Split worker or realtime gateway out first if traffic requires service separation.
- Keep shared DTO/schema package stable so frontend/backend migration has a compatibility layer.

