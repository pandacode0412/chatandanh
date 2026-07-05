# Chat Ẩn Danh - Business & Technical Overview

Tài liệu này là trang tổng quan cho sản phẩm web chat ẩn danh hiện đại dùng Node.js và React.js. Bộ docs được viết theo hướng đủ cụ thể để developer hoặc AI coding agent có thể đọc và scaffold code.

## 1. Định Vị Sản Phẩm

Chat Ẩn Danh là web app cho phép người dùng:

- Vào chat ngay bằng chế độ khách, không bắt buộc đăng ký.
- Đăng ký/đăng nhập dễ dàng bằng email/password hoặc Google account.
- Hoàn tất profile tối thiểu trước khi chat: tên hiển thị, tuổi, tỉnh/thành, giới tính và giới tính muốn trò chuyện.
- Trò chuyện ẩn danh 1-1 với người lạ.
- Tham gia phòng chat theo chủ đề.
- Kết thúc cuộc trò chuyện và tìm người mới thật nhanh.
- Giao diện, nội dung, thông báo và hành động chính hiển thị bằng tiếng Việt cho người dùng Việt Nam.
- Khi hai người nói chuyện lâu, hệ thống có milestone để gợi ý chủ đề trong MVP; trò chơi nhẹ, lưu kết nối ẩn danh và audio/video call thuộc các phase sau nếu cả hai đồng ý.
- Giữ danh tính thật riêng tư với người đối diện.

Điểm quan trọng: "ẩn danh" nghĩa là người dùng không biết danh tính thật của nhau. Hệ thống vẫn cần session, chống spam, report, block, rate limit và cơ chế xử lý lạm dụng. Không nên hứa "không ai biết gì tuyệt đối" vì sản phẩm production vẫn phải bảo vệ người dùng và tuân thủ pháp luật.

## 2. Bài Học Từ Sản Phẩm Tham Khảo

Các nguồn tham khảo được dùng để rút pattern sản phẩm, không sao chép giao diện hoặc logic nội bộ:

- Chatandanh.com: nhấn mạnh "không cần đăng ký", vào chat nhanh, đóng vai trò cầu nối Messenger.
- CVNL: định vị là nơi làm quen, chia sẻ chuyện, tâm sự, ý tưởng hoặc giải trí; có app, quảng cáo và phân loại 17+.
- Chatvn/Chat với người lạ trên Messenger: flow quen thuộc là "Bắt đầu chat", ghép ngẫu nhiên, "kết thúc/đổi người", có chủ đề hoặc tiêu chí.
- Andanh.net: nhấn mạnh "không cần đăng ký", "không yêu cầu thông tin cá nhân", chat ngẫu nhiên và chia sẻ tự do.

Áp dụng cho sản phẩm này:

- Web app phải mở vào trải nghiệm chính ngay, không làm landing page dài.
- CTA chính là "Bắt đầu ẩn danh".
- Đăng ký chỉ là lựa chọn phụ, không chặn user mới.
- Nếu user muốn đăng ký, ưu tiên "Tiếp tục với Google" và email/password đơn giản.
- Trước khi matching, user phải điền profile nhanh trong 1 màn hình.
- Luồng "đổi người" phải nhanh như chatbot Messenger nhưng UI hiện đại hơn.
- Có chủ đề/phòng để tăng khả năng giữ chân.
- Có safety layer rõ ràng vì nền tảng ẩn danh rất dễ bị spam, quấy rối hoặc lừa đảo.

## 3. Stack Đề Xuất

| Layer | Công nghệ | Quyết định |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | SPA nhanh, hiện đại, dễ build UI chat |
| Styling | Tailwind CSS + Radix UI/shadcn-style components | UI đẹp, nhất quán, dễ mở rộng |
| State | TanStack Query + Zustand | Tách server state và realtime UI state |
| Backend | Node.js 24 LTS + NestJS + TypeScript | Production ổn định, module rõ, WebSocket Gateway tốt |
| Realtime | Socket.IO | Rooms, reconnect, fallback, Redis adapter |
| Database | PostgreSQL | Bền, mạnh, hợp transaction và report/moderation |
| ORM | Prisma | Schema rõ, migration tiện |
| Cache | Redis | Presence, queue ghép cặp, rate limit |
| Queue | BullMQ | Moderation async, cleanup, notification |
| Auth | JWT access token + refresh token httpOnly cookie | Dễ dùng cho web, bảo mật hơn localStorage |
| Validation | Zod shared schemas | Chia sẻ validate giữa web/API, giảm lệch DTO |
| Upload | S3-compatible storage, optional | Chỉ bật khi cần gửi ảnh |
| Observability | Sentry + OpenTelemetry + structured logs | Debug production |
| Deploy | Docker, Nginx/Caddy, GitHub Actions | Dễ deploy từ MVP lên production |

