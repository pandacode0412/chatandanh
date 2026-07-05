# Claude Code Guide

Before coding, read [docs/README.md](docs/README.md), then follow its read order including [docs/implementation-design.md](docs/implementation-design.md).

Core rules:

- The product is Vietnam-first. User-facing UI must default to Vietnamese (`vi-VN`).
- The first MVP is text chat only plus long-chat topic suggestions. Quick game, saved connections and audio/video call are later phases unless explicitly requested.
- Privacy and safety requirements are product rules, not optional implementation details.
- Do not expose real identifiers such as email, Google account id, `accountId`, `sessionId`, `ipHash`, `deviceHash`, password hashes or refresh token hashes to another chat participant.
- When adding a new feature, create or update a feature spec using [docs/templates/feature-spec-template.md](docs/templates/feature-spec-template.md).
- When changing architecture, data privacy, auth, matching, moderation or realtime protocol, create an ADR using [docs/templates/adr-template.md](docs/templates/adr-template.md).
