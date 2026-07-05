# Chat Ẩn Danh

Repo này bắt đầu bằng bộ tài liệu sản phẩm và kỹ thuật cho phần mềm chat ẩn danh dùng Node.js + React.js.

Claude Code đọc [CLAUDE.md](CLAUDE.md). Các AI agent khác đọc [AGENTS.md](AGENTS.md) hoặc bắt đầu từ [Docs Index](docs/README.md).

## Docs

- [Docs Index](docs/README.md)
- [Business & Technical Overview](docs/anonymous-chat-business-tech.md)
- [Implementation Design](docs/implementation-design.md)
- [Docker Local Run Guide](docs/docker-local.md)
- [Business Flows](docs/business-flows.md)
- [Product Requirements](docs/product-requirements.md)
- [API & Realtime Spec](docs/api-and-realtime-spec.md)
- [Data Model & Privacy](docs/data-model-and-privacy.md)
- [Architecture Guide](docs/architecture-guide.md)
- [Roadmap & Extension Guide](docs/roadmap-and-extension-guide.md)
- [AI Build Brief](docs/ai-build-brief.md)

Các tài liệu này được viết để developer hoặc AI coding agent có thể hiểu rõ business flow, UI flow, API flow, realtime events, data model và yêu cầu privacy/safety trước khi bắt đầu code.

## Chạy Bằng Docker

Docker Compose chạy full stack local: PostgreSQL, Redis, API, worker và web.

```bash
cp .env.example .env
docker compose up --build
docker compose ps
```

Connection strings local:

```text
DATABASE_URL=postgresql://chatandanh:chatandanh@localhost:5432/chatandanh
REDIS_URL=redis://localhost:6379
```

URL local:

```text
Web: http://localhost:5173
API: http://localhost:3000/api
Socket.IO: http://localhost:3000/socket.io
```

Nếu muốn chạy lệnh Node/pnpm mà máy chưa cài Node, dùng container:

```bash
docker run --rm -it -v "$PWD":/workspace -w /workspace node:24-alpine sh
corepack enable
pnpm install
pnpm typecheck
```

Xem thêm: [Docker Local Run Guide](docs/docker-local.md).
