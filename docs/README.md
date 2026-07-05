# Docs Index - Chat Ẩn Danh

Spec version: `0.3`
Primary audience: product owner, developer, Claude Code, Codex, Cursor and other AI coding agents.

This documentation set is designed so an AI agent can understand the business, build the MVP, and safely extend the product later.

## 1. Read Order For AI Agents

Read in this order before coding:

1. [AI Build Brief](ai-build-brief.md) - short implementation brief and non-negotiable rules.
2. [Business & Technical Overview](anonymous-chat-business-tech.md) - product direction and stack.
3. [Implementation Design](implementation-design.md) - stack decisions, monorepo shape, build sequence, AI agent rules.
4. [Product Requirements](product-requirements.md) - MVP scope, functional requirements, acceptance criteria.
5. [Business Flows](business-flows.md) - Vietnam-first business flows and long-chat engagement.
6. [API & Realtime Spec](api-and-realtime-spec.md) - REST, Socket.IO events, payloads, errors.
7. [Data Model & Privacy](data-model-and-privacy.md) - schema, retention, anonymity, safety data.
8. [Architecture Guide](architecture-guide.md) - module boundaries and repo structure.
9. [Roadmap & Extension Guide](roadmap-and-extension-guide.md) - how future features should be added.
10. [Docker Local Run Guide](docker-local.md) - local PostgreSQL/Redis with Docker Compose.

If the task is only documentation, read the affected docs and this index. If the task is code, read every file above.

## 2. Source Of Truth

| Topic | Source of truth |
|---|---|
| Product goals, MVP scope, acceptance criteria | [Product Requirements](product-requirements.md) |
| User/business flows | [Business Flows](business-flows.md) |
| REST API and Socket.IO events | [API & Realtime Spec](api-and-realtime-spec.md) |
| Database, privacy, retention | [Data Model & Privacy](data-model-and-privacy.md) |
| Tech stack, version policy, implementation sequence | [Implementation Design](implementation-design.md) |
| Module boundaries, repo shape, data flow | [Architecture Guide](architecture-guide.md) |
| Local Docker commands | [Docker Local Run Guide](docker-local.md) |
| AI implementation order | [AI Build Brief](ai-build-brief.md) |
| Future feature process | [Roadmap & Extension Guide](roadmap-and-extension-guide.md) |

When docs conflict, use this priority:

1. Privacy/safety rules.
2. Product Requirements.
3. API & Realtime Spec.
4. Data Model & Privacy.
5. Architecture Guide.
6. Implementation Design.
7. Business Flows.
8. AI Build Brief.

After resolving a conflict, update the outdated doc in the same change.

## 3. Non-Negotiable Product Rules

- Default UI language is Vietnamese, locale `vi-VN`.
- Guest chat is allowed, but profile completion is required before matching.
- Registration/login is optional before first chat.
- Matching must avoid people already met recently when fresh compatible users exist.
- Blocked users must never be matched again.
- Long conversations must show topic suggestions in MVP.
- Quick game and anonymous saved connections are Phase 2 unless explicitly enabled by a feature spec.
- First MVP does not implement audio/video call.
- Audio/video call is a later phase and requires mutual consent, preview, privacy warning and visible report/block/end controls.
- Do not expose real identity or internal safety identifiers to another participant.

## 4. Docs For Future Development

Templates:

- [Feature Spec Template](templates/feature-spec-template.md)
- [ADR Template](templates/adr-template.md)

Use a feature spec when adding a new user-facing feature.
Use an ADR when changing architecture, data model, auth, matching, privacy, moderation, realtime protocol or infrastructure.

Suggested future doc folders:

```text
docs/
  features/       # One spec per major feature
  adr/            # Architecture Decision Records
  templates/      # Reusable templates
```

## 5. Agent Checklist Before Coding

- Identify the feature or bug being changed.
- Find the relevant requirement IDs.
- Check whether API/socket payloads need changes.
- Check whether database/privacy rules need changes.
- Check whether Vietnamese UI copy is needed.
- Check whether report/block/rate limit/moderation applies.
- Keep implementation scoped to the requested feature.
- Update docs when behavior changes.