Ghi chú phiên bản tại ngày 2026-06-30:

- Node.js 24 đang là LTS phù hợp production.
- Node.js 26 đang là Current, chỉ nên cân nhắc production sau khi vào LTS.
- React docs chính thức đang ở React 19.x.
- Chi tiết stack, version policy, repo tree và build sequence nằm ở [Implementation Design](implementation-design.md).

## 4. Kiến Trúc Tổng Quan

```text
React Web App
  |
  | REST: auth, profile, rooms, reports, admin
  | Socket.IO: matching, message, typing, presence
  v
NestJS API + Socket Gateway
  |
  |-- PostgreSQL: accounts, sessions, conversations, messages, reports
  |-- Redis: online users, matching queue, socket adapter, rate limits
  |-- BullMQ worker: moderation, cleanup, scheduled jobs
  |-- Object storage: uploaded images, optional after MVP
```

MVP nên là modular monolith:

- `apps/web`: React app.
- `apps/api`: NestJS REST + Socket.IO gateway.
- `apps/worker`: BullMQ worker.
- `packages/shared`: shared types, constants, validation schemas.

Chưa cần microservices. Khi traffic tăng, scale ngang API bằng Redis adapter cho Socket.IO.

## 5. Bộ Docs Chính

- [Docs Index](README.md): thứ tự đọc, source of truth, checklist cho AI agent.
- [Implementation Design](implementation-design.md): stack decisions, monorepo shape, build sequence và guardrails cho AI agent.
- [Product Requirements](product-requirements.md): business, scope, user flows, UI requirements, acceptance criteria.
- [Business Flows](business-flows.md): luồng business cho thị trường Việt Nam và cơ chế giữ hứng thú khi chat lâu.
- [API & Realtime Spec](api-and-realtime-spec.md): REST endpoints, Socket.IO events, payloads, error codes, sequence flows.
- [Data Model & Privacy](data-model-and-privacy.md): database model, retention, anonymity rules, moderation data.
- [Architecture Guide](architecture-guide.md): module boundaries, repo structure, feature flags.
- [Roadmap & Extension Guide](roadmap-and-extension-guide.md): quy trình thêm feature mới, change categories, compatibility rules.
- [AI Build Brief](ai-build-brief.md): prompt triển khai dành cho AI coding agent hoặc developer.

## 6. Quyết Định Sản Phẩm Cần Chốt Khi Code

- Default user mode là guest anonymous.
- Toàn bộ user-facing UI mặc định là tiếng Việt, locale `vi-VN`.
- Đăng ký/đăng nhập là optional; profile tối thiểu là bắt buộc trước khi match.
- Người đối diện chỉ thấy tên hiển thị/nickname, tuổi hoặc nhóm tuổi, tỉnh/thành, giới tính, avatar tạm, topic và trạng thái online.
- Không hiển thị email, Gmail, số điện thoại, địa chỉ chính xác, IP, device id, account id cho người khác.
- Matching phải ưu tiên người chưa từng gặp; chỉ fallback gặp lại khi pool ít hoặc chờ quá lâu.
- Tin nhắn text là MVP. Cơ chế giữ hứng thú bằng milestone/gợi ý chủ đề là MVP; quick game/lưu kết nối ẩn danh là Phase 2 trừ khi PO bật sớm bằng feature spec; audio/video call để phase sau và phải có đồng ý hai chiều.
- Report/block/rate limit là bắt buộc trong MVP.
- Admin chỉ xem nội dung khi có report hoặc cần xử lý an toàn.
- Tin nhắn anonymous có retention mặc định 30 ngày, có thể giảm sau.

## 7. Nguồn Tham Khảo

- Chatandanh.com: https://chatandanh.com/
- CVNL app: https://cvnl.app/
- CVNL Google Play listing: https://play.google.com/store/apps/details?id=com.goctamhon.chatstrangers
- Chatvn Messenger flow, Thegioididong: https://www.thegioididong.com/hoi-dap/3-kenh-chat-voi-nguoi-la-an-danh-tren-facebook-messenger-1342837
- Andanh.net: https://andanh.net/
- Node.js Releases: https://nodejs.org/en/about/previous-releases
- React Versions: https://react.dev/versions
