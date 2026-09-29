# TODO triển khai PortAtlas MVP

Nguồn yêu cầu: `PORTATLAS.md`. Đã viết nền tảng mục 1–2, API mục 3–4, giao diện MVP mục 5, Compose và tài liệu bàn giao mục 6–7. Checkbox đánh dấu phần đã viết code/cấu hình, không phải kết quả build hoặc kiểm thử; chưa cài dependency, chạy migration, build hay test.

## Quy ước triển khai

- Stack: Next.js + Tailwind CSS, FastAPI + SQLAlchemy + Alembic, PostgreSQL.
- Cấu trúc dự kiến: `frontend/`, `backend/`, `compose.yaml`, `.env.example`, `README.md`, `data/`.
- Compose chạy trên Linux server và build từ code sau khi người dùng git pull.
- PostgreSQL bind mount vào `./data/postgres`; backup lưu trong `./data/backups`. Hai thư mục này không được Git theo dõi.
- Agent chỉ viết code/cấu hình/tài liệu và rà soát tĩnh; không chạy build, test, cài dependency hoặc ứng dụng. Người dùng tự push/pull, build và chạy thử trên server.

## 1. Khởi tạo cấu trúc và cấu hình

- [x] Tạo `backend/` với cấu hình FastAPI, settings đọc từ environment, kết nối database và cấu trúc routers/models/schemas/services.
- [x] Tạo `frontend/` với Next.js App Router, TypeScript, Tailwind CSS, layout chung và các thành phần form/search dùng lại.
- [x] Khai báo dependency với phiên bản cụ thể, tương thích theo metadata; không tạo lockfile giả hoặc tuyên bố đã resolve dependency khi chưa cài.
- [x] Tạo `.gitignore` cho `.env`, `data/`, backup, cache, dependency và build output; giữ `.env.example` trong Git.
- [x] Định nghĩa `.env.example`: database name/user/password, database URL, cổng web và timezone; phân biệt biến frontend công khai với secrets backend.
- [x] Thống nhất kiểu ID, timestamp UTC, quy tắc trim/normalize, format lỗi API và phân trang.

## 2. Database và migration

- [x] Tạo migration bật `pg_trgm` và tạo các bảng `servers`, `services`, `service_ports`, `service_aliases`, `service_tags`, `service_commands`.
- [x] Bổ sung `services.status`, `last_accessed_at`, `access_count` vì yêu cầu tính năng có nhưng schema gợi ý chưa liệt kê; status được nhập thủ công trong MVP.
- [x] Tạo `service_endpoints` để lưu nhiều URL với tên và loại endpoint; giữ các trường healthcheck/swagger/management theo kế hoạch.
- [x] Lưu server name, hostname, IP, SSH user/port, description, location, tags và timestamps.
- [x] Lưu đầy đủ thông tin service: server, aliases, description, project, environment, type, status, ports/protocols, URLs, Docker/Compose, owner, tags, notes và commands.
- [x] Thêm foreign keys và indexes; xoá service thì cascade dữ liệu con; ràng buộc database từ chối xoá server còn service, error handler chuẩn bị phản hồi conflict.
- [x] Validate cổng trong khoảng 1–65535; validate địa chỉ IP, URL HTTP/HTTPS, enum và độ dài field; bỏ alias/tag trống hoặc trùng sau normalize.
- [x] Tạo `search_text`, `search_vector`, GIN index cho vector và trigram. Chọn cấu hình full-text `simple` để phù hợp tên kỹ thuật.
- [x] Xây hàm tái tạo search document từ service, server và các bảng con; trigger gọi trong cùng transaction khi sửa dữ liệu. Có CLI reindex dùng thủ công.
- [x] Chuẩn bị dữ liệu ví dụ tuỳ chọn cho Triton/RabbitMQ/TTCP-S2T; không tự seed mỗi lần khởi động.

## 3. Backend CRUD và API

