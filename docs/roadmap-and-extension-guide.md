# Roadmap & Extension Guide

## 1. Development Phases

### Phase 1 - MVP

- Vietnamese UI.
- Guest anonymous session.
- Required profile.
- Email/password and Google login.
- Random 1-1 matching.
- Avoid recent matches.
- Text realtime chat và gửi ảnh trong direct chat.
- Topic rooms.
- Report/block/rate limit.
- Long-chat topic suggestion.
- Minimal moderator dashboard.

### Phase 2 - Retention

- Quick two-person game.
- Anonymous saved connections.
- Better room discovery.
- Report history and safety center.
- Improved admin metrics.

### Phase 3 - Trust & Growth

- Premium matching filters.
- More advanced moderation tooling.
- Push notifications/PWA.
- Connection inbox.
- Monetization experiments.

### Phase 4 - Calls

- Audio call.
- Video call.
- WebRTC signaling.
- TURN/STUN infrastructure.
- Call safety controls.

Audio/video call should not be implemented before Phase 4 unless the product owner explicitly changes roadmap priority.

## 2. How To Add A New Feature

1. Create a feature spec from [templates/feature-spec-template.md](templates/feature-spec-template.md).
2. Add requirement IDs to [Product Requirements](product-requirements.md).
3. Add business flow if the user journey changes.
4. Add REST/socket contract if frontend/backend communication changes.
5. Add data model/privacy changes if persistence changes.
6. Add or update ADR if architecture/security/privacy decisions change.
7. Add tests appropriate to the blast radius.
8. Update [AI Build Brief](ai-build-brief.md) if the feature affects implementation order or non-negotiable rules.

## 3. Feature Readiness Checklist

- User value is clear.
- Vietnamese UI copy is defined.
- Guest and registered behavior are both defined.
- Report/block/moderation behavior is defined.
- Rate limit behavior is defined.
- Privacy impact is reviewed.
- API/socket payloads are specified.
- Data model and retention are specified.
- Acceptance criteria are testable.
- Rollout/feature flag plan exists for risky features.

## 4. Change Categories

| Category | Requires feature spec | Requires ADR |
|---|---|---|
| UI copy/layout only | Maybe | No |
| New screen/workflow | Yes | Maybe |
| New API/socket event | Yes | Maybe |
| Database schema change | Yes | Maybe |
| Matching algorithm change | Yes | Yes |
| Auth/session/privacy change | Yes | Yes |
| Audio/video call | Yes | Yes |
| Moderation policy change | Yes | Maybe |
| Infrastructure/deployment change | Maybe | Yes |

## 5. Backward Compatibility Rules

- Do not remove API fields without a migration plan.
- Add optional fields before making them required.
- Socket event names should be stable.
- Database migrations should be reversible when practical.
- Public DTOs must remain free of sensitive internal identifiers.

## 6. Documentation Quality Bar

A feature is not ready for AI implementation unless docs answer:

- What user problem does it solve?
- Which users can use it?
- What is the happy path?
- What are the failure states?
- What should the UI say in Vietnamese?
- What APIs/events are needed?
- What data is stored?
- What privacy/safety rules apply?
- How do we know it works?
