# Docker Local Run Guide

Tài liệu này hướng dẫn chạy hạ tầng local cho Chat Ẩn Danh bằng Docker Compose.

Docker Compose chạy full stack local:

- PostgreSQL cho dữ liệu bền vững.
- Redis cho presence, matching queue, rate limit và BullMQ.
- API NestJS tại `http://localhost:3000/api`.
- Web React/Vite tại `http://localhost:5173`.
- Worker BullMQ cho cleanup/moderation jobs.

## 1. Yêu Cầu

- Docker Desktop hoặc Docker Engine có Docker Compose v2.
- Port `5432` và `6379` chưa bị ứng dụng khác chiếm.

## 2. Chạy Lần Đầu

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Compose vẫn có default value nên có thể chạy `docker compose up --build` ngay cả khi chưa tạo `.env`. Tuy vậy nên tạo `.env` để API/worker/web dùng cùng cấu hình sau này.

## 3. Connection Strings

```text
PostgreSQL: postgresql://chatandanh:chatandanh@localhost:5432/chatandanh
Redis: redis://localhost:6379
API: http://localhost:3000/api
Web: http://localhost:5173
```

Trong Docker network nội bộ:

```text
PostgreSQL host: postgres
Redis host: redis
```

## 4. Lệnh Hay Dùng

```bash
docker compose up -d
docker compose up --build
docker compose ps
docker compose logs -f api web worker postgres redis
docker compose restart api web worker postgres redis
docker compose down
```

Xóa toàn bộ data local để chạy lại từ đầu:

```bash
docker compose down -v
```

Chỉ dùng `down -v` khi chắc chắn muốn mất dữ liệu local.

## 5. Healthcheck

PostgreSQL dùng `pg_isready`.
Redis dùng `redis-cli ping`.

Kiểm tra nhanh:

```bash
docker compose ps
```

Trạng thái healthy nghĩa là hạ tầng đã sẵn sàng cho Prisma/API/worker.

## 6. Ghi Chú Cho App Services

Các service app dùng Dockerfile dev ở root:

- `api`: chạy `pnpm --filter @chatandanh/api dev`.
- `web`: chạy `pnpm --filter @chatandanh/web dev --host 0.0.0.0`.
- `worker`: chạy `pnpm --filter @chatandanh/worker dev`.

Nếu máy host chưa có Node.js, vẫn có thể dùng Docker Node image để chạy lệnh pnpm:

```bash
docker run --rm -it -v "$PWD":/workspace -w /workspace node:24-alpine sh
corepack enable
pnpm install
pnpm typecheck
```