- [x] Tạo health endpoint cho trạng thái ứng dụng và readiness endpoint kiểm tra kết nối database.
- [x] Tạo `/api/servers`: danh sách, chi tiết, thêm, sửa, xoá; trả số service của mỗi server.
- [x] Tạo `/api/services`: danh sách, chi tiết, thêm, sửa, xoá; cập nhật ports/aliases/tags/endpoints/commands trong một transaction.
- [x] Tạo `/api/projects` và `/api/tags` lấy các giá trị hiện có, số service và khả năng lọc; MVP không cần bảng project riêng.
- [x] Tạo endpoint ghi nhận truy cập service: cập nhật thời gian và tăng bộ đếm nguyên tử khi mở trang chi tiết, không tăng khi chỉ hiện kết quả tìm kiếm.
- [x] Áp dụng pagination, giới hạn kích thước request/kết quả, xử lý 404/409/422 và rollback transaction khi lỗi.
- [x] Chỉ lưu và trả command; không có endpoint thực thi shell/SSH/Docker hoặc gọi healthcheck URL.

## 4. Tìm kiếm và xếp hạng

- [x] Tạo `/api/search?q=...` với parser cho nhiều token và filter `tag:`, `server:`, `project:`, `port:`; hỗ trợ giá trị có dấu cách trong dấu ngoặc kép.
- [x] Dùng AND giữa các token/filter; mỗi token có thể khớp bất kỳ trường tìm kiếm liên quan. Filter port khớp một trong tất cả ports của service.
- [x] Tìm kiếm không phân biệt hoa thường, hỗ trợ substring, hậu tố IP và fuzzy match; dùng cả search text, tsvector và trigram.
- [x] Xếp hạng theo thứ tự: tên chính xác, alias chính xác, IP/port chính xác, prefix tên, prefix alias, tags, project, description/notes, rồi điểm fuzzy; tie-break ổn định theo tên và ID.
- [x] Đưa hostname, server name/tags, protocols, endpoints, container/image, compose path, working directory và commands vào search document qua migration trigger.
- [x] Khi query trống, trả hai nhóm recent/frequent có giới hạn; lịch sử này dùng chung toàn registry vì MVP chưa có tài khoản.
- [x] Debounce ở frontend và huỷ request cũ để kết quả query trước không ghi đè query mới.
- [x] Chuẩn bị checklist thử thủ công trên server cho `241 s2t`, `236 triton yolor`, `4067`, `rabbitmq`, `tag:gpu`, `server:241`, `project:s2t port:4067` và kết quả rỗng.

## 5. Giao diện MVP

- [x] Global Search: ô tìm kiếm luôn dễ truy cập, card kết quả có tên, IP, tất cả ports, project, container, environment, status và tags.
- [x] Command palette: `Ctrl + K` mở search, mũi tên chọn kết quả, Enter mở chi tiết, Esc đóng; quản lý focus, focus trap và không gây xung đột khi nhập form.
- [x] Hiển thị recent/frequent khi query trống và link vào chi tiết service.
- [x] Service Detail: hiển thị toàn bộ fields, endpoints, ports, server, notes và commands; ghi nhận lượt truy cập một lần cho mỗi lần mở trang.
- [x] Add/Edit Service: chọn server, nhập nhiều aliases/ports/tags/endpoints/commands, hiển thị lỗi validation theo field và giữ dữ liệu khi lưu thất bại.
- [x] Servers: danh sách, thêm/sửa, chi tiết với các service liên quan và thông báo khi không thể xoá server đang có service.
- [x] Projects/Tags: danh sách kèm số lượng, chọn một giá trị để xem service đã lọc.
- [x] Quick actions: copy IP/port/URL/SSH/logs/restart; mở endpoint/Swagger/management và sửa service; có phản hồi copy thành công/thất bại.
- [x] Sinh SSH command mặc định từ user, IP/hostname và SSH port khi chưa khai báo command riêng; quote giá trị khi tạo command để sao chép.
- [x] Đảm bảo loading/empty/error states, layout responsive, nhãn form và thao tác bàn phím; URL ngoài chỉ mở HTTP/HTTPS với thuộc tính liên kết an toàn.

## 6. Docker Compose và lưu dữ liệu local

- [x] Viết Dockerfile backend, frontend và `.dockerignore`; frontend dùng production standalone output, backend chạy production server.
- [x] Tạo `compose.yaml` gồm `db`, `migrate`, `backend`, `frontend`; chọn và pin phiên bản image, không dùng `latest`.
- [x] Chọn PostgreSQL major version và đường dẫn PGDATA tương ứng; bind `./data/postgres` vào đúng thư mục dữ liệu của phiên bản đó.
- [x] Chỉ publish cổng web có thể cấu hình. Frontend proxy `/api/*` sang backend qua network nội bộ; browser không cần biết hostname container.
- [x] Thêm healthchecks; database healthy trước migration, migration thành công trước backend, backend ready trước frontend; migration lỗi phải dừng chuỗi startup.
- [x] Cấu hình restart policy cho các service dài hạn, không restart job migrate vô hạn; cấu hình log rotation để giới hạn log trên host.
- [x] Giữ secrets trong environment phía server; không nhúng password/database URL vào bundle frontend hoặc image build arguments công khai.
- [x] Tài liệu hoá tạo thư mục `data`, quyền sở hữu/quyền ghi và bind mount trên Linux; không giải quyết bằng `chmod 777`.
- [x] Ghi rõ `docker compose down` giữ lại dữ liệu bind mount; xoá `data/postgres` sẽ mất dữ liệu. Không tạo thao tác tự reset database.

## 7. Tài liệu bàn giao và chạy thử do người dùng thực hiện

- [x] Viết `README.md`: kiến trúc, cấu hình `.env`, map port, layout dữ liệu và các quyết định MVP.
- [x] Hướng dẫn lần đầu: clone repo, tạo `.env` và data directories, cấu hình quyền, rồi `docker compose up -d --build` trên server.
- [x] Hướng dẫn cập nhật: người dùng push code, server pull code, backup database trước migration, chạy Compose build/up và kiểm tra service/logs.
- [x] Hướng dẫn backup PostgreSQL bằng `pg_dump` vào `./data/backups` và restore bằng công cụ PostgreSQL; không sao chép PGDATA khi database đang chạy.
- [x] Hướng dẫn xử lý lỗi migration, database permissions, healthcheck, proxy API và cấu hình cổng; nêu migration có thể cần phương án rollback riêng trước cập nhật.
- [x] Nêu MVP dành cho mạng nội bộ; nếu cần public, cần cấu hình xác thực và HTTPS qua reverse proxy trước khi mở truy cập.
- [x] Lập checklist cho người dùng chạy trên server: CRUD server/service, lưu nhiều port, tìm kiếm/ranking/filter, palette, copy/open, lịch sử, xoá có ràng buộc và dữ liệu còn sau recreate container.
- [x] Rà soát tĩnh diff/code/config/docs và báo rõ các phần đã code, các phần chưa hoàn thành và build/test chưa chạy.

## Thứ tự thực hiện

1. Cấu trúc repo và database/migration (mục 1–2).
2. CRUD API và search (mục 3–4).
3. Giao diện và thao tác nhanh (mục 5).
4. Compose, bind mounts và tài liệu bàn giao (mục 6–7).

MVP được code xong khi các luồng chính có triển khai đầy đủ cùng cấu hình Compose và tài liệu. Khả năng build và hoạt động thực tế chỉ được xác nhận sau khi người dùng chạy thử trên server.

## Ngoài phạm vi MVP

Monitoring tự động, healthcheck định kỳ, discovery Docker/systemd/ports, server agents, import Compose, bulk import/export, RBAC, dependencies và deployment history để giai đoạn sau.
